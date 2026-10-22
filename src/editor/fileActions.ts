import type { TScene } from "#/scene/schema";

import { downloadScene, readSceneFile } from "./persistence";
import { useEditor } from "./store";

/**
 * File menu actions, shared by the menu and the keyboard shortcuts. They act on
 * the editor store directly, so they work from anywhere (menu item or hotkey).
 */

/** Ask the user for a file. Resolves with null if they cancel. */
const pickFile = (accept: string) =>
	new Promise<File | null>((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
		input.addEventListener("cancel", () => resolve(null));
		input.click();
	});

/** Replace the current world and frame it. */
export const replaceWorld = (scene: TScene) => {
	const { loadScene, resetView } = useEditor.getState();
	loadScene(scene);
	resetView();
};

/** Let the user pick a world file and open it in place of the current one. */
export const openWorldFile = async () => {
	const file = await pickFile("application/json,.json");
	if (!file) {
		return;
	}
	try {
		replaceWorld(await readSceneFile(file));
	} catch (error) {
		window.alert(
			`That file isn’t a valid world.\n\n${error instanceof Error ? error.message : String(error)}`,
		);
	}
};

/** Download the current world as a JSON file. */
export const saveWorldFile = () => downloadScene(useEditor.getState().scene);
