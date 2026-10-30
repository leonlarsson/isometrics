import { HotkeysProvider, useHotkeys } from "@tanstack/react-hotkeys";

import { useEditor } from "#/editor/store";
import { FENCE_STYLE_LABELS } from "#/fences/registry";
import { AREA_KIND_LABELS } from "#/scene/areas";
import { ROAD_KIND_LABELS } from "#/scene/roads";

import { Button } from "./Button";
import { Kbd } from "./fields";

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
			options: { meta: { name: "Finish drawing" } },
		},
		{
			hotkey: "Escape",
			callback: () => cancelDrawing(),
			options: { meta: { name: "Cancel drawing" } },
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
		? `${AREA_KIND_LABELS[drawing.areaType].toLowerCase()} area`
		: drawing.target === "fence"
			? FENCE_STYLE_LABELS[drawing.fenceStyle ?? "picket_fence_01"].toLowerCase()
			: ROAD_KIND_LABELS[drawing.style].toLowerCase();

	return (
		<div className={styles.bar} data-label-obstacle="" role="status">
			<div className={styles.text}>
				<strong>Drawing {what}</strong>

				<span>{hint}</span>

				<span className={styles.keys}>
					<Kbd>Enter</Kbd> finish · <Kbd>Backspace</Kbd> undo point · <Kbd>Esc</Kbd> cancel
				</span>
			</div>

			<div className={styles.actions}>
				<Button onClick={() => cancelDrawing()}>Cancel</Button>

				<Button variant="primary" disabled={count < minimum} onClick={() => finishDrawing()}>
					Finish
				</Button>
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
