import { describe, expect, it } from "vitest";

import { roadNetworkOf } from "./junctions";
import { chanceOf, createNetworkTrip, pickWayOut, roadsDriven } from "./network";
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
