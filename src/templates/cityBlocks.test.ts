import { describe, expect, it } from "vitest";

import { isInsidePolygon } from "#/scene/areas";
import type { TVec2 } from "#/scene/schema";

import { inFrame, layBlocks, turnedRect } from "./cityBlocks";

describe("turned frames", () => {
	it("turn as objects do: a turn by θ takes +X to (cos θ, −sin θ)", () => {
		const [x, z] = inFrame([0, 0], 90)([1, 0]);
		expect(x).toBeCloseTo(0);
		expect(z).toBeCloseTo(-1);
		expect(turnedRect([10, 0], 0, 4, 2)).toEqual([
			[8, -1],
			[12, -1],
			[12, 1],
			[8, 1],
		]);
	});
});

describe("layBlocks", () => {
	const land: TVec2[] = [
		[-20, -20],
		[20, -20],
		[20, 20],
		[-20, 20],
	];

	it("keeps only the blocks that fit, with their margin", () => {
		const grid = {
			origin: [0, 0] as TVec2,
			turn: 0,
			size: [6, 4] as TVec2,
			street: 1,
			columns: [-5, 5] as [number, number],
			rows: [-5, 5] as [number, number],
		};
		const blocks = layBlocks(grid, (point) => isInsidePolygon(point, land), { margin: 0.5 });
		// Along x every 7 from 0: −14 to 14 fit (their edges at ±17.5); along z every 5: −15 to 15.
		expect(blocks.length).toBe(5 * 7);
		for (const block of blocks) {
			expect(Math.abs(block.centre[0])).toBeLessThanOrEqual(14);
			expect(Math.abs(block.centre[1])).toBeLessThanOrEqual(15);
		}
	});

	it("leaves out a block any point of which fails, as a road through it", () => {
		const grid = {
			origin: [0, 0] as TVec2,
			turn: 0,
			size: [6, 4] as TVec2,
			street: 1,
			columns: [-1, 1] as [number, number],
			rows: [0, 0] as [number, number],
		};
		const blocks = layBlocks(grid, ([x]) => Math.abs(x - 7) > 0.2);
		expect(blocks.map((block) => block.centre)).toEqual([
			[-7, 0],
			[0, 0],
		]);
	});
});
