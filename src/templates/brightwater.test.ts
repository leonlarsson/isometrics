import { describe, expect, it } from "vitest";

import { validateWorld } from "#/parts/validateWorld";
import { roadNetworkOf } from "#/scene/junctions";
import { drivesAcrossNetwork, pathAhead } from "#/scene/network";

import { createBrightwaterScene } from "./brightwater";

describe("the Brightwater template's streets (ADR-0136)", () => {
	const scene = createBrightwaterScene();
	const network = roadNetworkOf(scene.roads, scene.junctions);

	it("meets at junctions with every end where it should be, and no warnings", () => {
		const read = network.junctions.map((junction) => junction.ends.length);
		expect(read).toEqual(scene.junctions.map((junction) => junction.ends.length));
		const { problems, warnings } = validateWorld(JSON.parse(JSON.stringify(scene)));
		expect(problems).toEqual([]);
		expect(warnings).toEqual([]);
	});

	/** The roads a vehicle drives over the next `distance`, from where it starts. */
	const roadsDriven = (id: string, distance: number) => {
		const vehicle = scene.entities.find((entity) => entity.id === id);
		const follow = vehicle?.follow;
		if (!follow) {
			throw new Error(`no vehicle ${id}`);
		}
		const options = {
			driving: scene.traffic.drivingSide,
			startDistance: follow.startDistance,
			reverse: follow.drivesTheOtherWay,
			seed: id,
		};
		return new Set(
			pathAhead(network, follow.roadId, options, follow.startDistance, distance).roads,
		);
	};

	it("lets the city's traffic drive on round the network, but never up the hill trail", () => {
		const everywhere = new Set<string>();
		for (const id of ["ring_car_1", "ring_car_2", "ring_van", "ring_bus", "harbour_truck"]) {
			const roads = roadsDriven(id, 2000);
			expect(roads.has("hill_trail"), id).toBe(false);
			for (const road of roads) {
				everywhere.add(road);
			}
		}
		expect(everywhere.size).toBeGreaterThan(4);
	});

	it("keeps the tram on the high street and the cyclist on the hill trail", () => {
		for (const [id, roadId] of [
			["old_town_tram", "high_street"],
			["hill_cyclist", "hill_trail"],
		]) {
			const vehicle = scene.entities.find((entity) => entity.id === id);
			const road = scene.roads.find((r) => r.id === roadId);
			expect(vehicle?.follow?.roadId).toBe(roadId);
			expect(road && drivesAcrossNetwork(network, road, scene.traffic, vehicle?.follow)).toBe(
				false,
			);
		}
	});
});
