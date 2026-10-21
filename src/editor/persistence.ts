import { APP_NAME } from "#/lib/app";
import { parseScene } from "#/scene/migrate";
import type { TScene } from "#/scene/schema";

import type { useEditor } from "./store";

/**
 * Local-first persistence: the scene autosaves to localStorage and can be
 * exported/imported as a JSON file. No backend. See docs/adr/0006.
 *
 * A saved world that this version can't read is never thrown away: it's
 * copied to a backup key before anything can overwrite it (ADR-0020).
 */
const STORAGE_KEY = `${APP_NAME.toLowerCase()}:scene`;
const BACKUP_PREFIX = `${APP_NAME.toLowerCase()}:scene-backup:`;
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

export const loadStoredScene = (): TStoredSceneResult => {
	let raw: string | null;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch {
		return { status: "empty" }; // storage unavailable (private mode etc.)
	}
	if (!raw) {
		return { status: "empty" };
	}
	try {
		return { status: "ok", scene: parseScene(JSON.parse(raw)) };
	} catch (error) {
		console.warn("Saved world can't be read by this version; keeping a backup", error);
		return { status: "unreadable", raw, backup: backUpRaw(raw), reason: describeError(error) };
	}
};

export const saveScene = (scene: TScene) => {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
	} catch (error) {
		console.warn("Could not save scene", error);
	}
};

/** Save the scene shortly after every change. Returns an unsubscribe function. */
export const startAutosave = (store: typeof useEditor, delayMs = 300) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const unsubscribe = store.subscribe((state, previous) => {
		if (state.scene === previous.scene) {
			return;
		}
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

export const readSceneFile = async (file: File): Promise<TScene> => {
	return parseScene(JSON.parse(await file.text()));
};
