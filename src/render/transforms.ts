import * as THREE from "three";

import {
	type IGroupStart,
	type IPointsStart,
	MAX_POINT_HEIGHT,
	MAX_SIZE,
	MIN_SIZE,
	transformGroup,
	transformPoints,
} from "#/editor/groupTransform";
import { SNAP_STEP, useEditor } from "#/editor/store";
import { clamp, normalizeDegrees, round, snap } from "#/lib/math";
import type { TRoadPoint, TVec2 } from "#/scene/schema";

import { roadBaseY } from "./RoadMesh";
import type { IGizmoDrag } from "./TransformGizmo";

/** Turning snaps in these steps (like Q / E), relative to where the turn started. */
const TURN_STEP = 15;
const LIFT_STEP = 0.25;
const SIZE_STEP = 0.05;
const POINT_HEIGHT_STEP = 0.25;

/** An object's transform when a drag started. */
export interface IEntityStart {
	position: TVec2;
	elevation: number;
	rotation: number;
	scale: number;
}

export const entityStart = (id: string): IEntityStart | null => {
	const entity = useEditor.getState().scene.entities.find((e) => e.id === id);
	return entity
		? {
				position: entity.position,
				elevation: entity.elevation,
				rotation: entity.rotation,
				scale: entity.scale,
			}
		: null;
};

const stepper = (drag: IGizmoDrag) => (value: number, size: number) =>
	drag.free ? value : snap(value, size);

const onGround = ([x, z]: TVec2): TVec2 => {
	const { ground } = useEditor.getState().scene;
	return [
		clamp(x, -ground.width / 2, ground.width / 2),
		clamp(z, -ground.depth / 2, ground.depth / 2),
	];
};

/**
 * Apply one step of a gizmo or keyboard transform to an object, measured from
 * `from`. Positions snap to the grid, turns to 15° steps, sizes to 0.05 and
 * lift to 0.25, unless the drag is free (Alt, snapping off, or a typed value).
 */
export const applyEntityDrag = (id: string, from: IEntityStart, drag: IGizmoDrag) => {
	const store = useEditor.getState();
	const options = { coalesce: drag.token, gesture: true };
	const step = stepper(drag);

	switch (drag.handle) {
		case "x":
		case "z":
		case "xz": {
			const position = onGround([
				step(from.position[0] + drag.offset[0], SNAP_STEP),
				step(from.position[1] + drag.offset[1], SNAP_STEP),
			]);
			store.moveEntity(id, position, options);
			return;
		}
		case "y": {
			const elevation = Math.max(0, step(from.elevation + drag.lift, LIFT_STEP));
			store.updateEntity(
				id,
				(entity) => {
					entity.elevation = round(elevation);
				},
				options,
			);
			return;
		}
		case "rotate": {
			const rotation = normalizeDegrees(from.rotation + step(drag.turn, TURN_STEP));
			store.updateEntity(
				id,
				(entity) => {
					entity.rotation = round(rotation, 1);
				},
				options,
			);
			return;
		}
		case "scale": {
			const scale = clamp(step(from.scale * drag.ratio, SIZE_STEP), MIN_SIZE, MAX_SIZE);
			store.updateEntity(
				id,
				(entity) => {
					entity.scale = round(scale, 2);
				},
				options,
			);
			return;
		}
	}
};

export const roadPointStart = (roadId: string, index: number): TRoadPoint | null =>
	useEditor.getState().scene.roads.find((r) => r.id === roadId)?.points[index] ?? null;

/** Where a road point sits in the world, on top of its road's draw layer. */
export const roadPointWorld = (roadId: string, point: TRoadPoint) => {
	const layer = useEditor.getState().scene.roads.findIndex((r) => r.id === roadId);
	return new THREE.Vector3(point[0], roadBaseY(Math.max(0, layer)) + (point[2] ?? 0), point[1]);
};

/** Apply one step of a move to a road point: along the ground, or up for its height. */
export const applyRoadPointDrag = (
	roadId: string,
	index: number,
	from: TRoadPoint,
	drag: IGizmoDrag,
) => {
	const store = useEditor.getState();
	const options = { coalesce: drag.token, gesture: true };
	const step = stepper(drag);
	if (drag.handle === "y") {
		const height = clamp(step((from[2] ?? 0) + drag.lift, POINT_HEIGHT_STEP), 0, MAX_POINT_HEIGHT);
		store.setRoadPointHeight(roadId, index, height, options);
		return;
	}
	if (drag.handle === "x" || drag.handle === "z" || drag.handle === "xz") {
		const position = onGround([
			step(from[0] + drag.offset[0], SNAP_STEP),
			step(from[1] + drag.offset[1], SNAP_STEP),
		]);
		store.moveRoadPoint(roadId, index, position, options);
	}
};

/**
 * Apply one step of a gizmo or keyboard transform to several selected things
 * (ADR-0064), measured from `from`: moving snaps the distance moved to the
 * grid, turning to 15° steps, resizing to 0.05, unless the drag is free.
 */
export const applyGroupDrag = (from: IGroupStart, drag: IGizmoDrag) => {
	const step = stepper(drag);
	const options = { coalesce: drag.token, gesture: true };
	switch (drag.handle) {
		case "x":
		case "z":
		case "xz":
			transformGroup(
				from,
				{ offset: [step(drag.offset[0], SNAP_STEP), step(drag.offset[1], SNAP_STEP)] },
				options,
			);
			return;
		case "y":
			transformGroup(from, { lift: step(drag.lift, LIFT_STEP) }, options);
			return;
		case "rotate":
			transformGroup(from, { turn: step(drag.turn, TURN_STEP) }, options);
			return;
		case "scale":
			transformGroup(from, { ratio: step(drag.ratio, SIZE_STEP) }, options);
			return;
	}
};

/**
 * Apply one step of a gizmo or keyboard move to several selected points or
 * corners (ADR-0065), measured from `from`: along the ground, the distance
 * snapped to the grid, or up (road points), in height steps.
 */
export const applyPointsDrag = (from: IPointsStart, drag: IGizmoDrag) => {
	const step = stepper(drag);
	const options = { coalesce: drag.token, gesture: true };
	if (drag.handle === "y") {
		transformPoints(from, { lift: step(drag.lift, POINT_HEIGHT_STEP) }, options);
	} else if (drag.handle === "x" || drag.handle === "z" || drag.handle === "xz") {
		transformPoints(
			from,
			{ offset: [step(drag.offset[0], SNAP_STEP), step(drag.offset[1], SNAP_STEP)] },
			options,
		);
	}
};
