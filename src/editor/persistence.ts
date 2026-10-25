import { nanoid } from "nanoid";
import { useSyncExternalStore } from "react";

import { APP_NAME } from "#/lib/app";
import { describeRepairs, parseOrRepairScene } from "#/scene/repair";
import type { TScene } from "#/scene/schema";

import { adoptUnsavedView, forgetView, UNSAVED_WORLD } from "./cameraMemory";
import type { useEditor } from "./store";
import { notify } from "./toasts";

/**
 * Local-first persistence: worlds autosave to localStorage and can be
 * exported/imported as JSON files. No backend. See docs/adr/0006.
 *
 * The browser keeps several worlds (ADR-0044): each under its own key, with a
 * small index for listing them and the id of the one that's open.
 *
 * A saved world that this version can't read is never thrown away: it's
 * copied to a backup key before anything can overwrite it (ADR-0020). If
 * most of it can still be read, it's repaired and opened (ADR-0026).
 */
const PREFIX = APP_NAME.toLowerCase();
/** The single saved world from before there were several (moved into a slot on load). */
const SINGLE_SAVE_KEY = `${PREFIX}:scene`;
const WORLD_KEY_PREFIX = `${PREFIX}:world:`;
const WORLD_INDEX_KEY = `${PREFIX}:world-index`;
const OPEN_WORLD_ID_KEY = `${PREFIX}:open-world-id`;
const BACKUP_PREFIX = `${PREFIX}:scene-backup:`;
/** Stored as the open world's id to mean "open a new one" (after starting fresh). */
const START_FRESH = "";
/** Oldest backups beyond this many are deleted. */
const MAX_BACKUPS = 5;

export interface ISceneBackup {
	key: string;
	/** When the backup was made (ms since epoch). */
	savedAt: number;
	/** The saved data exactly as it was stored. */
	raw: string;
}

export type TStoredSceneResult =
	| { status: "empty" }
	| { status: "ok"; scene: TScene }
	/** The save needed repairs (ADR-0026); the original has been kept as a backup (null if that failed). */
	| { status: "repaired"; scene: TScene; raw: string; backup: ISceneBackup | null; summary: string }
	/** The save exists but can't be read; it has been kept as a backup (null if that failed). */
	| { status: "unreadable"; raw: string; backup: ISceneBackup | null; reason: string };

/** A short, single-line reason: the first validation issue ("where: what"), or the error message. */
const describeError = (error: unknown) => {
	const issues = (error as { issues?: { path?: PropertyKey[]; message?: string }[] }).issues;
	if (Array.isArray(issues) && issues[0]) {
		const { path = [], message = "invalid" } = issues[0];
		const where = path.map(String).join(".");
		return (where ? `${where}: ${message}` : message).slice(0, 200);
	}
	return error instanceof Error ? error.message.split("\n")[0].slice(0, 200) : String(error);
};

/**
 * What browsers let one site keep in localStorage, in characters (keys plus
 * values; any character counts as one). The HTML spec suggests "a mostly
 * arbitrary limit of five megabytes per origin"; Chromium 156 measures exactly
 * 5 × 1024 × 1024 characters. Others are close, so it's shown as "about 5 MB".
 */
export const STORAGE_LIMIT_CHARS = 5 * 1024 * 1024;

/** How much of this site's storage is in use, in characters (keys and values). */
export interface IStorageUsage {
	worlds: number;
	backups: number;
	/** Everything this site stores, including the index and settings. */
	total: number;
}

export const storageUsage = (): IStorageUsage => {
	const usage: IStorageUsage = { worlds: 0, backups: 0, total: 0 };
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key === null) {
				continue;
			}
			const size = key.length + (localStorage.getItem(key)?.length ?? 0);
			usage.total += size;
			if (key.startsWith(WORLD_KEY_PREFIX)) {
				usage.worlds += size;
			} else if (key.startsWith(BACKUP_PREFIX)) {
				usage.backups += size;
			}
		}
	} catch {
		// Storage unavailable: nothing is in use.
	}
	return usage;
};

/** Every scene backup in this browser, newest first. */
export const listSceneBackups = (): ISceneBackup[] => {
	try {
		const backups: ISceneBackup[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key?.startsWith(BACKUP_PREFIX)) {
				continue;
			}
			const raw = localStorage.getItem(key);
			if (raw !== null) {
				backups.push({ key, savedAt: Number(key.slice(BACKUP_PREFIX.length)) || 0, raw });
			}
		}
		return backups.sort((a, b) => b.savedAt - a.savedAt);
	} catch {
		return [];
	}
};

export const deleteSceneBackup = (key: string) => {
	try {
		localStorage.removeItem(key);
	} catch (error) {
		console.warn("Could not delete backup", error);
	}
};

/** Keep `raw` as a backup (once: an identical backup is reused) and trim old ones. */
const backUpRaw = (raw: string): ISceneBackup | null => {
	const existing = listSceneBackups().find((backup) => backup.raw === raw);
	if (existing) {
		return existing;
	}
	try {
		const savedAt = Date.now();
		const backup = { key: `${BACKUP_PREFIX}${savedAt}`, savedAt, raw };
		localStorage.setItem(backup.key, raw);
		for (const old of listSceneBackups().slice(MAX_BACKUPS)) {
			deleteSceneBackup(old.key);
		}
		return backup;
	} catch (error) {
		console.warn("Could not back up the unreadable save", error);
		return null;
	}
};

/** A saved world in the list (the world itself is stored separately). */
export interface IWorldInfo {
	id: string;
	/** The world's title (meta.title) when it was last saved. */
	title: string;
	/** When it was last saved (ms since epoch). */
	updatedAt: number;
}

const worldKey = (id: string) => `${WORLD_KEY_PREFIX}${id}`;

const getItem = (key: string) => {
	try {
		return localStorage.getItem(key);
	} catch {
		return null; // storage unavailable (private mode etc.)
	}
};

/** The title stored in a world's raw text, if it can be read. */
const titleOf = (raw: string) => {
	try {
		const title = (JSON.parse(raw) as { meta?: { title?: unknown } }).meta?.title;
		return typeof title === "string" && title.trim() ? title : "Untitled world";
	} catch {
		return "Unreadable world";
	}
};

const writeIndex = (worlds: IWorldInfo[]) => {
	try {
		localStorage.setItem(WORLD_INDEX_KEY, JSON.stringify(worlds));
	} catch (error) {
		console.warn("Could not save the list of worlds", error);
	}
};

/**
 * Every saved world, most recently edited first. The index is checked
 * against the stored worlds, so a world missing from it (or an index that
 * can't be read) still shows up.
 */
export const listWorlds = (): IWorldInfo[] => {
	let indexed: IWorldInfo[] = [];
	try {
		const parsed = JSON.parse(getItem(WORLD_INDEX_KEY) ?? "[]") as unknown;
		if (Array.isArray(parsed)) {
			indexed = parsed.filter(
				(item): item is IWorldInfo =>
					typeof item?.id === "string" &&
					typeof item.title === "string" &&
					typeof item.updatedAt === "number",
			);
		}
	} catch {
		// Rebuilt from the stored worlds below.
	}
	const stored = new Set<string>();
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(WORLD_KEY_PREFIX)) {
				stored.add(key.slice(WORLD_KEY_PREFIX.length));
			}
		}
	} catch {
		return [];
	}
	const worlds = indexed.filter((world) => stored.has(world.id));
	for (const id of stored) {
		if (!worlds.some((world) => world.id === id)) {
			worlds.push({ id, title: titleOf(getItem(worldKey(id)) ?? ""), updatedAt: 0 });
		}
	}
	return worlds.sort((a, b) => b.updatedAt - a.updatedAt);
};

/** Record a world in the index (title and time), keeping the rest. */
const touchWorld = (id: string, title: string) => {
	const others = listWorlds().filter((world) => world.id !== id);
	writeIndex([{ id, title, updatedAt: Date.now() }, ...others]);
};

/** The open world's id as stored, whether or not that world has been written yet. */
const storedOpenWorldId = () => getItem(OPEN_WORLD_ID_KEY) || null;

/** The world that's open (the one autosave writes to), if it's stored. */
export const openWorldId = (): string | null => {
	const id = storedOpenWorldId();
	return id && getItem(worldKey(id)) !== null ? id : null;
};

const setOpenWorldId = (id: string | null) => {
	try {
		if (id) {
			localStorage.setItem(OPEN_WORLD_ID_KEY, id);
		} else {
			localStorage.removeItem(OPEN_WORLD_ID_KEY);
		}
	} catch {
		// Storage unavailable: nothing to remember.
	}
};

/**
 * Move the single saved world from before there were several into its own
 * slot, exactly as stored. The old key is only removed once the copy is
 * written (and not at all if it can't be), so nothing is lost.
 */
const moveSingleSaveIntoList = () => {
	const raw = getItem(SINGLE_SAVE_KEY);
	if (raw === null) {
		return;
	}
	try {
		const existing = listWorlds().find((world) => getItem(worldKey(world.id)) === raw);
		const id = existing?.id ?? nanoid(10);
		if (!existing) {
			localStorage.setItem(worldKey(id), raw);
			touchWorld(id, titleOf(raw));
		}
		if (!openWorldId()) {
			setOpenWorldId(id);
		}
		localStorage.removeItem(SINGLE_SAVE_KEY);
	} catch (error) {
		console.warn("Could not move the saved world into the list of worlds", error);
	}
};

/** Read one stored world: as it is, repaired (original backed up), or unreadable (backed up). */
const readWorld = (raw: string): TStoredSceneResult => {
	try {
		const { scene, report } = parseOrRepairScene(JSON.parse(raw));
		if (!report) {
			return { status: "ok", scene };
		}
		console.warn("Saved world needed repairs; keeping the original as a backup", report);
		return {
			status: "repaired",
			scene,
			raw,
			backup: backUpRaw(raw),
			summary: describeRepairs(report),
		};
	} catch (error) {
		console.warn("Saved world can't be read by this version; keeping a backup", error);
		return { status: "unreadable", raw, backup: backUpRaw(raw), reason: describeError(error) };
	}
};

/**
 * Load the world to open on start: the one that was open, or else the most
 * recently edited one. Moves an old single save into the list first.
 */
export const loadStoredScene = (): TStoredSceneResult => {
	moveSingleSaveIntoList();
	// Started fresh after a crash (see startFreshAfterCrash): open a new world.
	if (getItem(OPEN_WORLD_ID_KEY) === START_FRESH) {
		return { status: "empty" };
	}
	const id = openWorldId() ?? listWorlds()[0]?.id ?? null;
	const raw = id ? getItem(worldKey(id)) : null;
	if (!id || raw === null) {
		return { status: "empty" };
	}
	setOpenWorldId(id);
	const result = readWorld(raw);
	if (result.status === "ok") {
		openedSaved(id);
	}
	return result;
};

/** Read a stored world without opening it (e.g. to copy it). */
export const readStoredWorld = (id: string): TStoredSceneResult => {
	const raw = getItem(worldKey(id));
	return raw === null ? { status: "empty" } : readWorld(raw);
};

/**
 * Open a stored world: it becomes the open one if it can be read (as it
 * is, or repaired). An unreadable world is backed up and left as it was.
 */
export const openStoredWorld = (id: string): TStoredSceneResult => {
	const raw = getItem(worldKey(id));
	if (raw === null) {
		return { status: "empty" };
	}
	const result = readWorld(raw);
	if (result.status === "ok" || result.status === "repaired") {
		setOpenWorldId(id);
	}
	if (result.status === "ok") {
		openedSaved(id);
	}
	return result;
};

let warnedFull = false;
/** Set by `wipeEverything`: nothing is saved any more, until the page reloads. */
let wiped = false;

/**
 * Whether the open world is saved, for the toolbar's save status (ADR-0057).
 * `new`: nothing to save yet (a first visit's starter world, before any change);
 * `saving`: a change is waiting for the autosave; `saved`: written, `at` when
 * (0 if unknown); `failed`: the browser refused, because its storage for the
 * site is full, it doesn't allow storage at all, or everything was just wiped.
 */
export type TSaveStatus =
	| { state: "new" }
	| { state: "saving" }
	| { state: "saved"; at: number }
	| { state: "failed"; reason: "full" | "unavailable" | "wiped" };

let saveStatus: TSaveStatus = { state: "new" };
const saveStatusListeners = new Set<() => void>();

const setSaveStatus = (next: TSaveStatus) => {
	saveStatus = next;
	for (const listener of saveStatusListeners) {
		listener();
	}
};

export const readSaveStatus = () => saveStatus;

/** Call `listener` whenever the save status changes. */
export const subscribeSaveStatus = (listener: () => void) => {
	saveStatusListeners.add(listener);
	return () => {
		saveStatusListeners.delete(listener);
	};
};

const NEW: TSaveStatus = { state: "new" };

/** The open world's save status, updating as it changes. */
export const useSaveStatus = () =>
	useSyncExternalStore(subscribeSaveStatus, readSaveStatus, () => NEW);

/** A world that was just opened from storage is saved as of its last save. */
const openedSaved = (id: string) =>
	setSaveStatus({
		state: "saved",
		at: listWorlds().find((world) => world.id === id)?.updatedAt ?? 0,
	});

/** Full storage, or none at all (private browsing, blocked site data)? */
const failureReason = (error: unknown): "full" | "unavailable" =>
	error instanceof DOMException &&
	(error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
		? "full"
		: "unavailable";

/** Write a world into its slot and the index; says so once if it can't. */
const writeWorld = (id: string, scene: TScene) => {
	if (wiped) {
		setSaveStatus({ state: "failed", reason: "wiped" });
		return;
	}
	try {
		localStorage.setItem(worldKey(id), JSON.stringify(scene));
		touchWorld(id, scene.meta.title);
		warnedFull = false;
		setSaveStatus({ state: "saved", at: Date.now() });
	} catch (error) {
		console.warn("Could not save scene", error);
		const reason = failureReason(error);
		setSaveStatus({ state: "failed", reason });
		if (!warnedFull) {
			warnedFull = true;
			notify(
				"Couldn’t save your world",
				reason === "full"
					? "The browser’s storage for this site is full. Save it to a file, or delete worlds you no longer need."
					: "This browser doesn’t let the site store anything (private browsing or blocked site data). Save it to a file to keep it.",
				"error",
			);
		}
	}
};

/** Save `scene` into the open world (creating one if none is open yet). */
export const saveScene = (scene: TScene) => {
	if (wiped) {
		setSaveStatus({ state: "failed", reason: "wiped" });
		return;
	}
	let id = storedOpenWorldId();
	if (!id) {
		id = nanoid(10);
		setOpenWorldId(id);
		// Where the camera was while it wasn't saved yet goes with it.
		adoptUnsavedView(id);
	}
	writeWorld(id, scene);
};

/** Store `scene` as a new world and make it the open one. Returns its id. */
export const createWorld = (scene: TScene): string => {
	const id = nanoid(10);
	setOpenWorldId(id);
	writeWorld(id, scene);
	// A different world: the camera of the unsaved starter it replaces isn't its own.
	forgetView(UNSAVED_WORLD);
	return id;
};

/**
 * Delete a stored world, after keeping it as a backup (ADR-0020). Returns
 * false (and deletes nothing) if the backup couldn't be made.
 */
export const deleteWorld = (id: string): boolean => {
	const raw = getItem(worldKey(id));
	if (raw !== null && !backUpRaw(raw)) {
		return false;
	}
	try {
		localStorage.removeItem(worldKey(id));
	} catch {
		return false;
	}
	writeIndex(listWorlds().filter((world) => world.id !== id));
	forgetView(id);
	if (getItem(OPEN_WORLD_ID_KEY) === id) {
		setOpenWorldId(null);
	}
	return true;
};

/** The open world exactly as stored, or null if there is none (or storage is unavailable). */
export const readSavedRaw = (): string | null => {
	const id = openWorldId();
	return id ? getItem(worldKey(id)) : null;
};

/**
 * Start fresh after a crash: the next load opens a new world instead of the
 * open one, which stays in the list and is also kept as a backup
 * (ADR-0020). Returns false (and changes nothing) if the backup couldn't be made.
 */
export const startFreshAfterCrash = (): boolean => {
	const raw = readSavedRaw();
	if (raw && !backUpRaw(raw)) {
		return false;
	}
	try {
		// Not even the most recent world: that may be the one that crashed.
		localStorage.setItem(OPEN_WORLD_ID_KEY, START_FRESH);
	} catch {
		return false;
	}
	return true;
};

/**
 * Delete everything this app keeps in the browser: every world, every backup,
 * which world was open and preferences such as panel sizes. Deliberately with
 * no backup (ADR-0045): the user confirmed twice. Saving stops, so a pending
 * autosave can't write the open world back; reload the page afterwards.
 * Returns false if the browser refused.
 */
export const wipeEverything = (): boolean => {
	wiped = true;
	try {
		localStorage.clear();
		sessionStorage.clear();
		return true;
	} catch (error) {
		console.warn("Could not wipe the browser storage", error);
		return false;
	}
};

/** What resetting the browser's settings keeps: the worlds, their backups, which is open. */
const KEPT_BY_SETTINGS_RESET = [
	WORLD_KEY_PREFIX,
	WORLD_INDEX_KEY,
	OPEN_WORLD_ID_KEY,
	SINGLE_SAVE_KEY,
	BACKUP_PREFIX,
	// Seen the offer to start fresh after a big update: not offered again for a settings reset.
	`${PREFIX}:fresh-start-seen`,
];

/**
 * Forget every setting this app keeps in the browser (panel sizes and folds,
 * Add to scene's favourites and recent, where the camera was in each world,
 * Preferences), keeping the worlds and their backups. Reload the page
 * afterwards so everything starts from its default. Returns false if the
 * browser refused.
 */
export const resetBrowserSettings = (): boolean => {
	try {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (
				key?.startsWith(`${PREFIX}:`) &&
				!KEPT_BY_SETTINGS_RESET.some((kept) => key === kept || key.startsWith(kept))
			) {
				keys.push(key);
			}
		}
		for (const key of keys) {
			localStorage.removeItem(key);
		}
		return true;
	} catch (error) {
		console.warn("Could not reset the browser's settings", error);
		return false;
	}
};

/** Save the scene shortly after every change. Returns an unsubscribe function. */
export const startAutosave = (store: typeof useEditor, delayMs = 300) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const unsubscribe = store.subscribe((state, previous) => {
		if (state.scene === previous.scene) {
			return;
		}
		setSaveStatus(wiped ? { state: "failed", reason: "wiped" } : { state: "saving" });
		clearTimeout(timer);
		timer = setTimeout(() => saveScene(state.scene), delayMs);
	});
	return () => {
		clearTimeout(timer);
		unsubscribe();
	};
};

const slugify = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "world";

const downloadText = (filename: string, text: string) => {
	const blob = new Blob([text], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
};

export const downloadScene = (scene: TScene) =>
	downloadText(`${slugify(scene.meta.title)}.json`, JSON.stringify(scene, null, 2));

/** Download a backup exactly as it was stored, named after its world if possible. */
export const downloadSceneBackup = (backup: ISceneBackup) => {
	let title = "world";
	try {
		const parsed = JSON.parse(backup.raw) as { meta?: { title?: unknown } };
		if (typeof parsed.meta?.title === "string") {
			title = parsed.meta.title;
		}
	} catch {
		// Not even valid JSON: still download it as-is.
	}
	const date = new Date(backup.savedAt || Date.now()).toISOString().slice(0, 10);
	downloadText(`${slugify(title)}-backup-${date}.json`, backup.raw);
};

/**
 * Read a world file, repairing it if needed (ADR-0026). `repairs` describes
 * what changed, or is null if the file was fine. Throws if it isn't a world.
 */
export const readSceneFile = async (
	file: File,
): Promise<{ scene: TScene; repairs: string | null }> => {
	const { scene, report } = parseOrRepairScene(JSON.parse(await file.text()));
	return { scene, repairs: report ? describeRepairs(report) : null };
};
