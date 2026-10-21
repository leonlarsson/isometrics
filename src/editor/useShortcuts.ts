import { useEffect } from "react";

import { SNAP_STEP, useEditor } from "./store";

const isTyping = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Editor keyboard shortcuts:
 *   Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z or Ctrl+Y redo
 *   Q / E rotate 15° (Shift: 90°) · arrows nudge (Shift: 5×)
 *   Ctrl/Cmd+D duplicate · Delete/Backspace remove · Esc deselect
 */
export const useShortcuts = () => {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (isTyping(event.target)) {
				return;
			}
			const state = useEditor.getState();
			const mod = event.ctrlKey || event.metaKey;
			const key = event.key.toLowerCase();

			if (mod && key === "z") {
				event.preventDefault();
				if (event.shiftKey) {
					state.redo();
				} else {
					state.undo();
				}
				return;
			}
			if (mod && key === "y") {
				event.preventDefault();
				state.redo();
				return;
			}
			if (key === "escape") {
				state.select(null);
				return;
			}

			const id = state.selectedId;
			if (state.mode !== "edit" || !id) {
				return;
			}
			const entity = state.scene.entities.find((e) => e.id === id);
			if (!entity) {
				return;
			}

			if (mod && key === "d") {
				event.preventDefault();
				state.duplicateEntity(id);
				return;
			}
			if (key === "delete" || key === "backspace") {
				event.preventDefault();
				state.removeEntity(id);
				return;
			}
			if (entity.locked) {
				return;
			}
			if (key === "q" || key === "e") {
				const step = event.shiftKey ? 90 : 15;
				state.rotateEntity(id, key === "q" ? step : -step);
				return;
			}
			const arrows: Record<string, [number, number]> = {
				arrowleft: [-1, 0],
				arrowright: [1, 0],
				arrowup: [0, -1],
				arrowdown: [0, 1],
			};
			const dir = arrows[key];
			if (dir && !entity.follow) {
				event.preventDefault();
				const step = SNAP_STEP * (event.shiftKey ? 5 : 1);
				state.moveEntity(
					id,
					[entity.position[0] + dir[0] * step, entity.position[1] + dir[1] * step],
					{ coalesce: `nudge:${id}` },
				);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);
};
