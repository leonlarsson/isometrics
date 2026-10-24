import { useSyncExternalStore } from "react";
import { z } from "zod";

import { APP_NAME } from "#/lib/app";

/**
 * What Add to scene remembers per browser: favourite items, recently used
 * ones, and which sections are folded. A UI preference like the panel sizes,
 * not part of any world. Items are palette keys: "part:house_01",
 * "road:road_01", "area:water_01". See docs/adr/0051-add-to-scene.md.
 */
const KEY = `${APP_NAME.toLowerCase()}:palette`;

/** How many recently used items are kept. */
export const RECENT_LIMIT = 8;

export const PaletteMemorySchema = z.object({
	favourites: z.array(z.string()).catch([]),
	recent: z.array(z.string()).catch([]),
	/** Sections folded shut: "favourites", "recent", or a group's name. */
	collapsed: z.array(z.string()).catch([]),
});

export type TPaletteMemory = z.output<typeof PaletteMemorySchema>;

/** Stored memory, with an empty list for anything missing or unreadable. */
export const parsePaletteMemory = (raw: string | null): TPaletteMemory => {
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		return PaletteMemorySchema.parse(typeof value === "object" && value !== null ? value : {});
	} catch {
		return PaletteMemorySchema.parse({});
	}
};

const read = () => {
	try {
		return parsePaletteMemory(localStorage.getItem(KEY));
	} catch {
		return parsePaletteMemory(null);
	}
};

let memory: TPaletteMemory | null = null;
const listeners = new Set<() => void>();

/** What's remembered, read from storage once, then kept up to date. */
export const readPaletteMemory = () => {
	memory ??= read();
	return memory;
};

/**
 * The memory as stored right now, which another tab of the app may have
 * changed since it was read, or this tab's own when the storage can't be read.
 * Changes start from it, so they don't overwrite another tab's.
 */
const latest = () => {
	try {
		return parsePaletteMemory(localStorage.getItem(KEY));
	} catch {
		return readPaletteMemory();
	}
};

const notify = () => {
	for (const listener of listeners) {
		listener();
	}
};

const update = (next: TPaletteMemory) => {
	memory = next;
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {
		// Storage unavailable (private mode etc.): it's remembered until the page closes.
	}
	notify();
};

/** `key` at the front of the list, without repeats, at most `limit` long. */
export const toFront = (list: readonly string[], key: string, limit = Number.POSITIVE_INFINITY) =>
	[key, ...list.filter((other) => other !== key)].slice(0, limit);

/** Note that an item was just used: a part added, or a road or area drawn. */
export const rememberUsed = (key: string) => {
	const state = latest();
	if (state.recent[0] !== key) {
		update({ ...state, recent: toFront(state.recent, key, RECENT_LIMIT) });
	}
};

export const toggleFavourite = (key: string) => {
	const state = latest();
	const favourites = state.favourites.includes(key)
		? state.favourites.filter((other) => other !== key)
		: [...state.favourites, key];
	update({ ...state, favourites });
};

export const setSectionCollapsed = (section: string, collapsed: boolean) => {
	const state = latest();
	const others = state.collapsed.filter((other) => other !== section);
	update({ ...state, collapsed: collapsed ? [...others, section] : others });
};

/** Another tab of the app changed it (or the storage was wiped): follow it. */
const onStorage = (event: StorageEvent) => {
	if (event.key === KEY || event.key === null) {
		memory = parsePaletteMemory(event.newValue);
		notify();
	}
};

/** Call `listener` whenever the memory changes, here or in another tab of the app. */
export const subscribePaletteMemory = (listener: () => void) => {
	if (listeners.size === 0) {
		window.addEventListener("storage", onStorage);
	}
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			window.removeEventListener("storage", onStorage);
		}
	};
};

const EMPTY = parsePaletteMemory(null);

/** The palette's memory, updating when it changes. */
export const usePaletteMemory = () =>
	useSyncExternalStore(subscribePaletteMemory, readPaletteMemory, () => EMPTY);
