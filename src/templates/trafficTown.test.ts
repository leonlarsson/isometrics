import { describe, expect, it } from "vitest";

import { flowDrivesOn } from "#/scene/flows";
import { roadNetworkOf } from "#/scene/junctions";
import { pillarPositions, roadCenterlineOf } from "#/scene/roads";

import { createTrafficTownScene } from "./trafficTown";

describe("the Traffic town template", () => {
	const scene = createTrafficTownScene();
	const network = roadNetworkOf(scene.roads, scene.junctions);
	const road = (id: string) => {
		const found = scene.roads.find((each) => each.id === id);
		if (!found) {
			throw new Error(`No road ${id}`);
		}
		return found;
	};

	it("has background traffic on the network, and a data flow that keeps to its own road", () => {
		const drivingOn = scene.roads.filter((each) => flowDrivesOn(network, each));
		expect(new Set(drivingOn.map((each) => each.flow.vehicleKind))).toEqual(
			new Set(["car_01", "delivery_van_01", "truck_01", "bus_01"]),
		);
		const freight = road("freight_road");
		expect(network.connects(freight.id)).toBe(false);
		expect(freight.flow.enabled && !flowDrivesOn(network, freight)).toBe(true);
		expect(Object.keys(freight.data).sort()).toEqual(["vehicleDensity", "width"]);
	});

	it("joins only roads at the same height: the flyover and the bypass's tunnel aren't junctions", () => {
		const joined = new Set(scene.junctions.flatMap((each) => each.ends.map((end) => end.roadId)));
		expect(joined.has("bypass")).toBe(false);
		for (const junction of scene.junctions) {
			const heights = junction.ends.map((end) => {
				const { points } = road(end.roadId);
				return (end.end === "start" ? points[0] : points[points.length - 1])[2];
			});
			expect(new Set(heights).size, junction.id).toBe(1);
		}
	});

	// The flyover's pillars stand either side of School Lane, never in it, where vehicles would drive through them.
	it("keeps the flyover's pillars off School Lane", () => {
		const bypass = road("bypass");
		const lane = road("school_lane");
		const laneX = lane.points[0][0];
		const pillars = pillarPositions(roadCenterlineOf(bypass), bypass.loops, bypass.pillarSpacing);
		const nearest = Math.min(...pillars.map((pillar) => Math.abs(pillar[0] - laneX)));
		expect(nearest).toBeGreaterThan(lane.width / 2 + 0.5);
	});

	it("has vehicles that follow roads it has, one kept to its own road", () => {
		const roads = new Set(scene.roads.map((each) => each.id));
		const followers = scene.entities.filter((entity) => entity.follow);
		for (const entity of followers) {
			expect(roads.has(entity.follow?.roadId ?? ""), entity.id).toBe(true);
		}
		expect(followers.filter((entity) => entity.follow?.drivesThroughJunctions === false)).toEqual([
			expect.objectContaining({ id: "post_van" }),
		]);
	});
});
