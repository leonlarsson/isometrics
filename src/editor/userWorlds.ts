import { create } from "zustand";

import { APP_NAME } from "#/lib/app";
import { keepOnHotReload } from "#/lib/hot";
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
	/** A world handed to an AI (Build with your AI), not shared with people. */
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
		links: typeof localStorage === "undefined" ? [] : loadLinks(),
	})),
);

/** Why sharing or reading a shared world didn't work, in words. */
export class ShareError extends Error {}

const errorOf = async (response: Response) => {
	try {
		const body = (await response.json()) as { error?: unknown };
		return typeof body.error === "string" ? body.error : `It answered ${response.status}.`;
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
	let response: Response;
	try {
		response = await fetch(`/api/user-worlds?expiresIn=${seconds}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(scene),
		});
	} catch {
		throw new ShareError("The site couldn't be reached: are you offline?");
	}
	if (!response.ok) {
		throw new ShareError(await errorOf(response));
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

/**
 * A shared world's JSON text, from this site only. A link shared moments ago
 * may not have reached this part of the world yet: it's asked again every few
 * seconds for up to a minute, `onWaiting` told each time, before giving up.
 */
export const fetchSharedWorld = async (
	id: string,
	{ onWaiting }: { onWaiting?: (secondsLeft: number) => void } = {},
): Promise<string> => {
	const started = Date.now();
	for (;;) {
		let response: Response;
		try {
			response = await fetch(`/api/user-worlds/${id}`, { cache: "no-store" });
		} catch {
			throw new ShareError("The site couldn't be reached: are you offline?");
		}
		if (response.ok) {
			return response.text();
		}
		const secondsLeft = ARRIVING_SECONDS - Math.round((Date.now() - started) / 1000);
		if (response.status !== 404 || secondsLeft <= 0) {
			throw new ShareError(await errorOf(response));
		}
		onWaiting?.(secondsLeft);
		await new Promise((resolve) => setTimeout(resolve, 4000));
	}
};
