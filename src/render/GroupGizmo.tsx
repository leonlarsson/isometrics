import { useMemo, useRef } from "react";

import { groupStart, type IGroupStart } from "#/editor/groupTransform";
import { drawnModeOf, selectMovesAsGroup, useEditor } from "#/editor/store";

import { type TGizmoHandle, TransformGizmo } from "./TransformGizmo";
import { applyGroupDrag } from "./transforms";

const HANDLES: TGizmoHandle[] = ["x", "z", "xz", "y", "rotate", "scale"];
/** Areas alone have no lift arrow: how high an area is, is its Raised by setting. */
const AREA_HANDLES: TGizmoHandle[] = ["x", "z", "xz", "rotate", "scale"];

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
	const group = useMemo(() => (several ? groupStart() : null), [several, scene, items]);
	// Nothing that stands on its own moves (only locked things or driving vehicles): no gizmo.
	const movable =
		group && group.entities.length + group.roads.length + group.areas.length > 0 ? group : null;

	if (!several || !editing || !movable) {
		return null;
	}

	return (
		<group position={movable.center}>
			<TransformGizmo
				handles={movable.entities.length + movable.roads.length === 0 ? AREA_HANDLES : HANDLES}
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
