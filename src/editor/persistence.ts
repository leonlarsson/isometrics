import { APP_NAME } from "#/lib/app";
import { parseScene } from "#/scene/migrate";
import type { TScene } from "#/scene/schema";

import type { useEditor } from "./store";

/**
 * Local-first persistence: the scene autosaves to localStorage and can be
 * exported/imported as a JSON file. No backend. See docs/adr/0006.
 */
const STORAGE_KEY = `${APP_NAME.toLowerCase()}:scene`;

export const loadStoredScene = (): TScene | null => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return null;
		}
		return parseScene(JSON.parse(raw));
	} catch (error) {
		console.warn("Ignoring invalid saved scene", error);
		return null;
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
		.replace(/^-+|-+$/g, "") || "dashboard";

export const downloadScene = (scene: TScene) => {
	const blob = new Blob([JSON.stringify(scene, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${slugify(scene.meta.title)}.json`;
	link.click();
	URL.revokeObjectURL(url);
};

export const readSceneFile = async (file: File): Promise<TScene> => {
	return parseScene(JSON.parse(await file.text()));
};
