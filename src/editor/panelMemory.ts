import { useSyncExternalStore } from "react";

import { APP_NAME } from "#/lib/app";

/**
 * Which properties panels (and outliner groups) are folded shut, per browser: a UI preference like
 * the panel sizes, not part of any world. Only panels folded or opened by hand
 * are stored; the rest keep their default. See docs/adr/0054-properties-editor.md.
 *
 * When panels change: nothing is wiped or migrated. A new panel shows its default; one that's
 * removed or gets a new id leaves a stray entry that's never read (a few bytes, gone with Wipe
 * everything), and a renamed one opens as its default once. If the stored shape itself ever has
 * to change, just overwrite it: it only holds fold states, so every panel opening as its default
 * again is fine. No migration.
 */
const KEY = `${APP_NAME.toLowerCase()}:panels`;

/** Panel id → open. */
export type TPanelMemory = Record<string, boolean>;

/**
 * Stored memory: every entry that's an on/off value, so one bad entry doesn't
 * forget the rest. Nothing remembered when it's missing or unreadable.
 */
export const parsePanelMemory = (raw: string | null): TPanelMemory => {
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			return {};
		}
		return Object.fromEntries(
			Object.entries(value).filter(
				(entry): entry is [string, boolean] => typeof entry[1] === "boolean",
			),
		);
	} catch {
		return {};
	}
};

const read = () => {
	try {
		return parsePanelMemory(localStorage.getItem(KEY));
	} catch {
		return {};
	}
};

let memory: TPanelMemory | null = null;
const listeners = new Set<() => void>();

/** What's remembered, read from storage once, then kept up to date. */
export const readPanelMemory = () => {
	memory ??= read();
	return memory;
};

const notify = () => {
	for (const listener of listeners) {
		listener();
	}
};

/**
 * The memory as stored right now, which another tab of the app may have
 * changed since it was read, or this tab's own when the storage can't be read.
 */
const latest = () => {
	try {
		return parsePanelMemory(localStorage.getItem(KEY));
	} catch {
		return readPanelMemory();
	}
};

export const setPanelOpen = (id: string, open: boolean) => {
	// From the latest, so a fold in another tab of the app since isn't overwritten.
	memory = { ...latest(), [id]: open };
	try {
		localStorage.setItem(KEY, JSON.stringify(memory));
	} catch {
		// Storage unavailable (private mode etc.): it's remembered until the page closes.
	}
	notify();
};

/** Another tab of the app folded a panel (or the storage was wiped): follow it. */
const onStorage = (event: StorageEvent) => {
	if (event.key === KEY || event.key === null) {
		memory = parsePanelMemory(event.newValue);
		notify();
	}
};

/** Call `listener` whenever a panel is folded or opened, here or in another tab of the app. */
export const subscribePanelMemory = (listener: () => void) => {
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

const EMPTY: TPanelMemory = {};

/** Every panel opened or folded by hand in this browser, updating when one changes. */
export const usePanelMemory = () =>
	useSyncExternalStore(subscribePanelMemory, readPanelMemory, () => EMPTY);

/** Whether the panel is open: as it was left in this browser, else `fallback`. */
export const usePanelOpen = (id: string, fallback: boolean) => usePanelMemory()[id] ?? fallback;
