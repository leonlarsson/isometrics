import { useMemo, useRef } from "react";

import { groupStart, groupStartOf, type IGroupStart } from "#/editor/groupTransform";
import { drawnModeOf, selectMovesAsGroup, useEditor } from "#/editor/store";

import { type TGizmoHandle, TransformGizmo } from "./TransformGizmo";
import { applyGroupDrag } from "./transforms";

const HANDLES: TGizmoHandle[] = ["x", "z", "xz", "y", "rotate", "scale"];

/**
 * The transform gizmo for several selected things (ADR-0064), or a whole road
 * or area (ADR-0066), at the middle of what they move: it moves, lifts, turns
 * and resizes them together, around that middle.
 */
export const GroupGizmo = () => {
	const several = useEditor(selectMovesAsGroup);
	const editing = useEditor((s) => drawnModeOf(s) === "edit" && s.drawing === null);
	const scene = useEditor((s) => s.scene);
	const items = useEditor((s) => s.selectedItems);
	const start = useRef<IGroupStart | null>(null);
	// From what it subscribes to, so it follows what it moves (ADR-0093: a gizmo that worked it out
	// from the store by itself stayed where the drag began).
	const group = useMemo(
		() => (several ? groupStartOf(scene, items) : null),
		[several, scene, items],
	);
	// Nothing that stands on its own moves (only locked things or driving vehicles): no gizmo.
	const movable =
		group && group.entities.length + group.roads.length + group.areas.length > 0 ? group : null;

	if (!several || !editing || !movable) {
		return null;
	}

	return (
		<group position={movable.center}>
			<TransformGizmo
				// The lift arrow raises areas too: their Raised by (ADR-0096).
				handles={HANDLES}
				onStart={(token, _handle, keys) => {
					// Ctrl: copy them in place (the same undo step), then move, turn or resize the copies.
					if (keys.copy) {
						useEditor.getState().duplicateSelected({ step: 0, coalesce: token });
					}
					start.current = groupStart();
				}}
				onDrag={(drag) => {
					if (start.current) {
						applyGroupDrag(start.current, drag);
					}
				}}
			/>
		</group>
	);
};
