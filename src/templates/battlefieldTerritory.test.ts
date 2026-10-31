import { describe, expect, it } from "vitest";

import { roadAsDrawn, valuesOfRoad, vehiclesOnStream } from "#/editor/roadFlows";
import { entityAsDrawn, valuesOfEntity } from "#/parts/propData";
import { worldDataAt } from "#/scene/story";

import { createBattlefieldTerritoryScene } from "./battlefieldTerritory";

const scene = createBattlefieldTerritoryScene();

/** Battlefield 6's cluster and road as drawn on a date of the story. */
const battlefield6On = (at: string) => {
	const data = worldDataAt(scene.data, at);
	const cluster = scene.entities.find((entity) => entity.name === "Battlefield 6");
	const road = scene.roads.find((each) => each.dataRow?.rowKey === "Battlefield 6");
	if (!cluster || !road) {
		throw new Error("Battlefield 6 is missing");
	}
	const drawnRoad = roadAsDrawn(road, valuesOfRoad(road, data));
	return {
		scale: entityAsDrawn(cluster, valuesOfEntity(cluster, data)).scale,
		width: drawnRoad.width,
		vans: vehiclesOnStream(drawnRoad.flow, drawnRoad.flow.vehicleCountAlong, 20, 1),
	};
};

describe("Battlefield territory's story", () => {
	it("grows clusters with deliveries so far, and swells roads with each month's", () => {
		const before = battlefield6On("2025-07");
		const launch = battlefield6On("2025-08");
		const later = battlefield6On("2026-06");
		// Before its launch: no deliveries, the smallest cluster and an empty road.
		expect(before.vans).toBe(0);
		expect(launch.scale).toBeGreaterThan(before.scale);
		expect(launch.width).toBeGreaterThan(before.width);
		expect(launch.vans).toBeGreaterThan(0);
		// Later: a bigger cluster (more sent by then) on a quieter road (fewer that month).
		expect(later.scale).toBeGreaterThan(launch.scale);
		expect(later.width).toBeLessThan(launch.width);
		expect(later.vans).toBeLessThan(launch.vans);
	});
});
