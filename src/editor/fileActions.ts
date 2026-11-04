import { repairWorld } from "#/parts/repairWorld";
import { plural } from "#/scene/format";
import { describeRepairs } from "#/scene/repair";
import type { TScene } from "#/scene/schema";

import {
	addToBrowser,
	BrowserExportError,
	browserExportFileName,
	checkExportSize,
	collectBrowserItems,
	contentsOf,
	type IBrowserBackup,
	type IBrowserContents,
	type IImportCounts,
	makeBrowserExport,
	readBrowserExport,
	replaceBrowser,
} from "./browserExport";
import { rememberedView, rememberView, saveCameraNow } from "./cameraMemory";
import {
	createWorld,
	deleteWorld,
	downloadScene,
	downloadText,
	formatStorageSize,
	type ISceneBackup,
	listWorlds,
	openStoredWorld,
	openWorldId,
	readSceneFile,
	readStoredWorld,
	resetBrowserSettings,
	saveScene,
	stopSavingUntilReload,
	worldListChanged,
} from "./persistence";
import { useEditor } from "./store";
import { notify, notifyAfterReload } from "./toasts";
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
 * Delete the open world (it's kept as a backup first) and show the home
 * screen, never another world in its place (ADR-0132): one's other worlds
 * are listed there to pick from. A world from a link that isn't kept isn't
 * in the list: nothing to delete.
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
	useEditor.getState().setWhatIsOpen({
		kind: "home",
		why: listWorlds().length === 0 ? { kind: "noWorlds" } : { kind: "deleted" },
	});
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

/**
 * Download everything this app keeps in this browser as one file (ADR-0140),
 * after saving the open world, so its last edits are in it.
 */
export const exportThisBrowser = () => {
	saveBeforeSwitching();
	const items = collectBrowserItems();
	if (items.size === 0) {
		notify(
			"Nothing to export yet",
			"This browser keeps nothing for this site yet: a world is kept once it’s changed.",
		);
		return;
	}
	const now = Date.now();
	const text = makeBrowserExport(items, now);
	downloadText(browserExportFileName(now), text);
	const { worlds, backups, settings } = contentsOf(items);
	notify(
		"This browser is exported",
		`${plural(worlds.length, "world")}, ${plural(backups, "backup")} and ${plural(settings, "setting")}, ${formatStorageSize(text.length)} in all. Import a browser’s export… brings them back, here or in another browser.`,
		"success",
	);
};

/** Let the user pick a browser's export and read it; null (after saying why) if it isn't one. */
export const pickBrowserExport = async (): Promise<IBrowserContents | null> => {
	const file = await pickFile("application/json,.json");
	if (!file) {
		return null;
	}
	try {
		checkExportSize(file.size);
		return readBrowserExport(await file.text());
	} catch (error) {
		notify(
			"That file can’t be imported",
			error instanceof BrowserExportError ? error.message : "It couldn’t be read.",
			"error",
		);
		return null;
	}
};

/** What adding an export did, in words: a title, a line, and whether something was left out. */
export const describeAdded = (counts: IImportCounts, withSettings = false) => {
	const leftOut = counts.worldsLeftOut + counts.backupsLeftOut + counts.settingsLeftOut;
	const added = counts.worldsAdded + counts.backupsAdded;
	const lines: string[] = [];
	if (added > 0) {
		lines.push(
			`Added ${plural(counts.worldsAdded, "world")} and ${plural(counts.backupsAdded, "backup")}.`,
		);
	}
	if (counts.worldsCopied > 0) {
		lines.push(
			`${plural(counts.worldsCopied, "world")} went in as a copy, beside a different world here with the same id.`,
		);
	}
	if (counts.worldsAlreadyHere + counts.backupsAlreadyHere > 0) {
		lines.push(
			`${plural(counts.worldsAlreadyHere, "world")} and ${plural(counts.backupsAlreadyHere, "backup")} were here already.`,
		);
	}
	if (leftOut > 0) {
		lines.push(
			`${plural(counts.worldsLeftOut, "world")}, ${plural(counts.backupsLeftOut, "backup")} and ${plural(counts.settingsLeftOut, "setting")} weren’t added: ${counts.ranOutOfRoom ? "the browser’s storage for this site is full" : "the browser refused to store them"}. Delete worlds or backups you don’t need and import again: what’s here won’t be added twice.`,
		);
	}
	lines.push(
		withSettings
			? `${plural(counts.settingsTaken, "setting")} from it took the place of this browser’s; allowed external sources stay as they were.`
			: "Your settings are as they were.",
	);
	return {
		title:
			leftOut > 0
				? "Not everything was added"
				: added + counts.settingsTaken > 0
					? "Added to this browser"
					: "Nothing new to add",
		text: lines.join(" "),
		isProblem: leftOut > 0,
	};
};

/**
 * Add an export's worlds and backups beside this browser's (ADR-0140),
 * after saving the open world; the open world stays as it is. Settings stay
 * too, unless `withSettings`: then the file's take the place of this
 * browser's, and the page reloads so everything reads them.
 */
export const addBrowserExport = (contents: IBrowserContents, withSettings = false) => {
	saveBeforeSwitching();
	const counts = addToBrowser(contents, { withSettings });
	const { title, text, isProblem } = describeAdded(counts, withSettings);
	const tone = isProblem ? "error" : "success";
	if (counts.settingsTaken > 0) {
		notifyAfterReload(title, text, tone);
		window.location.reload();
		return;
	}
	worldListChanged();
	notify(title, text, tone);
};

/**
 * Replace this browser's worlds and settings with an export's (ADR-0140),
 * after saving the open world and keeping a copy of this browser under
 * File → Backups; then start again from the plain address, as the export left it.
 */
export const replaceWithBrowserExport = (contents: IBrowserContents) => {
	saveBeforeSwitching();
	const result = replaceBrowser(contents);
	switch (result.status) {
		case "replaced":
			stopSavingUntilReload();
			notifyAfterReload(
				"This browser’s worlds and settings are replaced",
				[
					`${plural(result.counts.worldsAdded, "world")} came in, and ${plural(result.counts.backupsAdded, "backup")} joined yours.`,
					result.backupKey ? "This browser as it was is kept under File → Backups." : "",
					"Allowed external sources stay as they were.",
				]
					.filter(Boolean)
					.join(" "),
				"success",
			);
			window.location.assign("/");
			return;
		case "noRoomForCopy":
			notify(
				"Nothing was replaced",
				"There isn’t room to keep a copy of this browser first. To make room: Export this browser to keep it as a file, Wipe everything, then import again.",
				"error",
			);
			return;
		case "unavailable":
			notify("Nothing was replaced", "The browser refused to change this site’s storage.", "error");
			return;
		case "didNotFit":
			if (result.restored) {
				notify(
					"Nothing was replaced",
					`${result.ranOutOfRoom ? "The export didn’t fit in the browser’s storage for this site beside a copy of what’s here" : "The browser refused partway"}, so this browser is as it was. To make room: Export this browser to keep it as a file, Wipe everything, then import again.`,
					"error",
				);
				return;
			}
			// Mixed now: nothing may save over it until the person has looked.
			stopSavingUntilReload();
			notify(
				"This browser couldn’t be put back as it was",
				"The export didn’t fit, and not everything could be put back. A copy of this browser as it was is kept under File → Backups: download it before anything else.",
				"error",
			);
	}
};

/** Download a copy of this browser kept before an import replaced it, as an export file. */
export const downloadBrowserBackup = (backup: IBrowserBackup) =>
	downloadText(browserExportFileName(backup.savedAt || Date.now()), backup.raw);

/** Add the worlds and backups of a copy of this browser (kept before an import replaced it) back. */
export const addBrowserBackup = (backup: IBrowserBackup) => {
	try {
		addBrowserExport(readBrowserExport(backup.raw));
	} catch (error) {
		notify(
			"That copy can’t be read",
			`${error instanceof BrowserExportError ? error.message : "It’s damaged."} Download it to keep it as a file.`,
			"error",
		);
	}
};
