import { useMemo, useRef } from "react";

import { groupStart, type IGroupStart } from "#/editor/groupTransform";
import { selectSeveral, useEditor } from "#/editor/store";

import { type TGizmoHandle, TransformGizmo } from "./TransformGizmo";
import { applyGroupDrag } from "./transforms";

const HANDLES: TGizmoHandle[] = ["x", "z", "xz", "y", "rotate", "scale"];

/**
 * The transform gizmo for several selected things (ADR-0064), at the middle of
 * what they move: it moves, lifts, turns and resizes them together, around
 * that middle.
 */
export const GroupGizmo = () => {
	const several = useEditor(selectSeveral);
	const editing = useEditor((s) => s.mode === "edit" && s.drawing === null);
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
				handles={HANDLES}
				onStart={() => {
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
