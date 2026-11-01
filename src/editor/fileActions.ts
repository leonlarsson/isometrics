import { repairWorld } from "#/parts/repairWorld";
import { describeRepairs } from "#/scene/repair";
import type { TScene } from "#/scene/schema";

import { rememberedView, rememberView, saveCameraNow } from "./cameraMemory";
import {
	createWorld,
	deleteWorld,
	downloadScene,
	type ISceneBackup,
	listWorlds,
	openStoredWorld,
	openWorldId,
	readSceneFile,
	readStoredWorld,
	resetBrowserSettings,
	saveScene,
} from "./persistence";
import { useEditor } from "./store";
import { notify } from "./toasts";
import { keepsOpenWorld } from "./whatIsOpen";

/**
 * File menu actions, shared by the menu and the keyboard shortcuts. They act on
 * the editor store directly, so they work from anywhere (menu item or hotkey).
 */

/** Ask the user for a file. Resolves with null if they cancel. */
export const pickFile = (accept: string) =>
	new Promise<File | null>((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
		input.addEventListener("cancel", () => resolve(null));
		input.click();
	});

/**
 * Show the open world in the editor, with the camera where it was in this
 * browser, else at the world's opening view.
 */
const showWorld = (scene: TScene) => {
	const { loadScene, showOpeningView } = useEditor.getState();
	loadScene(scene);
	showOpeningView(rememberedView(openWorldId()));
};

/**
 * Save the open world right away before switching to another one, so the
 * last edits (still waiting for autosave) land in it. An untouched starting
 * world that was never saved isn't added to the list, nor is a world from a
 * link that isn't kept (ADR-0121), and nothing is open on the home screen.
 */
const saveBeforeSwitching = () => {
	saveCameraNow();
	const { scene, past, whatIsOpen } = useEditor.getState();
	if (!keepsOpenWorld(whatIsOpen)) {
		return;
	}
	if (openWorldId() || past.length > 0) {
		saveScene(scene);
	}
};

/** `title`, or "title 2", "title 3"… if a saved world is already called that. */
const uniqueTitle = (title: string) => {
	const taken = new Set(listWorlds().map((world) => world.title));
	let candidate = title;
	for (let n = 2; taken.has(candidate); n++) {
		candidate = `${title} ${n}`;
	}
	return candidate;
};

/**
 * Open `scene` as a new world, next to the others (ADR-0044). It gets a title
 * no other saved world has, so the list of worlds can tell them apart. A copy
 * passes the world it copies, so its camera starts where that one's was.
 */
export const startNewWorld = (scene: TScene, copiedFrom: string | null = null) => {
	saveBeforeSwitching();
	const view = rememberedView(copiedFrom);
	const world = { ...scene, meta: { ...scene.meta, title: uniqueTitle(scene.meta.title) } };
	const id = createWorld(world);
	if (view) {
		rememberView(id, view);
	}
	showWorld(world);
};

/** Switch to a world saved in this browser. */
export const openSavedWorld = (id: string) => {
	// Already showing it (not a preview over it, nor the home screen with it stored as open).
	if (id === openWorldId() && keepsOpenWorld(useEditor.getState().whatIsOpen)) {
		return;
	}
	saveBeforeSwitching();
	const result = openStoredWorld(id);
	if (result.status === "ok" || result.status === "repaired") {
		showWorld(result.scene);
	}
	if (result.status === "repaired") {
		notify("Opened with repairs", `${result.summary} The original is kept under File → Backups.`);
	}
	if (result.status === "unreadable") {
		notify(
			"That world can’t be opened",
			`${result.reason}. A copy is kept under File → Backups.`,
			"error",
		);
	}
	if (result.status === "empty") {
		notify("That world is gone", "It may have been deleted in another tab.", "error");
	}
};

const copyOf = (scene: TScene): TScene => ({
	...scene,
	meta: { ...scene.meta, title: `${scene.meta.title} (copy)` },
});

/** Copy the open world into a new one, named "… (copy)", and switch to it. */
export const duplicateWorld = () => {
	if (useEditor.getState().whatIsOpen.kind === "world") {
		startNewWorld(copyOf(useEditor.getState().scene), openWorldId());
	}
};

/** Copy any saved world into a new one, named "… (copy)", and switch to it. */
export const duplicateSavedWorld = (id: string) => {
	if (id === openWorldId()) {
		duplicateWorld();
		return;
	}
	const result = readStoredWorld(id);
	if (result.status === "ok" || result.status === "repaired") {
		startNewWorld(copyOf(result.scene), id);
	} else {
		notify("That world can’t be copied", "It couldn’t be read.", "error");
	}
};

/**
 * Reset this browser's settings, keeping the worlds (editor/persistence),
 * after saving the open world, then reload so everything starts from its
 * default.
 */
export const resetThisBrowsersSettings = () => {
	saveBeforeSwitching();
	if (resetBrowserSettings()) {
		window.location.reload();
	} else {
		notify("Nothing was reset", "The browser refused to change this site’s storage.", "error");
	}
};

/**
 * Delete the open world (it's kept as a backup first) and open the most
 * recently edited other one, or the home screen if there's none (ADR-0121).
 * A world from a link that isn't kept isn't in the list: nothing to delete.
 */
export const deleteOpenWorld = () => {
	if (!keepsOpenWorld(useEditor.getState().whatIsOpen)) {
		return;
	}
	const id = openWorldId();
	if (id && !deleteWorld(id)) {
		notify(
			"The world wasn’t deleted",
			"It couldn’t be backed up first. Save it to a file, then try again.",
			"error",
		);
		return;
	}
	const next = listWorlds()[0];
	const result = next ? openStoredWorld(next.id) : null;
	if (result && (result.status === "ok" || result.status === "repaired")) {
		showWorld(result.scene);
	} else {
		useEditor.getState().setWhatIsOpen({ kind: "home", why: { kind: "noWorlds" } });
	}
	notify("World deleted", "A copy is kept under File → Backups.", "success");
};

/** Delete any saved world (kept as a backup first); the open one is replaced as above. */
export const deleteSavedWorld = (id: string) => {
	if (id === openWorldId() && keepsOpenWorld(useEditor.getState().whatIsOpen)) {
		deleteOpenWorld();
		return;
	}
	if (!deleteWorld(id)) {
		notify(
			"The world wasn’t deleted",
			"It couldn’t be backed up first. Open it and save it to a file, then try again.",
			"error",
		);
		return;
	}
	notify("World deleted", "A copy is kept under File → Backups.", "success");
};

/** Open a backup as a new world (repaired if needed); the backup itself stays as it is. */
export const restoreBackup = (backup: ISceneBackup) => {
	try {
		const { scene, report } = repairWorld(JSON.parse(backup.raw));
		startNewWorld(scene);
		notify(
			"Backup restored",
			report
				? `It opened as a new world, with repairs: ${describeRepairs(report)}`
				: "It opened as a new world. The backup is still kept.",
			"success",
		);
	} catch (error) {
		const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
		notify("That backup can’t be opened", `${reason}. Download it to keep it as a file.`, "error");
	}
};

/** Let the user pick a world file and open it as a new world. */
export const openWorldFile = async () => {
	const file = await pickFile("application/json,.json");
	if (!file) {
		return;
	}
	try {
		const { scene, repairs } = await readSceneFile(file);
		startNewWorld(scene);
		if (repairs) {
			// The file itself is untouched on disk; only the opened copy was repaired (ADR-0026).
			notify("Opened with repairs", repairs);
		}
	} catch (error) {
		const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
		notify("That file isn’t a valid world", reason, "error");
	}
};

/**
 * Keep the world from a link that's open as a preview (ADR-0121): a new world
 * of one's own in this browser, next to the others, saved from now on, with a
 * title no other saved world has. Nothing is reloaded: it stays as it is on
 * screen, with its undo history.
 */
export const keepPreview = () => {
	const { scene, whatIsOpen } = useEditor.getState();
	if (whatIsOpen.kind !== "world" || !whatIsOpen.preview) {
		return;
	}
	const title = uniqueTitle(scene.meta.title);
	const kept = title === scene.meta.title ? scene : { ...scene, meta: { ...scene.meta, title } };
	createWorld(kept);
	useEditor.setState({ scene: kept, whatIsOpen: { kind: "world", preview: null } });
	saveCameraNow();
};

/**
 * Close the world from a link that's open as a preview, keeping nothing: back
 * to the world of one's own that was open (or the latest), else the home screen.
 */
export const closePreview = () => {
	const id = openWorldId() ?? listWorlds()[0]?.id ?? null;
	const result = id ? openStoredWorld(id) : null;
	if (result && (result.status === "ok" || result.status === "repaired")) {
		showWorld(result.scene);
	} else {
		useEditor.getState().setWhatIsOpen({ kind: "home", why: { kind: "closed" } });
	}
};

/** Download the open world as a JSON file. */
export const saveWorldFile = () => {
	// Nothing to save on the home screen, or while a link is opening.
	if (useEditor.getState().whatIsOpen.kind === "world") {
		downloadScene(useEditor.getState().scene);
	}
};
