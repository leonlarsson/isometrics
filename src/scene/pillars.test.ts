import { describe, expect, it } from "vitest";

import { TEMPLATES } from "#/templates";

import { cutLine, roadNetworkOf } from "./junctions";
import {
	choicesAfterInsert,
	choicesAfterRemove,
	choicesAfterReverse,
	choicesAfterSplit,
} from "./pillarChoices";
import { type IPillarWorld, pillarObstacles, placePillars } from "./pillars";
import { pillarPositions, roadCenterlineOf } from "./roads";
import { centerlineOf } from "./routes";
import { AreaSchema, RoadSchema, type TRoad, type TRoadInput } from "./schema";

const road = (id: string, points: TRoadInput["points"], input: Partial<TRoadInput> = {}): TRoad =>
	RoadSchema.parse({ id, points, cornerRadius: 0, ...input });

/** A bridge along x at altitude 4, over a road along z at the ground. */
const crossing = (more: Partial<TRoadInput> = {}) => {
	const bridge = road(
		"bridge",
		[
			[-22, 0, 4],
			[22, 0, 4],
		],
		{ pillarSpacing: 4, ...more },
	);
	const below = road("below", [
		[0, -20, 0],
		[0, 20, 0],
	]);
	return { bridge, world: { roads: [bridge, below], junctions: [], areas: [] } as IPillarWorld };
};

describe("pillars (ADR-0148)", () => {
	it("stand exactly where they always did on every template road with the defaults", () => {
		for (const template of TEMPLATES) {
			const world = template.create();
			const network = roadNetworkOf(world.roads, world.junctions);
			for (const each of world.roads) {
				// Only roads with the defaults promise the old places; a template may choose its own.
				if (
					each.pillarKind !== "post_01" ||
					each.pillarsKeepClear ||
					each.pillarsAtPoints.length > 0
				) {
					continue;
				}
				const trims = network.drawTrimsOf(each.id);
				const line = cutLine(roadCenterlineOf(each), trims.start, trims.end);
				const placed = placePillars(each, line, { world, trimStart: trims.start });
				expect(placed.map((pillar) => [pillar.x, pillar.z, pillar.height])).toEqual(
					pillarPositions(line, each.loops, each.pillarSpacing),
				);
			}
		}
	});

	it("keep clear of a road below, moving along the bridge", () => {
		const { bridge, world } = crossing();
		const line = centerlineOf(bridge);
		// Spaced every 4 from 2 in: one would stand at x = 0, in the middle of the road below.
		const blind = placePillars(bridge, line, { world });
		expect(blind.some((pillar) => Math.abs(pillar.x) < 1.5)).toBe(true);
		const clear = placePillars({ ...bridge, pillarsKeepClear: true }, line, { world });
		expect(clear).toHaveLength(blind.length);
		for (const pillar of clear) {
			expect(Math.abs(pillar.x)).toBeGreaterThan(1.2 + 0.32 - 1e-9);
		}
	});

	it("keep clear of the road's own lower turns, and of water", () => {
		// A spiral: up a turn and over its own start.
		const spiral = road(
			"spiral",
			Array.from({ length: 13 }, (_, i): [number, number, number] => {
				const angle = (i * Math.PI) / 2;
				return [Math.cos(angle) * 6, Math.sin(angle) * 6, i * 0.75];
			}),
			{ curveShape: "throughPoints", pillarSpacing: 2, pillarsKeepClear: true },
		);
		const line = centerlineOf(spiral);
		const world: IPillarWorld = { roads: [spiral], junctions: [], areas: [] };
		const pillars = placePillars(spiral, line, { world });
		expect(pillars.length).toBeGreaterThan(5);
		const obstacles = pillarObstacles(spiral, line, world);
		for (const pillar of pillars) {
			expect(obstacles.isInARoad(pillar, pillar.along)).toBe(false);
		}
		// Every pillar of the spiral's upper turns stands off its lower turn, so none is within its width.
		const lower = line.filter((point) => point[2] < 3);
		for (const pillar of pillars.filter((each) => each.height > 4)) {
			const nearest = Math.min(
				...lower.map((point) => Math.hypot(point[0] - pillar.x, point[1] - pillar.z)),
			);
			expect(nearest).toBeGreaterThan(1.2);
		}

		const { bridge } = crossing({ pillarsKeepClear: true });
		const lake = AreaSchema.parse({
			id: "lake",
			kind: "water_01",
			points: [
				[-12, -10],
				[12, -10],
				[12, 10],
				[-12, 10],
			],
		});
		const over = placePillars(bridge, centerlineOf(bridge), {
			world: { roads: [bridge], junctions: [], areas: [lake] },
		});
		expect(over.length).toBeGreaterThan(2);
		expect(over.every((pillar) => Math.abs(pillar.x) > 12)).toBe(true);
	});

	it("follow the choices at the road's points", () => {
		const long = road(
			"long",
			[
				[0, 0, 4],
				[10, 0, 4],
				[20, 0, 4],
				[30, 0, 4],
			],
			{ pillarSpacing: 4 },
		);
		const line = centerlineOf(long);
		const at = (choices: TRoad["pillarsAtPoints"]) =>
			placePillars({ ...long, pillarsAtPoints: choices }, line).map((pillar) => pillar.x);
		expect(at([])).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
		expect(at([{ pointIndex: 1, placement: "noneHere" }])).toEqual([2, 6, 14, 18, 22, 26, 30]);
		expect(at([{ pointIndex: 1, placement: "noneToNextPoint" }])).toEqual([2, 6, 22, 26, 30]);
		expect(at([{ pointIndex: 2, placement: "here" }])).toEqual([2, 6, 10, 14, 20, 26, 30]);
	});

	it("keep their choices with their points as points are added, taken out, split and turned", () => {
		const choices: TRoad["pillarsAtPoints"] = [
			{ pointIndex: 1, placement: "here" },
			{ pointIndex: 2, placement: "noneToNextPoint" },
		];
		expect(choicesAfterInsert(choices, 2).map((c) => c.pointIndex)).toEqual([1, 3]);
		expect(choicesAfterRemove(choices, [0])).toEqual([
			{ pointIndex: 0, placement: "here" },
			{ pointIndex: 1, placement: "noneToNextPoint" },
		]);
		expect(choicesAfterRemove(choices, [1]).map((c) => c.pointIndex)).toEqual([1]);
		// A road of 5 points turned round: point 1 is point 3, the stretch 2–3 is the stretch 1–2.
		expect(choicesAfterReverse(choices, 5, false)).toEqual([
			{ pointIndex: 3, placement: "here" },
			{ pointIndex: 1, placement: "noneToNextPoint" },
		]);
		const [first, second] = choicesAfterSplit(choices, 2);
		expect(first).toEqual([{ pointIndex: 1, placement: "here" }]);
		expect(second).toEqual([{ pointIndex: 0, placement: "noneToNextPoint" }]);
	});
});
