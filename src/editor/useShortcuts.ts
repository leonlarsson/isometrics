import { useHotkeys } from "@tanstack/react-hotkeys";

import { openWorldFile, saveWorldFile } from "./fileActions";
import {
	SNAP_STEP,
	selectSelectedArea,
	selectSelectedEntity,
	selectSelectedRoad,
	type TTransformMode,
	useEditor,
} from "./store";

const isTextEntry = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Editor keyboard shortcuts, registered with TanStack Hotkeys (ADR-0016):
 *   Mod+Z undo · Mod+Shift+Z / Mod+Y redo · Space pause/play motion
 *   Esc cancels a gizmo drag or a drag from the palette, else deselects
 *   Mod+O open a world file · Mod+S save the world to a file
 *   Edit mode, with a selection: Q / E rotate 15° (Shift: 90°) · arrows nudge (Shift: 5×)
 *   G move · R turn · S resize, then X / Y / Z, a number, Enter or Esc (ui/TransformBar)
 *   Mod+D duplicate · Delete/Backspace remove (selected road point, else object or road)
 *
 * The library skips single keys while typing in text fields and prevents the
 * browser default for matched keys. Mod chords stay enabled and return early,
 * because a disabled hotkey would let the browser act (Mod+D would bookmark).
 */
export const useShortcuts = () => {
	const mode = useEditor((s) => s.mode);
	const selected = useEditor(selectSelectedEntity);
	const selectedRoad = useEditor(selectSelectedRoad);
	const selectedArea = useEditor(selectSelectedArea);

	const canEdit = mode === "edit" && selected !== null;
	const canDelete =
		mode === "edit" && (selected !== null || selectedRoad !== null || selectedArea !== null);
	const canTransform = canEdit && !selected.locked;
	const canNudge = canTransform && !selected.follow;
	const selectedPoint = useEditor(
		(s) => s.mode === "edit" && s.selectedRoadId !== null && s.selectedPointIndex !== null,
	);
	// Keyboard transforms: G moves objects and road points; R and S turn and resize objects.
	// A vehicle following a road is placed by the road, so it uses the gizmo instead.
	const canGrab = canNudge || selectedPoint;
	const start = (mode: TTransformMode) => useEditor.getState().startTransform(mode);

	const rotate = (degrees: number) => {
		const { selectedId, rotateEntity } = useEditor.getState();
		if (selectedId) {
			rotateEntity(selectedId, degrees);
		}
	};

	const nudge = (dx: number, dz: number) => {
		const state = useEditor.getState();
		const entity = selectSelectedEntity(state);
		if (entity) {
			state.moveEntity(
				entity.id,
				[entity.position[0] + dx * SNAP_STEP, entity.position[1] + dz * SNAP_STEP],
				{ coalesce: `nudge:${entity.id}` },
			);
		}
	};

	/** Delete the selected point if there is one, otherwise the selected object, road or area. */
	const remove = () => {
		const state = useEditor.getState();
		const point = state.selectedPointIndex;
		if (state.selectedId) {
			state.removeEntity(state.selectedId);
		} else if (state.selectedRoadId) {
			if (point !== null) {
				state.removeRoadPoint(state.selectedRoadId, point);
			} else {
				state.removeRoad(state.selectedRoadId);
			}
		} else if (state.selectedAreaId) {
			if (point !== null) {
				state.removeAreaPoint(state.selectedAreaId, point);
			} else {
				state.removeArea(state.selectedAreaId);
			}
		}
	};

	useHotkeys([
		{
			hotkey: "Mod+O",
			callback: () => {
				openWorldFile();
			},
			options: { meta: { name: "Open file" } },
		},
		{
			hotkey: "Mod+S",
			callback: () => saveWorldFile(),
			options: { meta: { name: "Save to file" } },
		},
		{
			hotkey: "Mod+Z",
			callback: () => useEditor.getState().undo(),
			options: { meta: { name: "Undo" } },
		},
		{
			hotkey: "Mod+Shift+Z",
			callback: () => useEditor.getState().redo(),
			options: { meta: { name: "Redo" } },
		},
		{
			hotkey: "Mod+Y",
			callback: () => useEditor.getState().redo(),
			options: { meta: { name: "Redo" } },
		},
		{
			hotkey: "Escape",
			// Cancel dragging a new part in; otherwise step out one level: a selected point
			// first, then the road or object.
			callback: () => {
				const state = useEditor.getState();
				if (state.cancelGesture) {
					state.cancelGesture();
				} else if (state.placingKind) {
					state.stopPlacing();
				} else if (state.selectedPointIndex !== null && state.selectedRoadId) {
					state.selectRoadPoint(state.selectedRoadId, null);
				} else if (state.selectedPointIndex !== null && state.selectedAreaId) {
					state.selectAreaPoint(state.selectedAreaId, null);
				} else {
					state.clearSelection();
				}
			},
			options: { meta: { name: "Deselect" } },
		},
		{
			// Handle Space on focused buttons too (otherwise the last-clicked toolbar button
			// would be "pressed" again), but never steal it from text fields.
			hotkey: "Space",
			callback: (event) => {
				if (isTextEntry(event.target)) {
					return;
				}
				event.preventDefault();
				useEditor.getState().togglePlaying();
			},
			options: {
				ignoreInputs: false,
				preventDefault: false,
				requireReset: true,
				meta: { name: "Pause / play motion" },
			},
		},
		{
			hotkey: "Mod+D",
			callback: () => {
				const { mode: currentMode, selectedId, duplicateEntity } = useEditor.getState();
				if (currentMode === "edit" && selectedId) {
					duplicateEntity(selectedId);
				}
			},
			options: { meta: { name: "Duplicate" } },
		},
		{
			hotkey: "Delete",
			callback: remove,
			options: { enabled: canDelete, meta: { name: "Delete" } },
		},
		{
			hotkey: "Backspace",
			callback: remove,
			options: { enabled: canDelete, meta: { name: "Delete" } },
		},
		{
			hotkey: "G",
			callback: () => start("grab"),
			options: { enabled: canGrab, meta: { name: "Move (grab)" } },
		},
		{
			hotkey: "R",
			callback: () => start("rotate"),
			options: { enabled: canNudge, meta: { name: "Turn" } },
		},
		{
			hotkey: "S",
			callback: () => start("scale"),
			options: { enabled: canNudge, meta: { name: "Resize" } },
		},
		{
			hotkey: "Q",
			callback: () => rotate(15),
			options: { enabled: canTransform, meta: { name: "Rotate left" } },
		},
		{
			hotkey: "E",
			callback: () => rotate(-15),
			options: { enabled: canTransform, meta: { name: "Rotate right" } },
		},
		{
			hotkey: "Shift+Q",
			callback: () => rotate(90),
			options: { enabled: canTransform, meta: { name: "Rotate left 90°" } },
		},
		{
			hotkey: "Shift+E",
			callback: () => rotate(-90),
			options: { enabled: canTransform, meta: { name: "Rotate right 90°" } },
		},
		{
			hotkey: "ArrowLeft",
			callback: () => nudge(-1, 0),
			options: { enabled: canNudge, meta: { name: "Nudge left" } },
		},
		{
			hotkey: "ArrowRight",
			callback: () => nudge(1, 0),
			options: { enabled: canNudge, meta: { name: "Nudge right" } },
		},
		{
			hotkey: "ArrowUp",
			callback: () => nudge(0, -1),
			options: { enabled: canNudge, meta: { name: "Nudge back" } },
		},
		{
			hotkey: "ArrowDown",
			callback: () => nudge(0, 1),
			options: { enabled: canNudge, meta: { name: "Nudge forward" } },
		},
		{
			hotkey: "Shift+ArrowLeft",
			callback: () => nudge(-5, 0),
			options: { enabled: canNudge, meta: { name: "Nudge left ×5" } },
		},
		{
			hotkey: "Shift+ArrowRight",
			callback: () => nudge(5, 0),
			options: { enabled: canNudge, meta: { name: "Nudge right ×5" } },
		},
		{
			hotkey: "Shift+ArrowUp",
			callback: () => nudge(0, -5),
			options: { enabled: canNudge, meta: { name: "Nudge back ×5" } },
		},
		{
			hotkey: "Shift+ArrowDown",
			callback: () => nudge(0, 5),
			options: { enabled: canNudge, meta: { name: "Nudge forward ×5" } },
		},
	]);
};
