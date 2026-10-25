import * as THREE from "three";

import { type ICommitOptions, SNAP_STEP, useEditor } from "#/editor/store";
import { keepOnHotReload } from "#/lib/hot";
import { DEG2RAD, normalizeDegrees, round, snap } from "#/lib/math";
import { getPart, resolveProps } from "#/parts/registry";
import { resolveTurns, turnSmoothing } from "#/scene/roads";
import { createRouteSampler, type IRoadProjection, projectOntoRoad } from "#/scene/routes";
import type { TRoad, TVec2 } from "#/scene/schema";

/** How far beyond a road's edge a drop still counts as on the road. */
const DROP_MARGIN = 0.3;

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const shifted = new THREE.Ray();

const pointAtHeight = (ray: THREE.Ray, y: number): TVec2 | null => {
	plane.constant = -y;
	return ray.intersectPlane(plane, hit) ? [hit.x, hit.z] : null;
};

/** A spot on a road where a dragged vehicle would park, ready to drive along it. */
export interface IRouteDrop {
	roadId: string;
	/** Distance along the road (FollowSchema `offset`). */
	offset: number;
	/** Drive it the other way (FollowSchema `reverse`). */
	reverse: boolean;
	/** Where the vehicle stands: in its lane at `offset`. */
	position: TVec2;
	/** Height of the road there, for the vehicle's elevation. */
	height: number;
	/** Facing the way it would drive, in degrees (an entity's `rotation`). */
	rotation: number;
	/** Nose up or down with the road's slope there, in degrees (an entity's `pitch`). */
	pitch: number;
}

interface IRouteDropOptions {
	/** Vehicle length in grid units, for how smoothly it turns. */
	vehicleLength: number;
}

/**
 * The road under the pointer ray, if any, and where a vehicle dropped there
 * would stand. The half of the road under the pointer picks the direction, as
 * if it had a lane on the driving side: on roads with lanes that's the lane
 * itself, and on centre-lane roads and hidden routes it's the same rule, so
 * moving across the centre line flips the way it goes. Elevated roads are hit
 * where they appear on screen, not where the ray meets the ground.
 */
export const findRouteDrop = (
	ray: THREE.Ray,
	{ vehicleLength }: IRouteDropOptions,
): IRouteDrop | null => {
	const { scene, snapping } = useEditor.getState();
	let best: { road: TRoad; projection: IRoadProjection } | null = null;
	for (const road of scene.roads) {
		if (road.hidden) {
			continue;
		}
		// Find where the ray crosses the road's own height: start on the ground, then refine.
		let height = 0;
		let projection: IRoadProjection | null = null;
		for (let i = 0; i < 3; i++) {
			const point = pointAtHeight(ray, height);
			projection = point ? projectOntoRoad(road, point) : null;
			if (!projection || Math.abs(projection.height - height) < 0.01) {
				break;
			}
			height = projection.height;
		}
		if (!projection || projection.gap > projection.halfWidth + DROP_MARGIN) {
			continue;
		}
		// Where roads cross, the higher one is the one on top; otherwise the nearer one wins.
		const top = best?.projection;
		const higher = top ? projection.height - top.height : 1;
		if (!top || higher > 0.01 || (higher > -0.01 && projection.gap < top.gap)) {
			best = { road, projection };
		}
	}
	if (!best) {
		return null;
	}

	const { road, projection } = best;
	// Driving on the right, the forward lane is right of the road's direction.
	const reverse = projection.side * (scene.driving === "right" ? 1 : -1) < 0;
	const sampler = createRouteSampler(road, scene.driving, {
		reverse,
		smoothing: turnSmoothing(resolveTurns(scene.turns, road.turns, null), vehicleLength),
	});
	const offset = Math.min(
		Math.max(snapping ? snap(projection.offset, SNAP_STEP) : projection.offset, 0),
		sampler.length,
	);
	const sample = sampler.at(offset);
	return {
		roadId: road.id,
		offset: round(offset),
		reverse,
		position: [round(sample.position[0]), round(sample.position[1])],
		height: round(sample.height),
		rotation: round(normalizeDegrees(sample.heading / DEG2RAD)),
		pitch: round(sample.pitch / DEG2RAD, 1),
	};
};

/** Where a vehicle stands, as an entity's position, elevation, rotation and pitch. */
export interface IVehiclePose {
	position: TVec2;
	elevation: number;
	rotation: number;
	pitch?: number;
}

const down = new THREE.Vector3(0, -1, 0);
const above = new THREE.Vector3();

/** Whether a vehicle stands on a road: one under it, at its height. */
const standsOnRoad = (position: TVec2, elevation: number, vehicleLength: number) => {
	above.set(position[0], 100, position[1]);
	const drop = findRouteDrop(new THREE.Ray(above, down), { vehicleLength });
	return drop !== null && Math.abs(drop.height - elevation) < 0.05;
};

/**
 * Where each driving vehicle is right now, by entity id. They move every
 * frame, so only the renderer knows; EntityNode registers a getter while a
 * vehicle drives.
 */
export const livePoses = keepOnHotReload(
	"livePoses",
	() => new Map<string, () => IVehiclePose | undefined>(),
);

export interface IVehicleRouteDrag {
	/**
	 * The drag really started (past the threshold). A driving vehicle is lifted
	 * off its route here: it stops driving and stands where it was on screen.
	 */
	start: (options: ICommitOptions) => void;
	/**
	 * Park the vehicle on a road at `target` (where the drag would put it on the
	 * ground), in its lane and facing the way it would drive. `ray` is the
	 * pointer's: the vehicle is usually grabbed off-centre, so it's moved to pass
	 * over `target` (exactly the same view in the diorama camera, close enough in
	 * perspective). Returns
	 * false when there's no road there (or Alt is held), so the caller moves it
	 * as usual.
	 */
	move: (ray: THREE.Ray, target: TVec2, altKey: boolean, options: ICommitOptions) => boolean;
	/**
	 * The drag is over (`completed` false: cancelled). Left on a road, a vehicle
	 * that was driving drives on from there; a parked one gets the offer to.
	 * Left anywhere else, it stays parked.
	 */
	end: (completed: boolean, options: ICommitOptions) => void;
}

/**
 * Road snapping for a vehicle moved by hand, shared by dragging the vehicle
 * itself, the gizmo's move square and the G key. A driving vehicle is picked
 * up where it is right now: `pose`, or else its `livePoses` entry. Null for
 * anything that can't follow a road, or a driving vehicle whose pose is unknown.
 */
export const createVehicleRouteDrag = (
	entityId: string,
	livePose?: IVehiclePose,
): IVehicleRouteDrag | null => {
	const entity = useEditor.getState().scene.entities.find((e) => e.id === entityId);
	const part = entity ? getPart(entity.kind) : undefined;
	const pose = livePose ?? (entity?.follow ? livePoses.get(entityId)?.() : undefined);
	if (!entity || !part?.canFollowPath || (entity.follow && !pose)) {
		return null;
	}
	const vehicleLength = part.footprint(resolveProps(part, entity.props))[0] * entity.scale;
	const follow = entity.follow;
	// How it stood when picked up, to go back to when it leaves a road again. One picked up off
	// a road (parked on a bridge, or driving) goes back down to the ground instead of hovering.
	const start = pose ?? entity;
	const { rotation } = start;
	const elevation =
		follow || standsOnRoad(start.position, start.elevation, vehicleLength) ? 0 : start.elevation;
	let drop: IRouteDrop | null = null;

	return {
		start: (options) => {
			const store = useEditor.getState();
			store.setFollowOffer(null);
			if (!follow || !pose) {
				return;
			}
			store.setRerouting(true);
			store.updateEntity(
				entityId,
				(draft) => {
					draft.follow = null;
					draft.position = pose.position;
					draft.elevation = pose.elevation;
					draft.rotation = pose.rotation;
					draft.pitch = pose.pitch ?? 0;
				},
				options,
			);
		},
		move: (ray, target, altKey, options) => {
			const ground = altKey ? null : pointAtHeight(ray, 0);
			if (ground) {
				shifted.copy(ray);
				shifted.origin.x += target[0] - ground[0];
				shifted.origin.z += target[1] - ground[1];
			}
			const next = ground ? findRouteDrop(shifted, { vehicleLength }) : null;
			const store = useEditor.getState();
			if (next) {
				if (drop?.roadId !== next.roadId || drop?.reverse !== next.reverse) {
					store.setRoutePreview({ roadId: next.roadId, reverse: next.reverse });
				}
				drop = next;
				store.updateEntity(
					entityId,
					(draft) => {
						draft.position = next.position;
						draft.rotation = next.rotation;
						draft.elevation = next.height;
						draft.pitch = next.pitch;
					},
					options,
				);
				return true;
			}
			if (drop) {
				drop = null;
				store.setRoutePreview(null);
				store.updateEntity(
					entityId,
					(draft) => {
						draft.rotation = rotation;
						draft.elevation = elevation;
						// Off the road the ground is flat.
						draft.pitch = 0;
					},
					options,
				);
			}
			return false;
		},
		end: (completed, options) => {
			const store = useEditor.getState();
			store.setRoutePreview(null);
			store.setRerouting(false);
			if (completed && drop && follow) {
				const { roadId, offset, reverse } = drop;
				// It was driving: carry on from here, keeping its speed, turns and own height and turn.
				store.updateEntity(
					entityId,
					(draft) => {
						draft.follow = { ...follow, roadId, offset, reverse };
						draft.elevation = entity.elevation;
						draft.rotation = entity.rotation;
						draft.pitch = 0;
					},
					options,
				);
			} else if (completed && drop) {
				const { roadId, offset, reverse, position } = drop;
				store.setFollowOffer({ entityId, roadId, offset, reverse, position });
			}
			drop = null;
		},
	};
};
