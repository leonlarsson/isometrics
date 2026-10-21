import { HotkeysProvider, useHotkeys } from "@tanstack/react-hotkeys";

import { useEditor } from "#/editor/store";
import { AREA_TYPE_LABELS } from "#/scene/areas";
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

	const isArea = drawing.target === "area";
	const count = drawing.points.length;
	const minimum = isArea ? 3 : 2;
	const hint =
		count === 0
			? "Click on the ground to place the first point."
			: count < minimum
				? "Click to add the next point."
				: isArea
					? "Keep clicking to add corners. Click the first corner or press Enter to finish."
					: "Keep clicking to add points. Click the first point to make a loop.";
	const what = isArea
		? `${AREA_TYPE_LABELS[drawing.areaType].toLowerCase()} area`
		: ROAD_STYLE_LABELS[drawing.style].toLowerCase();

	return (
		<div className={styles.bar} role="status">
			<div className={styles.text}>
				<strong>Drawing {what}</strong>

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
					disabled={count < minimum}
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
