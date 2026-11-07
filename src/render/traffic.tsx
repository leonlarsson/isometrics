import { useFrame } from "@react-three/fiber";

import { useEditor } from "#/editor/store";
import { keepOnHotReload } from "#/lib/hot";
import type { ITrafficState } from "#/scene/traffic";
import { type IDrivingVehicle, stepAllTraffic } from "#/scene/trafficFrame";

/**
 * Vehicles driving along roads, moved together each frame so they keep their
 * distance and overtake (scene/traffic.ts, scene/trafficFrame.ts). Runtime only:
 * nothing here is saved. See docs/adr/0042-traffic-following-and-passing.md.
 */

export type { IDrivingVehicle };

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
	const { keepsDistance, overtakes } = useEditor((s) => s.scene.traffic);

	// Before the vehicles draw themselves (they read where this put them).
	useFrame((_, delta) => {
		if (!playing) {
			return;
		}
		stepAllTraffic(drivingVehicles, roadStates, Math.min(delta, 0.1), {
			keepsDistance,
			overtakes,
		});
	}, -1);

	return null;
};
