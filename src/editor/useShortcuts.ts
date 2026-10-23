import { useHotkeys } from "@tanstack/react-hotkeys";

import { clamp } from "#/lib/math";
import type { TVec2 } from "#/scene/schema";

import { openWorldFile, saveWorldFile } from "./fileActions";
import {
	FINE_NUDGE_STEP,
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
 *   Esc cancels a gizmo drag or a drag from the palette, dismisses the drive-along offer, else deselects
 *   Mod+O open a world file · Mod+S save the world to a file
 *   Edit mode, with a selection: Q / E rotate 15° (Shift: 90°)
 *   Arrows nudge the selected object, or the selected road or area point (Shift: 5×, Alt: 0.1)
 *   G move · R turn · S resize, then X / Y / Z, a number, Enter or Esc (ui/TransformBar)
 *   Mod+D duplicate · Delete/Backspace remove (selected road point, else object or road)
 *   H hide or show the selection · Alt+H show everything hidden · F frame the selection
 *   P perspective / diorama view · 1–9 go to viewpoint 1–9
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
	const viewpointCount = useEditor((s) => s.scene.viewpoints.length);
	const canDelete =
		mode === "edit" && (selected !== null || selectedRoad !== null || selectedArea !== null);
	const canTransform = canEdit && !selected.locked;
	const canNudge = canTransform && !selected.follow;
	const selectedPoint = useEditor(
		(s) => s.mode === "edit" && s.selectedRoadId !== null && s.selectedPointIndex !== null,
	);
	// A point of a road or area that can be edited (visible, not locked): the arrows nudge it.
	const nudgePoint = useEditor((s) => {
		if (s.mode !== "edit" || s.selectedPointIndex === null) {
			return false;
		}
		const shape = selectSelectedRoad(s) ?? selectSelectedArea(s);
		return shape !== null && !shape.hidden && !shape.locked;
	});
	const canNudgeAny = canNudge || nudgePoint;
	// Keyboard transforms: G moves objects and road points; R and S turn and resize objects.
	// G on a vehicle following a road lifts it off to drop on another road or park it.
	const canGrab = canTransform || selectedPoint;
	const start = (mode: TTransformMode) => useEditor.getState().startTransform(mode);

	const rotate = (degrees: number) => {
		const { selectedId, rotateEntity } = useEditor.getState();
		if (selectedId) {
			rotateEntity(selectedId, degrees);
		}
	};

	/**
	 * Move the selected object, or the selected road or area point, `dx` and `dz`
	 * steps of `step` (a grid step unless finer, for lining things up by eye).
	 */
	const nudge = (dx: number, dz: number, step = SNAP_STEP) => {
		const state = useEditor.getState();
		const entity = selectSelectedEntity(state);
		if (entity) {
			state.moveEntity(
				entity.id,
				[entity.position[0] + dx * step, entity.position[1] + dz * step],
				{ coalesce: `nudge:${entity.id}` },
			);
			return;
		}
		const index = state.selectedPointIndex;
		const road = selectSelectedRoad(state);
		const shape = road ?? selectSelectedArea(state);
		const point = index === null ? undefined : shape?.points[index];
		if (!shape || index === null || !point) {
			return;
		}
		// Kept on the ground, like a dragged point.
		const { width, depth } = state.scene.ground;
		const next: TVec2 = [
			clamp(point[0] + dx * step, -width / 2, width / 2),
			clamp(point[1] + dz * step, -depth / 2, depth / 2),
		];
		const options = { coalesce: `nudge:${shape.id}:${index}` };
		if (road) {
			state.moveRoadPoint(road.id, index, next, options);
		} else {
			state.moveAreaPoint(shape.id, index, next, options);
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
			// Cancel dragging a new part in, or dismiss the offer to drive along a road; otherwise
			// step out one level: a selected point first, then the road or object.
			callback: () => {
				const state = useEditor.getState();
				if (state.cancelGesture) {
					state.cancelGesture();
				} else if (state.cameraFollow) {
					state.stopFollowing();
				} else if (state.placingKind) {
					state.stopPlacing();
				} else if (state.followOffer) {
					state.setFollowOffer(null);
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
		// 1–9 glide to the world's first nine viewpoints, in Edit and View mode.
		...(["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const).map((digit, index) => ({
			hotkey: digit,
			callback: () => {
				const viewpoint = useEditor.getState().scene.viewpoints[index];
				if (viewpoint) {
					useEditor.getState().goToViewpoint(viewpoint.id);
				}
			},
			options: { enabled: viewpointCount > index, meta: { name: `Viewpoint ${digit}` } },
		})),
		{
			hotkey: "P",
			callback: () => useEditor.getState().togglePerspective(),
			options: { meta: { name: "Perspective / diorama view" } },
		},
		{
			hotkey: "H",
			callback: () => useEditor.getState().toggleSelectedHidden(),
			options: { enabled: canDelete, meta: { name: "Hide or show the selection" } },
		},
		{
			hotkey: "Alt+H",
			callback: () => useEditor.getState().revealAll(),
			options: { enabled: mode === "edit", meta: { name: "Show everything hidden" } },
		},
		{
			hotkey: "F",
			callback: () => useEditor.getState().frameSelection(),
			options: { enabled: canDelete, meta: { name: "Frame the selection" } },
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
			options: { enabled: canNudgeAny, meta: { name: "Nudge left" } },
		},
		{
			hotkey: "ArrowRight",
			callback: () => nudge(1, 0),
			options: { enabled: canNudgeAny, meta: { name: "Nudge right" } },
		},
		{
			hotkey: "ArrowUp",
			callback: () => nudge(0, -1),
			options: { enabled: canNudgeAny, meta: { name: "Nudge back" } },
		},
		{
			hotkey: "ArrowDown",
			callback: () => nudge(0, 1),
			options: { enabled: canNudgeAny, meta: { name: "Nudge forward" } },
		},
		{
			hotkey: "Shift+ArrowLeft",
			callback: () => nudge(-5, 0),
			options: { enabled: canNudgeAny, meta: { name: "Nudge left ×5" } },
		},
		{
			hotkey: "Shift+ArrowRight",
			callback: () => nudge(5, 0),
			options: { enabled: canNudgeAny, meta: { name: "Nudge right ×5" } },
		},
		{
			hotkey: "Shift+ArrowUp",
			callback: () => nudge(0, -5),
			options: { enabled: canNudgeAny, meta: { name: "Nudge back ×5" } },
		},
		{
			hotkey: "Shift+ArrowDown",
			callback: () => nudge(0, 5),
			options: { enabled: canNudgeAny, meta: { name: "Nudge forward ×5" } },
		},
		{
			hotkey: "Alt+ArrowLeft",
			callback: () => nudge(-1, 0, FINE_NUDGE_STEP),
			options: { enabled: canNudgeAny, meta: { name: "Nudge left a little" } },
		},
		{
			hotkey: "Alt+ArrowRight",
			callback: () => nudge(1, 0, FINE_NUDGE_STEP),
			options: { enabled: canNudgeAny, meta: { name: "Nudge right a little" } },
		},
		{
			hotkey: "Alt+ArrowUp",
			callback: () => nudge(0, -1, FINE_NUDGE_STEP),
			options: { enabled: canNudgeAny, meta: { name: "Nudge back a little" } },
		},
		{
			hotkey: "Alt+ArrowDown",
			callback: () => nudge(0, 1, FINE_NUDGE_STEP),
			options: { enabled: canNudgeAny, meta: { name: "Nudge forward a little" } },
		},
	]);
};
