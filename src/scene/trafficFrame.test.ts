import { describe, expect, it } from "vitest";

import { createFlowTrip } from "./flows";
import { roadNetworkOf } from "./junctions";
import { polylineLength } from "./roads";
import { centerlineOf } from "./routes";
import { JunctionSchema, RoadSchema, type TRoadInput } from "./schema";
import type { ITrafficState } from "./traffic";
import { type IDrivingVehicle, stepAllTraffic } from "./trafficFrame";

const road = (id: string, points: TRoadInput["points"], input: Partial<TRoadInput> = {}) =>
	RoadSchema.parse({ id, points, isOneWay: true, curveShape: "throughPoints", ...input });

/** Vehicles every `spacing` along each road given, driving on across the network. */
const vehiclesOn = (
	network: ReturnType<typeof roadNetworkOf>,
	roadIds: string[],
	spacing: number,
	speed: (index: number) => number,
) => {
	const vehicles = new Map<string, IDrivingVehicle>();
	for (const roadId of roadIds) {
		const length = polylineLength(
			centerlineOf(network.roadById(roadId) as ReturnType<typeof road>),
			false,
		);
		for (let k = 0; k * spacing < length - 2; k++) {
			vehicles.set(`${roadId}:${k}`, {
				roadId,
				sampler: createFlowTrip(network, roadId, {
					driving: "right",
					smoothing: 0.6,
					reverse: false,
					offset: k * spacing,
					length,
					index: k,
				}),
				offset: 0,
				speed: speed(k),
				length: 1.2,
				travelled: 0,
				state: null,
			});
		}
	}
	return vehicles;
};

/** Over a minute of frames: the closest any two vehicles from different roads came to each other. */
const closestApproach = (vehicles: Map<string, IDrivingVehicle>, seconds = 60) => {
	const states = new Map<string, Map<string, ITrafficState>>();
	let closest = Number.POSITIVE_INFINITY;
	for (let frame = 0; frame < seconds * 30; frame++) {
		stepAllTraffic(vehicles, states, 1 / 30, { keepsDistance: true, overtakes: true });
		const placed = [...vehicles.values()].map((vehicle) => ({
			at: vehicle.sampler.at(vehicle.offset, vehicle.travelled).position,
			size: vehicle.sampler.sizeAt?.(vehicle.offset, vehicle.travelled) ?? 1,
		}));
		for (let i = 0; i < placed.length; i++) {
			for (let j = i + 1; j < placed.length; j++) {
				// Not while they settle from where they were put (at first some start inside a junction), and
				// not vehicles shrinking out or growing in where they start over.
				if (frame < 5 * 30 || placed[i].size < 1 || placed[j].size < 1) {
					continue;
				}
				const [a, b] = [placed[i].at, placed[j].at];
				const gap = Math.hypot(a[0] - b[0], a[1] - b[1]);
				closest = Math.min(closest, gap);
			}
		}
	}
	return closest;
};

describe("vehicles at junctions where a road is one-way (ADR-0148)", () => {
	it("take turns where a slip road merges, never driving into each other", () => {
		const network = roadNetworkOf(
			[
				road("in", [
					[-50, 0],
					[0, 0],
				]),
				road("slip", [
					[-50, -14],
					[-24, -7],
					[-9, -1.6],
					[0, 0],
				]),
				road("out", [
					[0, 0],
					[60, 0],
				]),
			],
			[
				JunctionSchema.parse({
					id: "merge",
					ends: [
						{ roadId: "in", end: "end" },
						{ roadId: "out", end: "start" },
						{ roadId: "slip", end: "end" },
					],
				}),
			],
		);
		expect(network.junctions[0].gore).not.toBeNull();
		const vehicles = vehiclesOn(network, ["in", "slip"], 4, (k) => 2.5 + (k % 3) * 0.4);
		// Bumper to bumper is 1.2 apart: they never come closer than most of a vehicle.
		expect(closestApproach(vehicles)).toBeGreaterThan(1);
	});

	it("never cross a junction of one-way roads at once from different ends", () => {
		const network = roadNetworkOf(
			[
				road("west", [
					[-40, 0],
					[0, 0],
				]),
				road("east", [
					[0, 0],
					[40, 0],
				]),
				road("north", [
					[0, -40],
					[0, 0],
				]),
				road("south", [
					[0, 0],
					[0, 40],
				]),
			],
			[
				JunctionSchema.parse({
					id: "cross",
					ends: [
						{ roadId: "west", end: "end" },
						{ roadId: "east", end: "start" },
						{ roadId: "north", end: "end" },
						{ roadId: "south", end: "start" },
					],
				}),
			],
		);
		const vehicles = vehiclesOn(network, ["west", "north"], 5, () => 3);
		expect(closestApproach(vehicles)).toBeGreaterThan(1);
	});
});
