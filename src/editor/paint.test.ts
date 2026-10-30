import { describe, expect, it } from "vitest";

import { groundHeightAt } from "#/scene/areas";
import { SceneSchema, type TScene } from "#/scene/schema";

import { brushKinds, DEFAULT_BRUSH, eraseStamp, paintStamp } from "./paint";

/** The same numbers every run. */
const seeded = (seed: number) => {
	let state = seed;
	return () => {
		state = (state * 16807) % 2147483647;
		return (state - 1) / 2147483646;
	};
};

const world = (input: Record<string, unknown> = {}): TScene =>
	SceneSchema.parse({ version: 1, ground: { width: 40, depth: 40 }, ...input });

const brush = { ...DEFAULT_BRUSH, size: 3, density: 4 };

describe("painting objects (ADR-0091)", () => {
	it("scatters about as many objects as its density asks, of its parts, apart from each other", () => {
		const added = paintStamp(world(), brush, [0, 0], seeded(1));
		// 28 square units at 4 per 10.
		expect(added.length).toBeGreaterThanOrEqual(8);
		expect(added.length).toBeLessThanOrEqual(11);
		const kinds = new Set(brushKinds("mixed_wood").map(([kind]) => kind));
		for (const entity of added) {
			expect(kinds.has(entity.kind)).toBe(true);
			expect(Math.hypot(...(entity.position as [number, number]))).toBeLessThanOrEqual(3.01);
		}
		for (const [i, a] of added.entries()) {
			for (const b of added.slice(i + 1)) {
				const [ax, az] = a.position as [number, number];
				const [bx, bz] = b.position as [number, number];
				expect(Math.hypot(ax - bx, az - bz)).toBeGreaterThan(0.5);
			}
		}
	});

	it("adds none where its parts already stand thick enough", () => {
		const first = paintStamp(world(), brush, [0, 0], seeded(2));
		const again = paintStamp(
			world({ entities: first.map((entity, i) => ({ ...entity, id: `t${i}` })) }),
			brush,
			[0, 0],
			seeded(3),
		);
		expect(again.length).toBeLessThanOrEqual(1);
	});

	it("keeps off roads and out of other objects", () => {
		const scene = world({
			roads: [
				{
					id: "r",
					points: [
						[-10, 0],
						[10, 0],
					],
					width: 2,
				},
			],
			entities: [{ id: "h", kind: "house_01", position: [0, 2.6] }],
		});
		const added = paintStamp(scene, { ...brush, size: 4 }, [0, 0], seeded(4));
		expect(added.length).toBeGreaterThan(0);
		for (const entity of added) {
			const [x, z] = entity.position as [number, number];
			// The road is 2 wide along z = 0; the house covers x ±1.35, z 1.3–3.9.
			expect(Math.abs(z)).toBeGreaterThan(1);
			expect(Math.abs(x) <= 1.35 && z > 1.3 && z < 3.9).toBe(false);
		}
	});

	it("stands what it paints on raised land", () => {
		const scene = world({
			areas: [
				{
					id: "hill",
					kind: "raised_land_01",
					height: 2,
					points: [
						[-5, -5],
						[5, -5],
						[5, 5],
						[-5, 5],
					],
				},
			],
		});
		expect(groundHeightAt(scene.areas, [0, 0])).toBe(2);
		expect(groundHeightAt(scene.areas, [8, 8])).toBe(0);
		const added = paintStamp(scene, { ...brush, size: 2 }, [0, 0], seeded(5));
		expect(added.every((entity) => entity.altitude === 2)).toBe(true);
	});

	it("erases only what the brush paints, and nothing locked", () => {
		const scene = world({
			entities: [
				{ id: "pine", kind: "pine_tree_01", position: [1, 0] },
				{ id: "locked_pine", kind: "pine_tree_01", position: [0, 1], isLocked: true },
				{ id: "house", kind: "house_01", position: [-1, 0] },
				{ id: "far_pine", kind: "pine_tree_01", position: [9, 9] },
			],
		});
		expect(eraseStamp(scene, brush, [0, 0])).toEqual(["pine"]);
	});

	it("knows single parts as brushes, and nothing for unknown ones", () => {
		expect(brushKinds("part:bench_01")).toEqual([["bench_01", 1]]);
		expect(brushKinds("part:nope_01")).toEqual([]);
	});
});
