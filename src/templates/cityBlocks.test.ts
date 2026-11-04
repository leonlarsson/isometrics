import { describe, expect, it } from "vitest";

import { isInsidePolygon } from "#/scene/areas";
import type { TVec2 } from "#/scene/schema";

import { inFrame, layBlocks, rowsAround, turnedRect } from "./cityBlocks";

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
	const grid = {
		origin: [0, 0] as TVec2,
		turn: 0,
		widths: [6, 4],
		depths: [4],
		street: 1,
		columns: [-1, 1] as const,
		rows: [0, 0] as const,
	};

	it("lays blocks of the sizes given, a street apart", () => {
		const blocks = layBlocks(grid, (point) => isInsidePolygon(point, land));
		// Column 0 is 6 wide; columns 1 and −1 are 4 wide, a street of 1 on either side.
		expect(blocks.map((block) => [block.centre, block.size])).toEqual([
			[
				[-6, 0],
				[4, 4],
			],
			[
				[0, 0],
				[6, 4],
			],
			[
				[6, 0],
				[4, 4],
			],
		]);
	});

	it("keeps the largest clear part of a block a road cuts into, and drops one too small", () => {
		// A road along x = 1.5: the middle block keeps its west part; the east block is clear.
		const blocks = layBlocks(grid, ([x]) => Math.abs(x - 1.5) > 0.3);
		const middle = blocks.find((block) => Math.abs(block.centre[0]) < 2);
		expect(middle?.size[1]).toBe(4);
		expect(middle?.size[0]).toBeGreaterThan(3.5);
		expect((middle?.centre[0] ?? 0) + (middle?.size[0] ?? 0) / 2).toBeLessThan(1.2);
		expect(blocks).toHaveLength(3);
		// Nothing fits where all but a strip is cut away.
		expect(layBlocks(grid, ([x]) => x > 7.5)).toEqual([]);
	});
});

describe("rowsAround", () => {
	it("builds a block round its edge, its houses filling each side exactly", () => {
		const rows = rowsAround(
			{ centre: [0, 0], turn: 0, size: [6.6, 5] },
			{ rowDepth: 1.6, houseWidth: 1.1, housesInRow: () => 4 },
		);
		const length = (side: string) =>
			rows
				.filter((row) => row.side === side)
				.reduce((sum, row) => sum + row.houseCount * row.houseWidth, 0);
		expect(length("south")).toBeCloseTo(6.6);
		expect(length("north")).toBeCloseTo(6.6);
		expect(length("east")).toBeCloseTo(5 - 3.2);
		// Six houses a side: a row of four and a row of two.
		expect(rows.filter((row) => row.side === "south").map((row) => row.houseCount)).toEqual([4, 2]);
		for (const row of rows) {
			expect(row.depth).toBe(1.6);
		}
	});

	it("puts two rows back to back in a shallow block", () => {
		const rows = rowsAround(
			{ centre: [0, 0], turn: 0, size: [4.4, 2.6] },
			{ rowDepth: 1.6, houseWidth: 1.1, housesInRow: () => 9 },
		);
		expect(rows.map((row) => row.side)).toEqual(["south", "north"]);
		expect(rows[0].depth).toBeCloseTo(1.28);
	});
});
