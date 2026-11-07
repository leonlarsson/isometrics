import { describe, expect, it } from "vitest";

import { TEMPLATES } from "#/templates";

import { cutLine, roadNetworkOf } from "./junctions";
import { type IPillarWorld, pillarObstacles, placePillars } from "./pillars";
import { pillarPositions, pillarSpacingOf, roadCenterlineOf } from "./roads";
import { centerlineOf } from "./routes";
import { RoadSchema, type TRoad, type TRoadInput } from "./schema";

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
	return { bridge, world: { roads: [bridge, below], junctions: [] } as IPillarWorld };
};

describe("pillars (ADR-0148)", () => {
	it("stand where they always did on every template road, unless that's in a road below", () => {
		const key = (pillar: { x: number; z: number; height: number }) =>
			[pillar.x, pillar.z, pillar.height].join();
		for (const template of TEMPLATES) {
			const world = template.create();
			const network = roadNetworkOf(world.roads, world.junctions);
			for (const each of world.roads) {
				// Only the square posts promise the old places; a template may choose another look.
				if (each.pillarKind !== "post_01") {
					continue;
				}
				const trims = network.drawTrimsOf(each.id);
				const line = cutLine(roadCenterlineOf(each), trims.start, trims.end);
				const blind = placePillars(each, line);
				expect(blind.map((pillar) => [pillar.x, pillar.z, pillar.height])).toEqual(
					pillarPositions(line, each.loops, pillarSpacingOf(each)),
				);
				const obstacles = pillarObstacles(each, line, world);
				const placed = new Set(placePillars(each, line, { world }).map(key));
				for (const pillar of blind.filter((one) => obstacles.isClear(one, one.along))) {
					expect(placed.has(key(pillar))).toBe(true);
				}
			}
		}
	});

	it("keep clear of a road below, moving along the bridge", () => {
		const { bridge, world } = crossing();
		const line = centerlineOf(bridge);
		// Spaced every 4 from 2 in: one would stand at x = 0, in the middle of the road below.
		const blind = placePillars(bridge, line);
		expect(blind.some((pillar) => Math.abs(pillar.x) < 1.5)).toBe(true);
		const clear = placePillars(bridge, line, { world });
		expect(clear).toHaveLength(blind.length);
		for (const pillar of clear) {
			expect(Math.abs(pillar.x)).toBeGreaterThan(1.2 + 0.32 - 1e-9);
		}
	});

	it("keep clear of the road's own lower turns", () => {
		// A spiral: up a turn and over its own start.
		const spiral = road(
			"spiral",
			Array.from({ length: 13 }, (_, i): [number, number, number] => {
				const angle = (i * Math.PI) / 2;
				return [Math.cos(angle) * 6, Math.sin(angle) * 6, i * 0.75];
			}),
			{ curveShape: "throughPoints", pillarSpacing: 2 },
		);
		const line = centerlineOf(spiral);
		const world: IPillarWorld = { roads: [spiral], junctions: [] };
		const pillars = placePillars(spiral, line, { world });
		expect(pillars.length).toBeGreaterThan(5);
		const obstacles = pillarObstacles(spiral, line, world);
		for (const pillar of pillars) {
			expect(obstacles.isClear(pillar, pillar.along)).toBe(true);
		}
		// Every pillar of the spiral's upper turns stands off its lower turn, so none is within its width.
		const lower = line.filter((point) => point[2] < 3);
		for (const pillar of pillars.filter((each) => each.height > 4)) {
			const nearest = Math.min(
				...lower.map((point) => Math.hypot(point[0] - pillar.x, point[1] - pillar.z)),
			);
			expect(nearest).toBeGreaterThan(1.2);
		}
	});
});
