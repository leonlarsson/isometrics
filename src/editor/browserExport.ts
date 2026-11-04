import { nanoid } from "nanoid";

import { APP_NAME } from "#/lib/app";
import { safeJson, UnsafeJsonError } from "#/scene/safeJson";

import {
	BACKUP_PREFIX,
	BROWSER_BACKUP_PREFIX,
	formatStorageSize,
	type IWorldInfo,
	isStorageFull,
	listWorlds,
	OPEN_WORLD_ID_KEY,
	parseWorldIndex,
	SINGLE_SAVE_KEY,
	STORAGE_PREFIX,
	titleOf,
	WORLD_INDEX_KEY,
	WORLD_KEY_PREFIX,
} from "./persistence";

/**
 * Everything this app keeps in a browser, as one file, and back (ADR-0140):
 * Export this browser and Import a browser's export, in the app menu (the
 * logo). The file holds every localStorage key that starts with the app's
 * prefix, exactly as stored, so a store added later is in it without being
 * listed here. Importing either adds the file's worlds and backups beside
 * this browser's (never overwriting one), or replaces this browser's worlds
 * and settings with the file's, after keeping a copy of this browser as a
 * backup. The file is untrusted: only text under the app's prefix is kept,
 * and worlds are stored as they are, to be repaired when they're first
 * opened, like any stored world. No React.
 */

export const BROWSER_EXPORT_KIND = "browser";
export const BROWSER_EXPORT_VERSION = 1;
/** Larger files aren't read: a browser keeps about 5 MB, which is well under this even as JSON. */
export const MOST_EXPORT_CHARS = 32 * 1024 * 1024;
/** More entries than this are left out: a browser holds a few dozen. */
export const MOST_EXPORT_ITEMS = 10_000;
/** Keys longer than this are left out: the app's own are short. */
const MOST_KEY_LENGTH = 256;
/** Titles from a file's list of worlds are cut to this length. */
const MOST_TITLE_LENGTH = 200;
/** What a world's id may be; any other id gets a new one when it's imported. */
const WORLD_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** The addresses this browser reads without asking (editor/linkTrust.ts). */
const ALLOWED_LINKS_KEY = `${STORAGE_PREFIX}allowed-links`;

/** A file that can't be imported; its message says why, in words for the person. */
export class BrowserExportError extends Error {}

/** The file's shape (`items`: every key the app kept, with its text exactly as stored). */
export interface IBrowserExport {
	app: string;
	kind: typeof BROWSER_EXPORT_KIND;
	version: number;
	/** When it was made, as an ISO date. */
	exportedAt: string;
	items: Record<string, string>;
}

/** What an export holds, read and checked, ready to add or replace with. */
export interface IBrowserContents {
	/** When it was exported (ms since epoch), or null if the file doesn't say. */
	exportedAt: number | null;
	/** Every entry kept: keys with the app's prefix, text values. */
	items: ReadonlyMap<string, string>;
	/** Its worlds, most recently edited first (an id of null: a save from before there were several). */
	worlds: IWorldInfo[];
	/** Copies of worlds, and of whole browsers, it keeps. */
	backups: number;
	/** Everything else: Preferences, panels, favourites, cameras, allowed and shared links… */
	settings: number;
	/** The addresses it lets this browser read without asking, once it replaces this browser's. */
	allowedLinks: string[];
	/** How much it holds, in characters (keys and values), as storage counts them. */
	size: number;
	/** Entries left out of the file: not this app's, too long a key, or not text. */
	leftOut: number;
}

type TItemKind = "world" | "index" | "openWorld" | "backup" | "setting";

const kindOfKey = (key: string): TItemKind => {
	if (key.startsWith(WORLD_KEY_PREFIX) || key === SINGLE_SAVE_KEY) {
		return "world";
	}
	if (key === WORLD_INDEX_KEY) {
		return "index";
	}
	if (key === OPEN_WORLD_ID_KEY) {
		return "openWorld";
	}
	if (key.startsWith(BACKUP_PREFIX) || key.startsWith(BROWSER_BACKUP_PREFIX)) {
		return "backup";
	}
	return "setting";
};

const getItem = (key: string) => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
};

/** Every key this app keeps in this browser, with its text exactly as stored. */
export const collectBrowserItems = (): Map<string, string> => {
	const items = new Map<string, string>();
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			const value = key?.startsWith(STORAGE_PREFIX) ? localStorage.getItem(key) : null;
			if (key && value !== null) {
				items.set(key, value);
			}
		}
	} catch {
		// Storage unavailable: nothing kept.
	}
	return items;
};

/** The export file's text for `items`, made at `now`. */
export const makeBrowserExport = (items: ReadonlyMap<string, string>, now = Date.now()) => {
	const file: IBrowserExport = {
		app: APP_NAME,
		kind: BROWSER_EXPORT_KIND,
		version: BROWSER_EXPORT_VERSION,
		exportedAt: new Date(now).toISOString(),
		items: Object.fromEntries([...items].sort(([a], [b]) => a.localeCompare(b))),
	};
	return JSON.stringify(file, null, "\t");
};

/** "isometrics-browser-2026-11-04.json" */
export const browserExportFileName = (at = Date.now()) =>
	`${APP_NAME.toLowerCase()}-browser-${new Date(at).toISOString().slice(0, 10)}.json`;

/** How much `items` take in storage, in characters (keys and values). */
const sizeOf = (items: ReadonlyMap<string, string>) => {
	let size = 0;
	for (const [key, value] of items) {
		size += key.length + value.length;
	}
	return size;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** A field of untrusted data, only if it's the object's own. */
const own = (record: Record<string, unknown>, key: string) =>
	Object.hasOwn(record, key) ? record[key] : undefined;

/** The worlds `items` hold, with their titles from its list of worlds, else from the worlds. */
const worldsIn = (items: ReadonlyMap<string, string>): IWorldInfo[] => {
	const index = new Map(
		parseWorldIndex(items.get(WORLD_INDEX_KEY) ?? null).map((world) => [world.id, world]),
	);
	const worlds: IWorldInfo[] = [];
	for (const [key, raw] of items) {
		if (kindOfKey(key) !== "world") {
			continue;
		}
		const id = key === SINGLE_SAVE_KEY ? "" : key.slice(WORLD_KEY_PREFIX.length);
		const listed = index.get(id);
		worlds.push({
			id,
			title: (listed?.title || titleOf(raw)).slice(0, MOST_TITLE_LENGTH),
			updatedAt: listed?.updatedAt ?? 0,
		});
	}
	return worlds.sort((a, b) => b.updatedAt - a.updatedAt);
};

const allowedLinksIn = (items: ReadonlyMap<string, string>): string[] => {
	try {
		const links = safeJson(JSON.parse(items.get(ALLOWED_LINKS_KEY) ?? "[]") as unknown);
		return Array.isArray(links) ? links.filter((link) => typeof link === "string") : [];
	} catch {
		return [];
	}
};

/** What `items` hold, counted. */
export const contentsOf = (
	items: ReadonlyMap<string, string>,
	exportedAt: number | null = null,
	leftOut = 0,
): IBrowserContents => {
	let backups = 0;
	let settings = 0;
	for (const key of items.keys()) {
		const kind = kindOfKey(key);
		if (kind === "backup") {
			backups++;
		} else if (kind === "setting") {
			settings++;
		}
	}
	return {
		exportedAt,
		items,
		worlds: worldsIn(items),
		backups,
		settings,
		allowedLinks: allowedLinksIn(items),
		size: sizeOf(items),
		leftOut,
	};
};

/** Refuse a file larger than any export, before reading it (`size` in characters or bytes). */
export const checkExportSize = (size: number) => {
	if (size > MOST_EXPORT_CHARS) {
		throw new BrowserExportError(
			`It’s ${formatStorageSize(size)}, much more than a browser keeps: it can’t be a browser’s export.`,
		);
	}
};

const NOT_AN_EXPORT = `It isn’t a browser’s export from ${APP_NAME}. One is made by Export this browser, in the app menu (the logo).`;

/**
 * Read an export's text (untrusted: a file from anywhere). Throws a
 * `BrowserExportError` saying why, in words, if it isn't one.
 */
export const readBrowserExport = (text: string): IBrowserContents => {
	checkExportSize(text.length);
	let parsed: unknown;
	try {
		parsed = safeJson(JSON.parse(text) as unknown);
	} catch (error) {
		throw new BrowserExportError(
			error instanceof UnsafeJsonError ? `${NOT_AN_EXPORT} ${error.message}` : NOT_AN_EXPORT,
		);
	}
	if (!isRecord(parsed)) {
		throw new BrowserExportError(NOT_AN_EXPORT);
	}
	const app = own(parsed, "app");
	if (
		own(parsed, "kind") !== BROWSER_EXPORT_KIND ||
		typeof app !== "string" ||
		app.toLowerCase() !== APP_NAME.toLowerCase()
	) {
		throw new BrowserExportError(
			Object.hasOwn(parsed, "entities") || Object.hasOwn(parsed, "meta")
				? "It’s a world, not a browser’s export: open it with File → Open file…"
				: NOT_AN_EXPORT,
		);
	}
	const version = own(parsed, "version");
	if (typeof version === "number" && version > BROWSER_EXPORT_VERSION) {
		throw new BrowserExportError(
			`It was exported by a newer version of ${APP_NAME}. Reload the page to get the newest, then import it again.`,
		);
	}
	if (version !== BROWSER_EXPORT_VERSION) {
		throw new BrowserExportError(NOT_AN_EXPORT);
	}
	const given = own(parsed, "items");
	if (!isRecord(given)) {
		throw new BrowserExportError(
			"Its list of what the browser kept is missing or damaged, so there’s nothing to import.",
		);
	}
	const items = new Map<string, string>();
	let leftOut = 0;
	for (const [key, value] of Object.entries(given)) {
		if (
			items.size < MOST_EXPORT_ITEMS &&
			key.startsWith(STORAGE_PREFIX) &&
			key.length <= MOST_KEY_LENGTH &&
			typeof value === "string"
		) {
			items.set(key, value);
		} else {
			leftOut++;
		}
	}
	const exportedAt = own(parsed, "exportedAt");
	const at = typeof exportedAt === "string" ? Date.parse(exportedAt) : Number.NaN;
	return contentsOf(items, Number.isFinite(at) ? at : null, leftOut);
};

const newWorldId = () => {
	let id = nanoid(10);
	while (getItem(`${WORLD_KEY_PREFIX}${id}`) !== null) {
		id = nanoid(10);
	}
	return id;
};

/** What adding (or replacing with) an export did. */
export interface IImportCounts {
	/** Worlds added (copies included). */
	worldsAdded: number;
	/** Of those, worlds whose id this browser already used for another world: added under a new one. */
	worldsCopied: number;
	/** Worlds this browser already had, exactly: not added twice. */
	worldsAlreadyHere: number;
	/** Worlds that didn't fit (or the browser refused). */
	worldsLeftOut: number;
	backupsAdded: number;
	backupsAlreadyHere: number;
	backupsLeftOut: number;
	/** Whether a write failed because storage was full. */
	ranOutOfRoom: boolean;
}

const noCounts = (): IImportCounts => ({
	worldsAdded: 0,
	worldsCopied: 0,
	worldsAlreadyHere: 0,
	worldsLeftOut: 0,
	backupsAdded: 0,
	backupsAlreadyHere: 0,
	backupsLeftOut: 0,
	ranOutOfRoom: false,
});

/** Write one entry, noting it in `written`; false (and the reason in `counts`) if the browser refused. */
const tryWrite = (key: string, value: string, written: string[], counts: IImportCounts) => {
	try {
		localStorage.setItem(key, value);
		written.push(key);
		return true;
	} catch (error) {
		counts.ranOutOfRoom ||= isStorageFull(error);
		return false;
	}
};

/** The text of every stored entry under `prefix`, to tell what's already here. */
const storedUnder = (prefix: string) => {
	const texts = new Set<string>();
	for (const [key, value] of collectBrowserItems()) {
		if (key.startsWith(prefix)) {
			texts.add(value);
		}
	}
	return texts;
};

/**
 * Add the export's backups beside this browser's, never overwriting one: a
 * backup this browser has exactly is skipped, one whose key is taken moves to
 * the next free time.
 */
const addBackups = (
	items: ReadonlyMap<string, string>,
	written: string[],
	counts: IImportCounts,
) => {
	const here = new Map([BACKUP_PREFIX, BROWSER_BACKUP_PREFIX].map((p) => [p, storedUnder(p)]));
	for (const [key, raw] of items) {
		if (kindOfKey(key) !== "backup") {
			continue;
		}
		const prefix = key.startsWith(BACKUP_PREFIX) ? BACKUP_PREFIX : BROWSER_BACKUP_PREFIX;
		const texts = here.get(prefix) ?? new Set();
		if (texts.has(raw)) {
			counts.backupsAlreadyHere++;
			continue;
		}
		const stamp = Number(key.slice(prefix.length));
		let at = Number.isSafeInteger(stamp) && stamp > 0 ? stamp : Date.now();
		while (getItem(`${prefix}${at}`) !== null) {
			at++;
		}
		if (tryWrite(`${prefix}${at}`, raw, written, counts)) {
			counts.backupsAdded++;
			texts.add(raw);
		} else {
			counts.backupsLeftOut++;
		}
	}
};

/**
 * Add an export's worlds and backups to this browser, beside its own
 * (ADR-0140). A world this browser already has exactly isn't added twice;
 * one whose id is taken by another world is added under a new id, so nothing
 * is overwritten. Settings stay as they are. Whatever doesn't fit is left
 * out and counted, and the list of worlds only ever names worlds that were
 * written.
 */
export const addToBrowser = (contents: IBrowserContents): IImportCounts => {
	const counts = noCounts();
	const written: string[] = [];
	const before = listWorlds();
	const worldsHere = storedUnder(WORLD_KEY_PREFIX);
	const added: IWorldInfo[] = [];
	for (const world of contents.worlds) {
		const raw = contents.items.get(world.id ? `${WORLD_KEY_PREFIX}${world.id}` : SINGLE_SAVE_KEY);
		if (raw === undefined) {
			continue;
		}
		if (worldsHere.has(raw)) {
			counts.worldsAlreadyHere++;
			continue;
		}
		const keepsId = WORLD_ID.test(world.id) && getItem(`${WORLD_KEY_PREFIX}${world.id}`) === null;
		const id = keepsId ? world.id : newWorldId();
		if (tryWrite(`${WORLD_KEY_PREFIX}${id}`, raw, written, counts)) {
			counts.worldsAdded++;
			if (!keepsId && world.id && before.some((here) => here.id === world.id)) {
				counts.worldsCopied++;
			}
			worldsHere.add(raw);
			added.push({ ...world, id });
		} else {
			counts.worldsLeftOut++;
		}
	}
	if (added.length > 0) {
		// Written after the worlds, and naming only those: if it can't be, the list finds them anyway.
		const index = [...before, ...added].sort((a, b) => b.updatedAt - a.updatedAt);
		tryWrite(WORLD_INDEX_KEY, JSON.stringify(index), [], counts);
	}
	addBackups(contents.items, written, counts);
	return counts;
};

/** What replacing this browser's worlds and settings with an export did. */
export type TReplaceResult =
	/** Done; the browser as it was is kept under `backupKey` (null: it kept nothing). */
	| { status: "replaced"; backupKey: string | null; counts: IImportCounts }
	/** Nothing changed: there wasn't room to keep a copy of this browser first. */
	| { status: "noRoomForCopy" }
	/**
	 * Nothing replaced: the export didn't fit (or the browser refused partway).
	 * `restored`: this browser is as it was; if not, its copy is kept under `backupKey`.
	 */
	| { status: "didNotFit"; restored: boolean; backupKey: string | null; ranOutOfRoom: boolean }
	/** Nothing changed: the browser doesn't let this site store anything. */
	| { status: "unavailable" };

/**
 * Replace this browser's worlds and settings with an export's (ADR-0140).
 * First the browser as it is (everything but its backups) is kept as one
 * backup, under `<app>:browser-backup:<time>`, in the export's own format:
 * File → Backups downloads it or adds its worlds back. Then this browser's
 * entries go and the export's are written: worlds, then the list of worlds
 * (naming only worlds written) and which is open, then settings; its
 * backups are added beside this browser's, which stay. All or nothing: if
 * anything can't be written, what was written goes and the browser is put
 * back as it was. Reload the page afterwards.
 */
export const replaceBrowser = (contents: IBrowserContents, now = Date.now()): TReplaceResult => {
	const current = collectBrowserItems();
	const replaced = new Map([...current].filter(([key]) => kindOfKey(key) !== "backup"));
	let at = now;
	while (getItem(`${BROWSER_BACKUP_PREFIX}${at}`) !== null) {
		at++;
	}
	// A browser that keeps nothing yet (but backups, which stay) needs no copy.
	const backupKey = replaced.size > 0 ? `${BROWSER_BACKUP_PREFIX}${at}` : null;
	try {
		if (backupKey) {
			localStorage.setItem(backupKey, makeBrowserExport(replaced, now));
		} else {
			// Storage is there at all: a browser that refuses everything changes nothing.
			localStorage.getItem(OPEN_WORLD_ID_KEY);
		}
	} catch (error) {
		return isStorageFull(error) ? { status: "noRoomForCopy" } : { status: "unavailable" };
	}

	const counts = noCounts();
	const written: string[] = [];
	let failed = false;
	try {
		for (const key of replaced.keys()) {
			localStorage.removeItem(key);
		}
	} catch {
		failed = true;
	}

	// Worlds first, under their own ids (or new ones, for ids that aren't one).
	const ids = new Map<string, string>();
	for (const world of failed ? [] : contents.worlds) {
		const key = world.id ? `${WORLD_KEY_PREFIX}${world.id}` : SINGLE_SAVE_KEY;
		const raw = contents.items.get(key);
		if (raw === undefined) {
			continue;
		}
		const id = !world.id || WORLD_ID.test(world.id) ? world.id : newWorldId();
		if (!tryWrite(id ? `${WORLD_KEY_PREFIX}${id}` : SINGLE_SAVE_KEY, raw, written, counts)) {
			counts.worldsLeftOut++;
			failed = true;
			break;
		}
		counts.worldsAdded++;
		ids.set(world.id, id);
	}

	// Then the list of worlds and which is open, naming only worlds written.
	if (!failed) {
		const index = contents.worlds
			.filter((world) => world.id && ids.has(world.id))
			.map((world) => ({ ...world, id: ids.get(world.id) ?? world.id }));
		failed = index.length > 0 && !tryWrite(WORLD_INDEX_KEY, JSON.stringify(index), written, counts);
		const open = contents.items.get(OPEN_WORLD_ID_KEY);
		// "" means "open a new world" (after starting fresh).
		const openId = open === "" ? "" : open === undefined ? undefined : ids.get(open);
		if (!failed && openId !== undefined) {
			failed = !tryWrite(OPEN_WORLD_ID_KEY, openId, written, counts);
		}
	}

	// Then the settings, exactly as they were.
	for (const [key, value] of failed ? [] : contents.items) {
		if (kindOfKey(key) === "setting" && !tryWrite(key, value, written, counts)) {
			failed = true;
			break;
		}
	}

	if (!failed) {
		addBackups(contents.items, written, counts);
		failed = counts.backupsLeftOut > 0;
	}

	if (!failed) {
		return { status: "replaced", backupKey, counts };
	}

	// Put the browser back as it was: what was written goes, what was there comes back.
	let restored = true;
	try {
		for (const key of written) {
			localStorage.removeItem(key);
		}
		for (const [key, value] of replaced) {
			localStorage.setItem(key, value);
		}
	} catch {
		restored = false;
	}
	if (restored && backupKey) {
		// It's all back where it was: the copy isn't needed.
		try {
			localStorage.removeItem(backupKey);
		} catch {
			// Kept: harmless.
		}
	}
	return { status: "didNotFit", restored, backupKey, ranOutOfRoom: counts.ranOutOfRoom };
};

/** A copy of a whole browser, kept before an import replaced it. */
export interface IBrowserBackup {
	key: string;
	/** When it was kept (ms since epoch). */
	savedAt: number;
	/** The copy, in the export's format. */
	raw: string;
}

/** Every copy of this browser kept before an import replaced it, newest first. */
export const listBrowserBackups = (): IBrowserBackup[] =>
	[...collectBrowserItems()]
		.filter(([key]) => key.startsWith(BROWSER_BACKUP_PREFIX))
		.map(([key, raw]) => ({
			key,
			savedAt: Number(key.slice(BROWSER_BACKUP_PREFIX.length)) || 0,
			raw,
		}))
		.sort((a, b) => b.savedAt - a.savedAt);

export const deleteBrowserBackup = (key: string) => {
	try {
		localStorage.removeItem(key);
	} catch (error) {
		console.warn("Could not delete the copy of this browser", error);
	}
};
