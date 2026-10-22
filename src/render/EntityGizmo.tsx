import { useRef } from "react";

import type { TEntity } from "#/scene/schema";

import { type TGizmoHandle, TransformGizmo } from "./TransformGizmo";
import { applyEntityDrag, entityStart, type IEntityStart } from "./transforms";

const MOVE_HANDLES: TGizmoHandle[] = ["x", "z", "xz", "y", "rotate", "scale"];
/** A vehicle following a road gets its position from the road. */
const FOLLOWING_HANDLES: TGizmoHandle[] = ["y", "rotate", "scale"];

/** The transform gizmo for the selected object: move, lift, turn and resize it. */
export const EntityGizmo = ({ entity }: { entity: TEntity }) => {
	const start = useRef<IEntityStart | null>(null);

	return (
		<TransformGizmo
			handles={entity.follow ? FOLLOWING_HANDLES : MOVE_HANDLES}
			onStart={() => {
				start.current = entityStart(entity.id);
			}}
			onDrag={(drag) => {
				if (start.current) {
					applyEntityDrag(entity.id, start.current, drag);
				}
			}}
		/>
	);
};
