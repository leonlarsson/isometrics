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
				// Not while they settle from where they were put (at first some start inside a junction and
				// drive out of it), and not vehicles shrinking out or growing in where they start over.
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
	it("take turns where a road joins another, never driving into each other", () => {
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

	it("keep moving and apart for ten minutes on a dense network of one-way rings crossing at four junctions", () => {
		// Two one-way rings, a wide one and a tall one, crossing at four junctions of two ways in and two
		// out; vehicles every 3 along every road (about a third of the road taken), turning as they like.
		const ring = (prefix: string, points: [number, number][]) =>
			points.map((from, i) =>
				road(`${prefix}${i}`, [from, points[(i + 1) % points.length]], {
					curveShape: "roundedCorners",
				}),
			);
		const roads = [
			...ring("a", [
				[10, 10],
				[-10, 10],
				[-10, -10],
				[10, -10],
			]).map((each, i) =>
				i === 1 || i === 3
					? RoadSchema.parse({
							...each,
							points:
								i === 1
									? [
											[-10, 10],
											[-30, 10],
											[-30, -10],
											[-10, -10],
										]
									: [
											[10, -10],
											[30, -10],
											[30, 10],
											[10, 10],
										],
						})
					: each,
			),
			...ring("b", [
				[-10, -10],
				[-10, 10],
				[10, 10],
				[10, -10],
			]).map((each, i) =>
				i === 1 || i === 3
					? RoadSchema.parse({
							...each,
							points:
								i === 1
									? [
											[-10, 10],
											[-10, 30],
											[10, 30],
											[10, 10],
										]
									: [
											[10, -10],
											[10, -30],
											[-10, -30],
											[-10, -10],
										],
						})
					: each,
			),
		];
		const at = (x: number, z: number) =>
			roads.flatMap((each) => {
				const ends: { roadId: string; end: "start" | "end" }[] = [];
				const [first, last] = [each.points[0], each.points[each.points.length - 1]];
				if (first[0] === x && first[1] === z) {
					ends.push({ roadId: each.id, end: "start" });
				}
				if (last[0] === x && last[1] === z) {
					ends.push({ roadId: each.id, end: "end" });
				}
				return ends;
			});
		const network = roadNetworkOf(
			roads,
			[
				[10, 10],
				[-10, 10],
				[-10, -10],
				[10, -10],
			].map(([x, z], i) => JunctionSchema.parse({ id: `j${i}`, ends: at(x, z) })),
		);
		expect(network.junctions.every((junction) => junction.ends.length === 4)).toBe(true);
		const vehicles = vehiclesOn(
			network,
			roads.map((each) => each.id),
			3,
			(k) => 2.5 + (k % 3) * 0.4,
		);
		const minutes = 10;
		const states = new Map<string, Map<string, ITrafficState>>();
		let closest = Number.POSITIVE_INFINITY;
		const movedSince = new Map<string, number>();
		let stuck = 0;
		for (let frame = 0; frame < minutes * 60 * 30; frame++) {
			stepAllTraffic(vehicles, states, 1 / 30, { keepsDistance: true, overtakes: true });
			// Every minute, every vehicle has moved on since the last.
			if (frame % (60 * 30) === 0) {
				for (const [id, vehicle] of vehicles) {
					if (frame > 0 && vehicle.travelled - (movedSince.get(id) ?? 0) < 1) {
						stuck++;
					}
					movedSince.set(id, vehicle.travelled);
				}
			}
			if (frame < 10 * 30 || frame % 3 !== 0) {
				continue;
			}
			const placed = [...vehicles.values()].map(
				(vehicle) => vehicle.sampler.at(vehicle.offset, vehicle.travelled).position,
			);
			for (let i = 0; i < placed.length; i++) {
				for (let j = i + 1; j < placed.length; j++) {
					closest = Math.min(
						closest,
						Math.hypot(placed[i][0] - placed[j][0], placed[i][1] - placed[j][1]),
					);
				}
			}
		}
		expect(vehicles.size).toBeGreaterThan(80);
		expect(stuck).toBe(0);
		expect(closest).toBeGreaterThan(1);
	}, 60_000);
});
