import { useRef } from "react";

import { useEditor } from "#/editor/store";
import type { TEntity, TVec2 } from "#/scene/schema";

import { createVehicleRouteDrag, type IVehicleRouteDrag } from "./routeDrop";
import { type TGizmoHandle, TransformGizmo } from "./TransformGizmo";
import { applyEntityDrag, entityStart, type IEntityStart } from "./transforms";

const MOVE_HANDLES: TGizmoHandle[] = ["x", "z", "xz", "y", "rotate", "rotateX", "rotateZ", "scale"];
/**
 * A vehicle following a road gets its position from the road, so it has no axis arrows. The
 * square lifts it off its route to drop it on another road, or anywhere to park it. The road tilts
 * it, so it has no X and Z rings either.
 */
const FOLLOWING_HANDLES: TGizmoHandle[] = ["xz", "y", "rotate", "scale"];

/** The transform gizmo for the selected object: move, lift, turn (in all three axes) and resize it. */
export const EntityGizmo = ({ entity }: { entity: TEntity }) => {
	const start = useRef<IEntityStart | null>(null);
	const route = useRef<IVehicleRouteDrag | null>(null);

	return (
		<TransformGizmo
			handles={entity.follow ? FOLLOWING_HANDLES : MOVE_HANDLES}
			heading={entity.rotation[1]}
			followsGround
			onStart={(token, handle, keys) => {
				// Ctrl: an identical copy stays where it is, and this one moves (ADR-0067).
				if (keys.copy) {
					useEditor.getState().duplicateSelected({ step: 0, coalesce: token, leaveBehind: true });
				}
				// Only the move square snaps onto roads (and lifts a driving vehicle off its route).
				route.current = handle === "xz" ? createVehicleRouteDrag(entity.id) : null;
				route.current?.start({ coalesce: token, gesture: true });
				start.current = entityStart(entity.id);
			}}
			onDrag={(drag) => {
				const from = start.current;
				if (!from) {
					return;
				}
				const { pointer } = drag;
				if (pointer && route.current) {
					const target: TVec2 = [
						from.position[0] + drag.offset[0],
						from.position[1] + drag.offset[1],
					];
					const options = { coalesce: drag.token, gesture: true };
					if (route.current.move(pointer.ray, target, pointer.altKey, options)) {
						return;
					}
				}
				applyEntityDrag(entity.id, from, drag);
			}}
			onEnd={(completed, token) => {
				route.current?.end(completed, { coalesce: token, gesture: true });
				route.current = null;
			}}
		/>
	);
};
