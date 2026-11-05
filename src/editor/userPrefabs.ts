import { create } from "zustand";

import { APP_NAME } from "#/lib/app";
import { keepOnHotReload } from "#/lib/hot";
import { storageAvailable } from "#/lib/storage";
import { repairWorld } from "#/parts/repairWorld";
import { SCENE_VERSION, type TPrefab } from "#/scene/schema";

import { type IWaiting, ShareError, secondsLeftToTry, TRY_AGAIN_MS } from "./userWorlds";

/**
 * Prefabs shared by link, in the browser (ADR-0134): sharing one (a public
 * snapshot on the site's servers, kept until it expires, as worlds are,
 * ADR-0120), the links this browser shared with the keys that stop them, and
 * reading a shared prefab back, waiting out the minute a new link can take to
 * reach everywhere. Only this site's own API is asked.
 */

/** A prefab link this browser shared, with the key that stops it. */
export interface ISharedPrefabLink {
	id: string;
	/** Which prefab: its id in one's worlds and My prefabs. */
	prefabId: string;
	name: string;
	url: string;
	expiresAt: string;
	deleteKey: string;
}

const KEY = `${APP_NAME.toLowerCase()}:shared-prefab-links`;

const stillShared = (links: readonly ISharedPrefabLink[]) =>
	links.filter((link) => Date.parse(link.expiresAt) > Date.now());

const loadLinks = (): ISharedPrefabLink[] => {
	try {
		const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
		return Array.isArray(stored) ? stillShared(stored as ISharedPrefabLink[]) : [];
	} catch {
		return [];
	}
};

const saveLinks = (links: ISharedPrefabLink[]) => {
	useSharedPrefabLinks.setState({ links });
	try {
		localStorage.setItem(KEY, JSON.stringify(links));
	} catch {
		// Storage unavailable: listed for as long as the page is open.
	}
};

/** The prefab links this browser shared that haven't expired, newest first. */
export const useSharedPrefabLinks = keepOnHotReload("sharedPrefabLinks", () =>
	create<{ links: ISharedPrefabLink[] }>(() => ({
		links: storageAvailable() ? loadLinks() : [],
	})),
);

/** What the site said went wrong, in its words, or its status. */
const errorOf = async (response: Response) => {
	try {
		const body = (await response.json()) as { error?: unknown };
		return typeof body.error === "string" ? body.error : `It answered ${response.status}.`;
	} catch {
		return `It answered ${response.status}.`;
	}
};

/** Share a prefab: a public snapshot for `seconds`, listed in this browser with its key. */
export const sharePrefab = async (prefab: TPrefab, seconds: number): Promise<ISharedPrefabLink> => {
	let response: Response;
	try {
		response = await fetch(`/api/user-prefabs?expiresIn=${seconds}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(prefab),
		});
	} catch {
		throw new ShareError("The site couldn't be reached: are you offline?");
	}
	if (!response.ok) {
		throw new ShareError(await errorOf(response), { isPaused: response.status === 503 });
	}
	const shared = (await response.json()) as Pick<
		ISharedPrefabLink,
		"id" | "url" | "expiresAt" | "deleteKey"
	>;
	const link: ISharedPrefabLink = {
		id: shared.id,
		url: shared.url,
		expiresAt: shared.expiresAt,
		deleteKey: shared.deleteKey,
		prefabId: prefab.id,
		name: prefab.name,
	};
	saveLinks([link, ...stillShared(useSharedPrefabLinks.getState().links)]);
	return link;
};

/** Stop sharing a prefab's link early: deleted with its key (gone everywhere within a minute). */
export const stopSharingPrefab = async (link: ISharedPrefabLink) => {
	const response = await fetch(`/api/user-prefabs/${link.id}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${link.deleteKey}` },
	}).catch(() => null);
	if (!response) {
		throw new ShareError("The site couldn't be reached: are you offline?");
	}
	if (!response.ok && response.status !== 404) {
		throw new ShareError(await errorOf(response));
	}
	saveLinks(useSharedPrefabLinks.getState().links.filter((each) => each.id !== link.id));
};

/** Whether this browser shared the prefab link with this id (so it may just be arriving). */
export const sharedPrefabFromHere = (id: string) =>
	useSharedPrefabLinks.getState().links.some((link) => link.id === id);

/**
 * A shared prefab, from this site only, read as any prefab from outside is (`repairWorld`). A
 * link shared moments ago may not be here yet: asked again every few seconds, `onWaiting` told
 * each time, for up to a minute when this browser shared it, else a few times (as shared worlds
 * are, `secondsLeftToTry`). Throws a `ShareError` saying why it can't.
 */
export const fetchSharedPrefab = async (
	id: string,
	{ onWaiting, waitsTheMinute = sharedPrefabFromHere(id) }: IWaiting = {},
): Promise<{ prefab: TPrefab; expiresAt: string | null }> => {
	const started = Date.now();
	for (let tries = 1; ; tries++) {
		let response: Response;
		try {
			response = await fetch(`/api/user-prefabs/${id}`, { cache: "no-store" });
		} catch {
			throw new ShareError("The site couldn't be reached: are you offline?");
		}
		if (response.ok) {
			const text = await response.text();
			let prefab: TPrefab | undefined;
			try {
				prefab = repairWorld({ version: SCENE_VERSION, prefabs: [JSON.parse(text)] }).scene
					.prefabs[0];
			} catch {
				prefab = undefined;
			}
			if (!prefab) {
				throw new ShareError("What the link holds isn't a prefab this app can read.");
			}
			return { prefab, expiresAt: response.headers.get("X-Prefab-Expires") };
		}
		const secondsLeft = secondsLeftToTry(tries, started, waitsTheMinute);
		if (response.status !== 404 || secondsLeft === null) {
			throw new ShareError(await errorOf(response));
		}
		onWaiting?.(tries, secondsLeft);
		await new Promise((resolve) => setTimeout(resolve, TRY_AGAIN_MS));
	}
};
