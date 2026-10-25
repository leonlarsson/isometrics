import { useEffect } from "react";

import { describeThings, pasteText, selectedThingsText } from "./clipboard";
import { pointerSpot } from "./pointerSpot";
import { spotOnGrid, useEditor } from "./store";
import { notify } from "./toasts";

/** Typing or selecting text: the browser's own copy and paste are wanted there. */
const busyWithText = (target: EventTarget | null) =>
	(target instanceof HTMLElement &&
		(target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) ||
	(window.getSelection()?.toString() ?? "") !== "";

/**
 * Ctrl+C, Ctrl+X and Ctrl+V in Edit mode (ADR-0068): copy or cut the selected
 * things to the system clipboard, and paste things or settings from it. Pasted
 * things land under the mouse pointer while it's over the world, else a step
 * over from where they were. They
 * use the browser's copy, cut and paste events, not hotkeys: only those may
 * write and read the clipboard without asking, and they leave text fields and
 * selected text alone.
 */
export const useClipboard = () => {
	useEffect(() => {
		const copy = (event: ClipboardEvent, cut: boolean) => {
			const state = useEditor.getState();
			if (state.mode !== "edit" || busyWithText(document.activeElement)) {
				return;
			}
			const text = selectedThingsText();
			if (!text) {
				return;
			}
			event.preventDefault();
			event.clipboardData?.setData("text/plain", text);
			const { selectedItems } = state;
			const count = (kind: string) => selectedItems.filter((item) => item.kind === kind).length;
			const what = describeThings({
				entities: count("entity"),
				roads: count("road"),
				areas: count("area"),
			});
			if (cut) {
				state.removeSelected();
			}
			notify(
				`${cut ? "Cut" : "Copied"} ${what}`,
				"Paste with Ctrl+V where the mouse points, here or in another world.",
				"success",
			);
		};
		const onCopy = (event: ClipboardEvent) => copy(event, false);
		const onCut = (event: ClipboardEvent) => copy(event, true);
		const onPaste = (event: ClipboardEvent) => {
			if (useEditor.getState().mode !== "edit" || busyWithText(document.activeElement)) {
				return;
			}
			const text = event.clipboardData?.getData("text/plain");
			if (!text) {
				return;
			}
			event.preventDefault();
			// Things land under the mouse pointer when it's over the world, on the grid.
			const spot = pointerSpot.read?.();
			const { snapping } = useEditor.getState();
			pasteText(text, spot ? { at: spotOnGrid(spot, snapping) } : {});
		};
		document.addEventListener("copy", onCopy);
		document.addEventListener("cut", onCut);
		document.addEventListener("paste", onPaste);
		return () => {
			document.removeEventListener("copy", onCopy);
			document.removeEventListener("cut", onCut);
			document.removeEventListener("paste", onPaste);
		};
	}, []);
};
