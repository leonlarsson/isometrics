import { create } from "zustand";

import { APP_NAME } from "#/lib/app";
import { keepOnHotReload } from "#/lib/hot";
import { storageAvailable } from "#/lib/storage";
import { compactWorld } from "#/parts/compactWorld";
import { repairWorld } from "#/parts/repairWorld";
import { describeRepairs } from "#/scene/repair";
import type { TScene } from "#/scene/schema";

/**
 * Worlds shared by link, in the browser (ADR-0120): sharing one (a public
 * snapshot on the site's servers, kept until it expires), the links this
 * browser shared with the keys that stop them, and reading a shared world back,
 * waiting out the minute a new link can take to reach everywhere.
 */

/** How long a shared world can be kept, as offered: seconds and words. */
export const SHARE_EXPIRIES = [
	{ seconds: 3600, label: "1 hour" },
	{ seconds: 86_400, label: "1 day" },
	{ seconds: 604_800, label: "7 days" },
	{ seconds: 2_592_000, label: "30 days" },
] as const;

/** Shares default to a week; a world handed to an AI, an hour. */
export const SHARE_DEFAULT_SECONDS = 604_800;
export const HANDOFF_SECONDS = 3600;

/** A link this browser shared, with the key that stops it. */
export interface ISharedLink {
	id: string;
	title: string;
	url: string;
	jsonUrl: string;
	expiresAt: string;
	deleteKey: string;
	/** A world handed to an AI (Build with AI), not shared with people. */
	isHandoff: boolean;
}

const KEY = `${APP_NAME.toLowerCase()}:shared-links`;

const stillShared = (links: readonly ISharedLink[]) =>
	links.filter((link) => Date.parse(link.expiresAt) > Date.now());

const loadLinks = (): ISharedLink[] => {
	try {
		const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
		return Array.isArray(stored) ? stillShared(stored as ISharedLink[]) : [];
	} catch {
		return [];
	}
};

const saveLinks = (links: ISharedLink[]) => {
	useSharedLinks.setState({ links });
	try {
		localStorage.setItem(KEY, JSON.stringify(links));
	} catch {
		// Storage unavailable: listed for as long as the page is open.
	}
};

/** The links this browser shared that haven't expired, newest first. */
export const useSharedLinks = keepOnHotReload("sharedLinks", () =>
	create<{ links: ISharedLink[] }>(() => ({
		links: storageAvailable() ? loadLinks() : [],
	})),
);

/** Why sharing or reading a shared world didn't work, in words. */
export class ShareError extends Error {
	/**
	 * The site isn't taking shares now (it answered 503: sharing is paused by its owner, ADR-0145,
	 * or isn't set up): the share dialogs say so in place, not only in a toast.
	 */
	readonly isPaused: boolean;

	constructor(message: string, { isPaused = false } = {}) {
		super(message);
		this.isPaused = isPaused;
	}
}

/** The first few problems a refusal lists, said after its message. */
const PROBLEMS_SAID = 3;

const errorOf = async (response: Response) => {
	try {
		const body = (await response.json()) as { error?: unknown; problems?: unknown };
		if (typeof body.error !== "string") {
			return `It answered ${response.status}.`;
		}
		const problems = Array.isArray(body.problems)
			? body.problems
					.slice(0, PROBLEMS_SAID)
					.flatMap((each) =>
						typeof each?.where === "string" && typeof each?.what === "string"
							? [`${each.where}: ${each.what}`]
							: [],
					)
			: [];
		return problems.length > 0 ? `${body.error} ${problems.join("; ")}.` : body.error;
	} catch {
		return `It answered ${response.status}.`;
	}
};

/** Share a world: a public snapshot for `seconds`, listed in this browser with its key. */
export const shareWorld = async (
	scene: TScene,
	seconds: number,
	{ isHandoff = false } = {},
): Promise<ISharedLink> => {
	// The API keeps only worlds that open as written (ADR-0120). The open world was read when it
	// opened, but an edit can still have written something the schema doesn't take (a bug of ours,
	// not the person's): repaired here, as opening it would, so sharing is never refused for it.
	const { scene: asRead, report } = repairWorld(structuredClone(scene));
	if (report) {
		console.warn(`Repaired before sharing: ${describeRepairs(report)}`, report);
	}
	let response: Response;
	try {
		response = await fetch(`/api/user-worlds?expiresIn=${seconds}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			// As the API keeps it, its defaults left out: what its size limit is about (ADR-0145). With
			// them written out a world is a few times bigger, and one under the limit as kept could be
			// more than the API reads at all.
			body: JSON.stringify(compactWorld(asRead)),
		});
	} catch {
		throw new ShareError("The site couldn't be reached: are you offline?");
	}
	if (!response.ok) {
		throw new ShareError(await errorOf(response), { isPaused: response.status === 503 });
	}
	const shared = (await response.json()) as Omit<ISharedLink, "title" | "isHandoff">;
	const link: ISharedLink = { ...shared, title: scene.meta.title, isHandoff };
	saveLinks([link, ...stillShared(useSharedLinks.getState().links)]);
	return link;
};

/** Stop sharing a link early: deleted with its key (gone everywhere within a minute). */
export const stopSharing = async (link: ISharedLink) => {
	const response = await fetch(`/api/user-worlds/${link.id}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${link.deleteKey}` },
	}).catch(() => null);
	if (response && !response.ok && response.status !== 404) {
		throw new ShareError(await errorOf(response));
	}
	if (!response) {
		throw new ShareError("The site couldn't be reached: are you offline?");
	}
	saveLinks(useSharedLinks.getState().links.filter((each) => each.id !== link.id));
};

/** A shared world's id in a link to this site (/w/<id> or /api/user-worlds/<id>), or null. */
export const sharedWorldIdOf = (text: string, origin = window.location.origin) => {
	try {
		const url = new URL(text.trim(), origin);
		if (url.origin !== origin) {
			return null;
		}
		const match = /^\/(?:w|api\/user-worlds)\/([A-Za-z0-9_-]{22})\/?$/.exec(url.pathname);
		return match ? match[1] : null;
	} catch {
		return null;
	}
};

/** How long a new link may take to reach every part of the world (KV's eventual consistency). */
const ARRIVING_SECONDS = 60;

/** How often a link that isn't here yet is asked again, in milliseconds. */
export const TRY_AGAIN_MS = 4000;

/**
 * A link this browser didn't just share (or a person didn't just paste from an AI) is asked this
 * many times at most (ADR-0145): a mistyped or expired one says so in seconds, not after a minute
 * of asking the site every few seconds.
 */
export const MOST_TRIES = 4;

/** How a link that isn't here (404) is waited for: a minute, or MOST_TRIES tries. */
export interface IWaiting {
	/** Told after each try that found nothing: how many so far, and the seconds left. */
	onWaiting?: (tries: number, secondsLeft: number) => void;
	/** Wait out the whole minute: a link just made (shared from this browser, an AI's answer). */
	waitsTheMinute?: boolean;
}

/**
 * The seconds left to keep asking for a link that wasn't there after `tries` tries, since
 * `started` (ms), or null to give up.
 */
export const secondsLeftToTry = (
	tries: number,
	started: number,
	waitsTheMinute: boolean,
	now = Date.now(),
): number | null => {
	const secondsLeft = waitsTheMinute
		? ARRIVING_SECONDS - Math.round((now - started) / 1000)
		: ((MOST_TRIES - tries) * TRY_AGAIN_MS) / 1000;
	return secondsLeft > 0 ? secondsLeft : null;
};

/** Whether this browser shared the world with this id (so its link may just be arriving). */
export const sharedFromHere = (id: string) =>
	useSharedLinks.getState().links.some((link) => link.id === id);

/** A shared world as fetched: its JSON text, and when its link expires (ISO), if said. */
export interface IFetchedWorld {
	text: string;
	expiresAt: string | null;
}

/**
 * A shared world's JSON text, from this site only. A link shared moments ago
 * may not have reached this part of the world yet: it's asked again every few
 * seconds, `onWaiting` told each time (how many tries so far, and the seconds
 * left), for up to a minute when it was just made (shared from this browser,
 * or `waitsTheMinute`), else MOST_TRIES times, before giving up.
 */
export const fetchSharedWorld = async (
	id: string,
	{ onWaiting, waitsTheMinute = sharedFromHere(id) }: IWaiting = {},
): Promise<IFetchedWorld> => {
	const started = Date.now();
	for (let tries = 1; ; tries++) {
		let response: Response;
		try {
			response = await fetch(`/api/user-worlds/${id}`, { cache: "no-store" });
		} catch {
			throw new ShareError("The site couldn't be reached: are you offline?");
		}
		if (response.ok) {
			return { text: await response.text(), expiresAt: response.headers.get("X-World-Expires") };
		}
		const secondsLeft = secondsLeftToTry(tries, started, waitsTheMinute);
		if (response.status !== 404 || secondsLeft === null) {
			throw new ShareError(await errorOf(response));
		}
		onWaiting?.(tries, secondsLeft);
		await new Promise((resolve) => setTimeout(resolve, TRY_AGAIN_MS));
	}
};
