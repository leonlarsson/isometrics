import { describe, expect, it } from "vitest";

import {
	connectEnds,
	connectToMiddle,
	cutLine,
	disconnectRoads,
	type IJunctionWorld,
	junctionPad,
	junctionsAfterJoin,
	junctionsAfterSplit,
	nearestOnControlLines,
	roadNetworkOf,
	settleJunctions,
	trimsAtJunction,
} from "./junctions";
import { buildRibbon, joinedPoints, polylineLength, roadCenterlineOf } from "./roads";
import { JunctionSchema, RoadSchema, type TJunction, type TRoad, type TRoadInput } from "./schema";

const road = (id: string, points: TRoadInput["points"], input: Partial<TRoadInput> = {}): TRoad =>
	RoadSchema.parse({ id, points, cornerRadius: 0, ...input });

const junction = (id: string, ...ends: [string, "start" | "end"][]): TJunction =>
	JunctionSchema.parse({ id, ends: ends.map(([roadId, end]) => ({ roadId, end })) });

/** A T at the origin: a road from the west and one to the east (the through road, cut), one to the north. */
const tWorld = (): IJunctionWorld => ({
	roads: [
		road("west", [
			[-10, 0],
			[0, 0],
		]),
		road("east", [
			[0, 0],
			[10, 0],
		]),
		road("north", [
			[0, 0],
			[0, -10],
		]),
	],
	junctions: [junction("j", ["west", "end"], ["east", "start"], ["north", "start"])],
});

describe("trimsAtJunction", () => {
	const w = 1.2;
	it("cuts nothing where two ends are in line", () => {
		expect(
			trimsAtJunction([
				{ direction: [1, 0], halfWidth: w },
				{ direction: [-1, 0], halfWidth: w },
			]),
		).toEqual([0, 0]);
	});

	it("cuts each road of a T back to past the others' edges, with room for a kerb", () => {
		const [west, east, north] = trimsAtJunction([
			{ direction: [-1, 0], halfWidth: w },
			{ direction: [1, 0], halfWidth: w },
			{ direction: [0, -1], halfWidth: w },
		]);
		expect(west).toBeCloseTo(east);
		expect(west).toBeGreaterThan(w);
		expect(north).toBeGreaterThan(w);
		expect(west).toBeLessThan(2 * w);
	});

	it("cuts more where roads meet at a sharp angle", () => {
		const at = (angle: number) =>
			trimsAtJunction([
				{ direction: [1, 0], halfWidth: w },
				{ direction: [Math.cos(angle), Math.sin(angle)], halfWidth: w },
			])[0];
		expect(at(Math.PI / 6)).toBeGreaterThan(at(Math.PI / 2));
	});
});

describe("roadNetworkOf", () => {
	it("finds each end's junction, and which roads it connects", () => {
		const { roads, junctions } = tWorld();
		const network = roadNetworkOf(roads, junctions);
		expect(network.junctions).toHaveLength(1);
		expect(network.junctionAt("west", "end")?.id).toBe("j");
		expect(network.junctionAt("west", "start")).toBeNull();
		expect(network.connects("north")).toBe(true);
		expect(network.drawTrimsOf("east").start).toBeGreaterThan(0);
		expect(network.drawTrimsOf("east").end).toBe(0);
		expect(network.junctions[0].place).toEqual([0, 0, 0]);
	});

	it("is worked out once per list of roads and junctions", () => {
		const { roads, junctions } = tWorld();
		expect(roadNetworkOf(roads, junctions)).toBe(roadNetworkOf(roads, junctions));
	});

	it("leaves out missing roads, loops, repeats and ends that aren't there", () => {
		const roads = [
			road("a", [
				[0, 0],
				[5, 0],
			]),
			road("far", [
				[20, 0],
				[30, 0],
			]),
			road(
				"loop",
				[
					[0, 0],
					[0, 5],
					[5, 5],
				],
				{ loops: true },
			),
		];
		const network = roadNetworkOf(roads, [
			junction("j", ["a", "start"], ["missing", "end"], ["loop", "start"], ["far", "start"]),
			junction("k", ["a", "start"], ["a", "end"]),
		]);
		expect(network.junctions).toHaveLength(0);
		expect(network.connects("a")).toBe(false);
	});

	it("gives hidden routes room to turn, and no cut surface", () => {
		const roads = [
			road("a", [
				[-10, 0],
				[0, 0],
			]),
			road(
				"b",
				[
					[0, 0],
					[0, 10],
				],
				{ kind: "hidden_route_01" },
			),
		];
		const network = roadNetworkOf(roads, [junction("j", ["a", "end"], ["b", "start"])]);
		const [a, b] = network.junctions[0].ends;
		expect(a.routeTrim).toBeGreaterThan(0);
		expect(b.routeTrim).toBeGreaterThan(0);
		expect(a.drawTrim).toBe(0);
		expect(b.drawTrim).toBe(0);
		expect(junctionPad(network, network.junctions[0])).toBeNull();
	});

	it("never cuts a road shorter than its two cuts away", () => {
		const roads = [
			road("short", [
				[0, 0],
				[1, 0],
			]),
			road("left", [
				[0, 0],
				[0, 10],
			]),
			road("right", [
				[1, 0],
				[1, 10],
			]),
		];
		const network = roadNetworkOf(roads, [
			junction("j", ["short", "start"], ["left", "start"]),
			junction("k", ["short", "end"], ["right", "start"]),
		]);
		const trims = network.drawTrimsOf("short");
		expect(trims.start + trims.end).toBeLessThan(1);
	});
});

describe("cutLine", () => {
	const line = roadCenterlineOf(
		road("r", [
			[0, 0, 0],
			[10, 0, 2],
		]),
	);
	it("cuts a line back at both ends along the ground", () => {
		const cut = cutLine(line, 2, 3);
		expect(cut[0][0]).toBeCloseTo(2);
		expect(cut.at(-1)?.[0]).toBeCloseTo(7);
		expect(polylineLength(cut, false)).toBeCloseTo(5);
	});

	it("is empty when the cuts meet", () => {
		expect(cutLine(line, 6, 5)).toEqual([]);
	});
});

describe("junctionPad", () => {
	const { roads, junctions } = tWorld();
	const network = roadNetworkOf(roads, junctions);
	const pad = junctionPad(network, network.junctions[0]);

	it("faces up everywhere", () => {
		expect(pad).not.toBeNull();
		const { vertices, indices } = pad!;
		for (let i = 0; i < indices.length; i += 3) {
			const [a, b, c] = [vertices[indices[i]], vertices[indices[i + 1]], vertices[indices[i + 2]]];
			const facesUp = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
			expect(facesUp).toBeGreaterThanOrEqual(0);
		}
	});

	it("meets every road's surface where it's cut, a little over it", () => {
		for (const r of roads) {
			const trims = network.drawTrimsOf(r.id);
			const cut = cutLine(roadCenterlineOf(r), trims.start, trims.end);
			const ribbon = buildRibbon(cut, r.width / 2, false);
			// The ribbon's corners at the junction end: the first three or last three vertices.
			const atJunction = trims.start > 0 ? ribbon.vertices.slice(0, 3) : ribbon.vertices.slice(-3);
			for (const corner of atJunction) {
				const nearest = Math.min(
					...pad!.vertices.map((v) => Math.hypot(v[0] - corner[0], v[1] - corner[1])),
				);
				expect(nearest).toBeLessThan(0.05);
			}
		}
	});

	it("covers the middle of the junction and stays within its roads' reach", () => {
		const reach = Math.max(...pad!.vertices.map((v) => Math.hypot(v[0], v[1])));
		expect(reach).toBeLessThan(4);
		// The back of the T is straight: nothing behind the through road's edge.
		expect(Math.max(...pad!.vertices.map((v) => v[1]))).toBeLessThanOrEqual(1.2 + 1e-6);
	});

	it("is the colour of its paved road", () => {
		const mixed = [
			road(
				"path",
				[
					[0, 0],
					[-10, 0],
				],
				{ kind: "dirt_path_01" },
			),
			road("street", [
				[0, 0],
				[0, 10],
			]),
		];
		const net = roadNetworkOf(mixed, [junction("j", ["path", "start"], ["street", "start"])]);
		expect(junctionPad(net, net.junctions[0])?.colorRoadId).toBe("street");
	});
});

describe("nearestOnControlLines", () => {
	it("finds the nearest point on the straight lines between a road's points", () => {
		const r = road("r", [
			[0, 0, 0],
			[10, 0, 2],
			[10, 10, 2],
		]);
		const near = nearestOnControlLines(r, [5, 1]);
		expect(near?.segment).toBe(0);
		expect(near?.point).toEqual([5, 0, 1]);
		expect(near?.gap).toBeCloseTo(1);
	});
});

describe("editing junctions", () => {
	it("connects an end to another road's end, and to a junction already there", () => {
		const world: IJunctionWorld = {
			roads: [
				road("a", [
					[0, 0],
					[10, 0],
				]),
				road("b", [
					[10.3, 0.2],
					[20, 0],
				]),
				road("c", [
					[10, 1],
					[10, 10],
				]),
			],
			junctions: [],
		};
		expect(
			connectEnds(world, { roadId: "b", end: "start" }, { roadId: "a", end: "end" }, "j"),
		).toBe("j");
		expect(world.roads[1].points[0]).toEqual([10, 0, 0]);
		expect(
			connectEnds(world, { roadId: "c", end: "start" }, { roadId: "b", end: "start" }, "k"),
		).toBe("j");
		expect(world.junctions).toHaveLength(1);
		expect(world.junctions[0].ends).toHaveLength(3);
	});

	it("cuts a road in two to connect an end to its middle, moving vehicles that start on the second half", () => {
		const world = {
			roads: [
				road("main", [
					[-10, 0],
					[10, 0],
				]),
				road("side", [
					[0.2, 5],
					[0.2, 0.3],
				]),
			],
			junctions: [] as TJunction[],
			entities: [
				{ follow: { roadId: "main", startDistance: 4 } },
				{ follow: { roadId: "main", startDistance: 15 } },
			],
		};
		const second = connectToMiddle(
			world,
			{ roadId: "side", end: "end" },
			{ roadId: "main", segment: 0, point: [0.2, 0] },
			{ road: "main-2", junction: "j" },
		);
		expect(second).toBe("main-2");
		expect(world.roads.map((r) => r.id)).toEqual(["main", "main-2", "side"]);
		expect(world.roads[0].points.at(-1)).toEqual([0.2, 0, 0]);
		expect(world.roads[1].points[0]).toEqual([0.2, 0, 0]);
		expect(world.roads[2].points.at(-1)).toEqual([0.2, 0, 0]);
		expect(world.junctions[0].ends).toEqual([
			{ roadId: "main", end: "end" },
			{ roadId: "main-2", end: "start" },
			{ roadId: "side", end: "end" },
		]);
		expect(world.entities[0].follow.roadId).toBe("main");
		expect(world.entities[1].follow).toEqual({ roadId: "main-2", startDistance: 15 - 10.2 });
	});

	it("opens a loop to connect to its middle", () => {
		const world = {
			roads: [
				road(
					"ring",
					[
						[0, 0],
						[10, 0],
						[10, 10],
						[0, 10],
					],
					{ loops: true },
				),
				road("spur", [
					[5, -10],
					[5, -0.5],
				]),
			],
			junctions: [] as TJunction[],
			entities: [],
		};
		connectToMiddle(
			world,
			{ roadId: "spur", end: "end" },
			{ roadId: "ring", segment: 0, point: [5, 0] },
			{ road: "unused", junction: "j" },
		);
		const ring = world.roads[0];
		expect(ring.loops).toBe(false);
		expect(ring.points[0]).toEqual([5, 0, 0]);
		expect(ring.points.at(-1)).toEqual([5, 0, 0]);
		expect(world.junctions[0].ends).toHaveLength(3);
		expect(roadNetworkOf(world.roads, world.junctions).junctions).toHaveLength(1);
	});

	it("keeps a split road's last end at its junction", () => {
		const world = tWorld();
		world.roads[1].points.push([20, 0, 0]);
		world.junctions.push(junction("k", ["east", "end"], ["north", "end"]));
		junctionsAfterSplit(world, "east", "east-2");
		expect(world.junctions[1].ends[0]).toEqual({ roadId: "east-2", end: "end" });
	});

	it("keeps a joined road's other ends at their junctions", () => {
		const world: IJunctionWorld = {
			roads: [],
			junctions: [
				junction("j", ["a", "start"], ["x", "end"]),
				junction("k", ["b", "start"], ["y", "end"]),
			],
		};
		// a's end joins b's end: a as it is, then b reversed, so b's start is the joined road's end.
		expect(joinedPoints([[0], [1]], "end", [[3], [2]], "end")).toEqual([[0], [1], [2], [3]]);
		junctionsAfterJoin(world, "a", "end", "b", "end");
		expect(world.junctions[0].ends[0]).toEqual({ roadId: "a", end: "start" });
		expect(world.junctions[1].ends[0]).toEqual({ roadId: "a", end: "end" });
	});

	it("takes a deleted road's ends out, and removes a junction left with one end", () => {
		const world = tWorld();
		disconnectRoads(world, new Set(["north"]));
		expect(world.junctions[0].ends).toHaveLength(2);
		disconnectRoads(world, new Set(["east"]));
		expect(world.junctions).toHaveLength(0);
	});
});

describe("settleJunctions", () => {
	it("brings the other ends along when one end moves", () => {
		const before = tWorld();
		const after = structuredClone(before);
		after.roads[2].points[0] = [1, 1, 0.5];
		settleJunctions(before, after);
		expect(after.roads[0].points.at(-1)).toEqual([1, 1, 0.5]);
		expect(after.roads[1].points[0]).toEqual([1, 1, 0.5]);
	});

	it("keeps an end's own width when it moves it", () => {
		const before = tWorld();
		before.roads[0].points[1] = [0, 0, 0, 3];
		const after = structuredClone(before);
		after.roads[1].points[0] = [2, 0, 0];
		settleJunctions(before, after);
		expect(after.roads[0].points[1]).toEqual([2, 0, 0, 3]);
	});

	it("drops ends of roads that are gone or now loop, and junctions left with one", () => {
		const before = tWorld();
		const after = structuredClone(before);
		after.roads = after.roads.filter((r) => r.id !== "north");
		after.roads[0].loops = true;
		after.roads[0].points.push([-5, 5, 0]);
		settleJunctions(before, after);
		expect(after.junctions).toHaveLength(0);
	});

	it("leaves an end out rather than pull it from far away", () => {
		const before: IJunctionWorld = {
			roads: [
				road("a", [
					[0, 0],
					[5, 0],
				]),
				road("b", [
					[20, 0],
					[30, 0],
				]),
				road("c", [
					[0, 0],
					[0, 5],
				]),
			],
			junctions: [junction("j", ["a", "start"], ["b", "start"], ["c", "start"])],
		};
		const after = structuredClone(before);
		after.roads[0].points[0] = [0.5, 0, 0];
		settleJunctions(before, after);
		expect(after.roads[1].points[0]).toEqual([20, 0, 0]);
		expect(after.roads[2].points[0]).toEqual([0.5, 0, 0]);
		expect(after.junctions[0].ends.map((e) => e.roadId)).toEqual(["a", "c"]);
	});
});
