import { useFrame } from "@react-three/fiber";

import { useEditor } from "#/editor/store";
import { keepOnHotReload } from "#/lib/hot";
import type { IRouteSampler } from "#/scene/routes";
import { type ITrafficCar, type ITrafficState, stepRoadTraffic } from "#/scene/traffic";

/**
 * Vehicles driving along roads, moved together each frame so they keep their
 * distance and overtake (scene/traffic.ts). Runtime only: nothing here is
 * saved. See docs/adr/0042-traffic-following-and-passing.md.
 */

/** A vehicle on a road, kept up to date by its EntityNode and moved by `TrafficStep`. */
export interface IDrivingVehicle {
	roadId: string;
	sampler: IRouteSampler;
	offset: number;
	/** The speed it's set to drive. */
	speed: number;
	length: number;
	/** Distance driven since it set off. */
	travelled: number;
	/** Its traffic state (speed now, how far out it is overtaking), once it has one. */
	state: ITrafficState | null;
}

/** Every driving vehicle, by entity id. */
export const drivingVehicles = keepOnHotReload(
	"drivingVehicles",
	() => new Map<string, IDrivingVehicle>(),
);

/** What the traffic remembers per road, by road id. */
const roadStates = keepOnHotReload(
	"roadStates",
	() => new Map<string, Map<string, ITrafficState>>(),
);

/** Moves every driving vehicle while motion plays. Mount once in the scene. */
export const TrafficStep = () => {
	const playing = useEditor((s) => s.playing);
	const { keepSpacing, allowOvertaking } = useEditor((s) => s.scene.traffic);

	// Before the vehicles draw themselves (they read where this put them).
	useFrame((_, delta) => {
		if (!playing) {
			return;
		}
		const dt = Math.min(delta, 0.1);
		// Spacing off: every vehicle simply drives at its own speed.
		if (!keepSpacing) {
			roadStates.clear();
			for (const vehicle of drivingVehicles.values()) {
				vehicle.travelled += vehicle.speed * dt;
				vehicle.state = null;
			}
			return;
		}
		const roads = new Map<string, [string, IDrivingVehicle][]>();
		for (const entry of drivingVehicles) {
			const list = roads.get(entry[1].roadId) ?? [];
			list.push(entry);
			roads.set(entry[1].roadId, list);
		}
		for (const [roadId, vehicles] of roads) {
			const { sampler } = vehicles[0][1];
			if (sampler.length === 0) {
				continue;
			}
			const cars: ITrafficCar[] = vehicles.map(([id, vehicle]) => {
				const place = vehicle.sampler.place(vehicle.offset, vehicle.travelled);
				return {
					id,
					stream: place.stream,
					ring: place.ring,
					position: place.position,
					centre: place.centre,
					direction: place.direction,
					turning: place.turning,
					length: vehicle.length,
					speed: vehicle.speed,
				};
			});
			const loop = cars[0].stream !== "both";
			const states = roadStates.get(roadId) ?? new Map<string, ITrafficState>();
			roadStates.set(roadId, states);
			const moves = stepRoadTraffic(
				{ length: sampler.length, loop, allowOvertaking },
				cars,
				states,
				dt,
			);
			for (const [id, vehicle] of vehicles) {
				vehicle.travelled += moves.get(id) ?? 0;
				vehicle.state = states.get(id) ?? null;
			}
		}
		for (const roadId of roadStates.keys()) {
			if (!roads.has(roadId)) {
				roadStates.delete(roadId);
			}
		}
	}, -1);

	return null;
};
