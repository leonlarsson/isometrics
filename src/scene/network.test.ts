import { describe, expect, it } from "vitest";

import { roadNetworkOf } from "./junctions";
import {
	chanceOf,
	createNetworkTrip,
	drivesAcrossNetwork,
	pathAhead,
	pickWayOut,
	roadsDriven,
} from "./network";
import { resolveDrivesThroughJunctions } from "./roads";
import { createRouteSampler } from "./routes";
import { JunctionSchema, RoadSchema, type TJunction, type TRoad, type TRoadInput } from "./schema";

const road = (id: string, points: TRoadInput["points"], input: Partial<TRoadInput> = {}): TRoad =>
	RoadSchema.parse({ id, points, cornerRadius: 0, ...input });

const junction = (id: string, ...ends: [string, "start" | "end"][]): TJunction =>
	JunctionSchema.parse({ id, ends: ends.map(([roadId, end]) => ({ roadId, end })) });

/** A crossroads at the origin, each arm 20 long and a dead end. */
const crossroads = () =>
	roadNetworkOf(
		[
			road("west", [
				[-20, 0],
				[0, 0],
			]),
			road("east", [
				[0, 0],
				[20, 0],
			]),
			road("north", [
				[0, 0],
				[0, -20],
			]),
			road("south", [
				[0, 20],
				[0, 0],
			]),
		],
		[junction("j", ["west", "end"], ["east", "start"], ["north", "start"], ["south", "end"])],
	);

/** A square of four roads, a junction at each corner, so there's no dead end. */
const block = () =>
	roadNetworkOf(
		[
			road("top", [
				[0, 0],
				[20, 0],
			]),
			road("right", [
				[20, 0],
				[20, 20],
			]),
			road("bottom", [
				[20, 20],
				[0, 20],
			]),
			road("left", [
				[0, 20],
				[0, 0],
			]),
			road("spur", [
				[20, 0],
				[40, 0],
			]),
		],
		[
			junction("a", ["left", "end"], ["top", "start"]),
			junction("b", ["top", "end"], ["right", "start"], ["spur", "start"]),
			junction("c", ["right", "end"], ["bottom", "start"]),
			junction("d", ["bottom", "end"], ["left", "start"]),
		],
	);

const trip = (network: ReturnType<typeof crossroads>, roadId: string, seed = "car", extra = {}) =>
	createNetworkTrip(network, roadId, {
		driving: "right",
		smoothing: 0.5,
		startDistance: 2,
		seed,
		...extra,
	});

describe("pickWayOut", () => {
	it("picks evenly among the ways by the chance it's given", () => {
		const ways = [
			{ roadId: "a", end: "start" as const },
			{ roadId: "b", end: "start" as const },
		];
		expect(pickWayOut(ways, 0).roadId).toBe("a");
		expect(pickWayOut(ways, 0.99).roadId).toBe("b");
		expect(pickWayOut(ways, 1).roadId).toBe("b");
	});

	it("gets the same chances for the same vehicle, and different ones for others", () => {
		expect(chanceOf("car", 3)).toBe(chanceOf("car", 3));
		const chances = Array.from({ length: 200 }, (_, i) => chanceOf(`car-${i}`, 1));
		expect(Math.min(...chances)).toBeGreaterThanOrEqual(0);
		expect(Math.max(...chances)).toBeLessThan(1);
		const mean = chances.reduce((a, b) => a + b, 0) / chances.length;
		expect(mean).toBeGreaterThan(0.4);
		expect(mean).toBeLessThan(0.6);
	});
});

describe("createNetworkTrip", () => {
	it("drives on from its road at a junction, never straight back", () => {
		for (let i = 0; i < 20; i++) {
			const roads = roadsDriven(trip(crossroads(), "west", `car-${i}`), 30);
			expect(roads[0]).toBe("west");
			expect(["east", "north", "south"]).toContain(roads[1]);
		}
	});

	it("turns round only at dead ends", () => {
		const roads = roadsDriven(trip(crossroads(), "west", "car-1"), 400);
		// Each arm is a dead end: after a junction it drives an arm out and back, so each arm appears
		// once per visit, and two visits in a row are never the same arm.
		for (let i = 1; i < roads.length; i++) {
			expect(roads[i]).not.toBe(roads[i - 1]);
		}
		expect(new Set(roads).size).toBeGreaterThan(2);
	});

	it("never turns round where there's another way", () => {
		const t = trip(block(), "top", "van");
		let direction = t.place(0, 0).direction;
		let roadId = t.place(0, 0).network?.roadId;
		for (let d = 0; d < 1000; d += 0.5) {
			const place = t.place(0, d);
			if (place.network?.roadId === roadId && place.direction !== direction) {
				// Only the spur has a dead end.
				expect(roadId).toBe("spur");
			}
			roadId = place.network?.roadId;
			direction = place.direction;
		}
	});

	it("takes the same way every time for the same vehicle, and different ways for different ones", () => {
		const a = roadsDriven(trip(block(), "top", "bus"), 600);
		const b = roadsDriven(trip(block(), "top", "bus"), 600);
		expect(a).toEqual(b);
		const others = Array.from({ length: 10 }, (_, i) =>
			roadsDriven(trip(block(), "top", `bus-${i}`), 600).join(),
		);
		expect(new Set(others).size).toBeGreaterThan(1);
	});

	it("moves smoothly through junctions and turns, without jumps", () => {
		for (const seed of ["a", "b", "c", "d"]) {
			const t = trip(block(), "top", seed);
			let last = t.at(0, 0);
			for (let d = 0.05; d < 300; d += 0.05) {
				const now = t.at(0, d);
				const moved = Math.hypot(
					now.position[0] - last.position[0],
					now.position[1] - last.position[1],
				);
				expect(moved).toBeLessThan(0.12);
				const turned = Math.abs(
					Math.atan2(Math.sin(now.heading - last.heading), Math.cos(now.heading - last.heading)),
				);
				expect(turned).toBeLessThan(0.35);
				last = now;
			}
		}
	});

	it("keeps to its lane on the driving side as it goes from road to road", () => {
		const t = trip(block(), "top", "a");
		for (let d = 0; d < 300; d += 1) {
			const place = t.place(0, d);
			if (place.turning) {
				continue;
			}
			const sample = t.at(0, d);
			// The block is driven inside or outside, always on the right of travel: for a vehicle going
			// along x, the right is +z.
			const heading = sample.heading;
			const right: [number, number] = [Math.sin(heading), Math.cos(heading)];
			const roadId = place.network?.roadId;
			const lineAt: Record<string, (p: [number, number]) => [number, number]> = {
				top: (p) => [p[0], 0],
				bottom: (p) => [p[0], 20],
				left: (p) => [0, p[1]],
				right: (p) => [20, p[1]],
				spur: (p) => [p[0], 0],
			};
			const centre = lineAt[roadId as string](sample.position);
			const side =
				(sample.position[0] - centre[0]) * right[0] + (sample.position[1] - centre[1]) * right[1];
			expect(side).toBeGreaterThan(0.3);
		}
	});

	it("starts again from where it began when driving starts again", () => {
		const t = trip(block(), "top", "a");
		const start = t.at(0, 0);
		t.at(0, 500);
		const again = t.at(0, 0);
		expect(again.position[0]).toBeCloseTo(start.position[0]);
		expect(again.position[1]).toBeCloseTo(start.position[1]);
	});

	it("starts where its follow says, either way", () => {
		const t = trip(crossroads(), "west", "a", { startDistance: 5, reverse: true });
		const place = t.place(0, 0);
		expect(place.direction).toBe(-1);
		expect(place.centre).toBeCloseTo(5);
		expect(place.network?.roadId).toBe("west");
		// Reversed on the west arm, it drives to its dead end first and turns.
		expect(roadsDriven(t, 25)).toEqual(["west"]);
		expect(roadsDriven(t, 30)).toHaveLength(2);
	});

	it("says where it goes next, for traffic to keep its distance through the junction", () => {
		const t = trip(crossroads(), "west", "a");
		const place = t.place(0, 0);
		expect(place.network?.next.roadId).not.toBe("west");
		expect(place.network?.next.direction).toBeDefined();
		expect(place.network?.next.distance).toBeGreaterThan(15);
		expect(place.network?.next.distance).toBeLessThan(20);
		expect(place.stream).toBe("forward");
	});
});

describe("pathAhead", () => {
	const options = { driving: "right" as const, smoothing: 0.5, startDistance: 2, seed: "taxi" };

	it("is the way the vehicle then drives, through its junctions", () => {
		for (const from of [0, 37, 180]) {
			const ahead = pathAhead(block(), "top", options, from, 60);
			// The vehicle's own trip, driven there as it would be, frame by frame.
			const vehicle = createNetworkTrip(block(), "top", options);
			for (let d = 0; d < from; d += 0.5) {
				vehicle.at(0, d);
			}
			ahead.samples.forEach((sample, i) => {
				const driven = vehicle.at(0, from + (60 * i) / (ahead.samples.length - 1));
				expect(sample.position[0]).toBeCloseTo(driven.position[0], 6);
				expect(sample.position[1]).toBeCloseTo(driven.position[1], 6);
			});
			expect(ahead.roads[0]).toBe(vehicle.place(0, from).network?.roadId);
			expect(ahead.roads.length).toBeGreaterThan(2);
		}
	});

	it("starts where a vehicle dropped on a road would, the way it would go", () => {
		const ahead = pathAhead(
			block(),
			"right",
			{ ...options, startDistance: 5, reverse: true },
			0,
			30,
		);
		// Reversed on the right side road, from 5 along it, it heads north, in the lane on its right.
		expect(ahead.samples[0].position[0]).toBeCloseTo(20 + 0.528, 2);
		expect(ahead.samples[0].position[1]).toBeCloseTo(5, 1);
		expect(ahead.roads.slice(0, 2)).toEqual(["right", "top"]);
	});
});

describe("driving through junctions, or not", () => {
	it("follows the vehicle's own setting, else its road's, else the world's", () => {
		expect(resolveDrivesThroughJunctions(true, null, null)).toBe(true);
		expect(resolveDrivesThroughJunctions(true, false, null)).toBe(false);
		expect(resolveDrivesThroughJunctions(false, true, null)).toBe(true);
		expect(resolveDrivesThroughJunctions(true, false, true)).toBe(true);
		expect(resolveDrivesThroughJunctions(true, null, false)).toBe(false);
	});

	it("drives across the network only from a road with a junction, when the settings let it", () => {
		const network = block();
		const top = network.roadById("top") as TRoad;
		const on = { drivesThroughJunctions: true };
		const off = { drivesThroughJunctions: false };
		expect(drivesAcrossNetwork(network, top, on, null)).toBe(true);
		expect(drivesAcrossNetwork(network, top, off, null)).toBe(false);
		expect(drivesAcrossNetwork(network, top, on, { drivesThroughJunctions: false })).toBe(false);
		expect(drivesAcrossNetwork(network, top, off, { drivesThroughJunctions: true })).toBe(true);
		const keepsTo = { ...top, traffic: { ...top.traffic, drivesThroughJunctions: false } };
		expect(drivesAcrossNetwork(network, keepsTo, on, null)).toBe(false);
		const alone = road("alone", [
			[0, 50],
			[10, 50],
		]);
		expect(drivesAcrossNetwork(network, alone, on, null)).toBe(false);
	});

	it("off, a vehicle keeps to its road, turning round at its junctions as at dead ends", () => {
		const top = block().roadById("top") as TRoad;
		// What a vehicle that doesn't drive through gets: its road's own route, there and back.
		const route = createRouteSampler(top, "right", { smoothing: 0.5 });
		for (let d = 0; d < 200; d += 0.5) {
			const { position } = route.at(2, d);
			expect(Math.abs(position[1])).toBeLessThan(1.5);
			expect(position[0]).toBeGreaterThan(-1.5);
			expect(position[0]).toBeLessThan(21.5);
		}
	});
});

describe("one-way roads and the way through a junction (ADR-0148)", () => {
	/** A carriageway in to a junction, on out of it, a ramp off it, and the other carriageway back. */
	const interchange = (backBeside = false) =>
		roadNetworkOf(
			[
				road(
					"in",
					[
						[-20, 0],
						[0, 0],
					],
					{ isOneWay: true },
				),
				road(
					"out",
					[
						[0, 0],
						[20, 0],
					],
					{ isOneWay: true },
				),
				road(
					"ramp",
					[
						[0, 0],
						[0, 20],
					],
					{ isOneWay: true },
				),
				road("back", [[0, 0], backBeside ? [-20, 1] : [-20, -30]], { isOneWay: true }),
			],
			[junction("j", ["in", "end"], ["out", "start"], ["ramp", "start"], ["back", "start"])],
		);

	it("never drives a one-way road against its way, whatever the vehicle says", () => {
		const one = road(
			"a",
			[
				[0, 0],
				[20, 0],
			],
			{ isOneWay: true },
		);
		const sampler = createRouteSampler(one, "right", { reverse: true });
		let x = sampler.at(2, 0).position[0];
		for (let d = 0.5; d < 15; d += 0.5) {
			const next = sampler.at(2, d).position[0];
			expect(next).toBeGreaterThan(x);
			x = next;
		}
		// Down its middle: a one-way road's one lane is all of it.
		expect(sampler.at(2, 0).position[1]).toBeCloseTo(0);
	});

	it("starts over at the end of a one-way road with no way on, shrinking out and growing in", () => {
		const one = road(
			"a",
			[
				[0, 0],
				[20, 0],
			],
			{ isOneWay: true },
		);
		const sampler = createRouteSampler(one, "right");
		expect(sampler.at(0, 25).position[0]).toBeCloseTo(5);
		expect(sampler.sizeAt?.(0, 19.9)).toBeLessThan(0.1);
		expect(sampler.sizeAt?.(0, 10)).toBe(1);
		expect(sampler.place(0, 10).isOneWay).toBe(true);
		const network = roadNetworkOf(
			[
				one,
				road(
					"b",
					[
						[20, 0],
						[20, 20],
					],
					{ isOneWay: true },
				),
			],
			[junction("j", ["a", "end"], ["b", "start"])],
		);
		const onNetwork = createNetworkTrip(network, "a", {
			driving: "right",
			startDistance: 5,
			seed: "car",
		});
		// Its dead end leads back to where it started, again and again.
		expect(roadsDriven(onNetwork, 80)).toEqual(["a", "b", "a", "b", "a"]);
		expect(onNetwork.sizeAt?.(0, 50)).toBe(1);
	});

	it("never turns onto a one-way road against its way, nor back through the junction", () => {
		const network = interchange(true);
		for (let n = 0; n < 60; n++) {
			const roads = roadsDriven(trip(network, "in", `car${n}`), 30);
			expect(roads[0]).toBe("in");
			// "back" leaves almost the way "in" arrived: a U-turn, never taken while there's another way.
			expect(["out", "ramp"]).toContain(roads[1]);
		}
	});

	it("mostly carries straight on at a junction where a road is one-way", () => {
		const network = interchange();
		const counts = new Map<string, number>();
		for (let n = 0; n < 400; n++) {
			const next = roadsDriven(trip(network, "in", `car${n}`), 30)[1];
			counts.set(next, (counts.get(next) ?? 0) + 1);
		}
		expect(counts.get("out") ?? 0).toBeGreaterThan(250);
		expect(counts.get("ramp") ?? 0).toBeGreaterThan(30);
	});

	it("takes only the turns its end allows (leadsTo)", () => {
		const roads = crossroads();
		const network = roadNetworkOf(
			["west", "east", "north", "south"].map((id) => roads.roadById(id) as TRoad),
			[
				JunctionSchema.parse({
					id: "j",
					ends: [
						{ roadId: "west", end: "end", leadsTo: [{ roadId: "north", end: "start" }] },
						{ roadId: "east", end: "start" },
						{ roadId: "north", end: "start" },
						{ roadId: "south", end: "end" },
					],
				}),
			],
		);
		for (let n = 0; n < 30; n++) {
			expect(roadsDriven(trip(network, "west", `car${n}`, { startDistance: 2 }), 30)[1]).toBe(
				"north",
			);
		}
	});

	it("picks exactly as before where no road is one-way and no turns are set", () => {
		const ways = [
			{ roadId: "a", end: "start" as const },
			{ roadId: "b", end: "start" as const },
			{ roadId: "c", end: "end" as const },
		];
		for (let n = 0; n < 50; n++) {
			const chance = chanceOf("car", n);
			expect(pickWayOut(ways, chance, null)).toBe(pickWayOut(ways, chance));
		}
		const network = crossroads();
		expect(network.junctions[0].hasOneWayRoad).toBe(false);
		const counts = new Map<string, number>();
		for (let n = 0; n < 300; n++) {
			const next = roadsDriven(trip(network, "west", `car${n}`), 30)[1];
			counts.set(next, (counts.get(next) ?? 0) + 1);
		}
		for (const way of ["east", "north", "south"]) {
			expect(counts.get(way) ?? 0).toBeGreaterThan(70);
		}
	});
});
