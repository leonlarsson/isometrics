import { HotkeysProvider, useHotkeys } from "@tanstack/react-hotkeys";

import { useEditor } from "#/editor/store";
import { ROAD_STYLE_LABELS } from "#/scene/roads";

import styles from "./DrawingBar.module.css";

const DrawingControls = () => {
	const drawing = useEditor((s) => s.drawing);
	const finishDrawing = useEditor((s) => s.finishDrawing);
	const cancelDrawing = useEditor((s) => s.cancelDrawing);
	const undoDrawingPoint = useEditor((s) => s.undoDrawingPoint);

	useHotkeys([
		{
			hotkey: "Enter",
			callback: () => finishDrawing(),
			options: { meta: { name: "Finish road" } },
		},
		{
			hotkey: "Escape",
			callback: () => cancelDrawing(),
			options: { meta: { name: "Cancel road" } },
		},
		{
			hotkey: "Backspace",
			callback: () => undoDrawingPoint(),
			options: { meta: { name: "Remove last point" } },
		},
	]);

	if (!drawing) {
		return null;
	}

	const count = drawing.points.length;
	const hint =
		count === 0
			? "Click on the ground to place the first point."
			: count === 1
				? "Click to add the next point."
				: "Keep clicking to add points. Click the first point to make a loop.";

	return (
		<div className={styles.bar} role="status">
			<div className={styles.text}>
				<strong>Drawing {ROAD_STYLE_LABELS[drawing.style].toLowerCase()}</strong>

				<span>{hint}</span>

				<span className={styles.keys}>
					<kbd>Enter</kbd> finish · <kbd>Backspace</kbd> undo point · <kbd>Esc</kbd> cancel
				</span>
			</div>

			<div className={styles.actions}>
				<button type="button" className={styles.secondary} onClick={() => cancelDrawing()}>
					Cancel
				</button>

				<button
					type="button"
					className={styles.primary}
					disabled={count < 2}
					onClick={() => finishDrawing()}
				>
					Finish
				</button>
			</div>
		</div>
	);
};

/**
 * Instructions and Finish/Cancel while a road is being drawn. Its hotkeys live
 * in an exclusive scope, so Escape cancels the drawing instead of deselecting.
 */
export const DrawingBar = () => {
	const active = useEditor((s) => s.drawing !== null);
	if (!active) {
		return null;
	}

	return (
		<HotkeysProvider scope="road-drawing" exclusive>
			<DrawingControls />
		</HotkeysProvider>
	);
};
