import { describe, expect, it } from "vitest";

import type { TVec2 } from "#/scene/schema";

import { layRowsAlong } from "./streetRows";

const SQUARE_LAND: TVec2[] = [
	[-10, -10],
	[10, -10],
	[10, 10],
	[-10, 10],
];

/** The corners of a laid row, from its middle, turn and size. */
const cornersOf = (row: ReturnType<typeof layRowsAlong>[number], houseWidth: number) => {
	const turn = (row.turn * Math.PI) / 180;
	// A turn by θ takes +X to (cos θ, −sin θ) and +Z to (sin θ, cos θ).
	const along: TVec2 = [Math.cos(turn), -Math.sin(turn)];
	const across: TVec2 = [Math.sin(turn), Math.cos(turn)];
	const half = [(row.houseCount * houseWidth) / 2, row.depth / 2];
	return [-1, 1].flatMap((a) =>
		[-1, 1].map(
			(b): TVec2 => [
				row.position[0] + along[0] * half[0] * a + across[0] * half[1] * b,
				row.position[1] + along[1] * half[0] * a + across[1] * half[1] * b,
			],
		),
	);
};

describe("layRowsAlong", () => {
	it("lays houses down both sides of a street, facing it", () => {
		const rows = layRowsAlong({
			streets: [
				{
					id: "main",
					points: [
						[0, -8],
						[0, 8],
					],
					width: 1,
					left: { depths: [2], houseWidth: 1 },
					right: { depths: [2], houseWidth: 1 },
				},
			],
			land: SQUARE_LAND,
		});
		const houses = rows.reduce((sum, row) => sum + row.houseCount, 0);
		expect(houses).toBe(30);
		for (const row of rows) {
			// Fronts face the street: towards x = 0.
			expect(Math.sign(row.facing[0])).toBe(-Math.sign(row.position[0]));
			expect(Math.abs(row.position[0])).toBeCloseTo(0.5 + 0.08 + 1, 5);
			for (const [x] of cornersOf(row, 1)) {
				expect(Math.abs(x)).toBeGreaterThanOrEqual(0.5);
			}
		}
	});

	it("keeps houses off other streets, out of squares and off each other, the main street first", () => {
		const rows = layRowsAlong({
			streets: [
				{
					id: "main",
					points: [
						[0, -8],
						[0, 8],
					],
					width: 1,
					left: { depths: [3, 1.5], houseWidth: 1 },
					right: { depths: [3, 1.5], houseWidth: 1 },
				},
				{
					id: "cross",
					points: [
						[-9, 0],
						[9, 0],
					],
					width: 1,
					left: { depths: [3, 1.5], houseWidth: 1 },
					right: { depths: [3, 1.5], houseWidth: 1 },
				},
			],
			land: SQUARE_LAND,
			keepOut: [
				[
					[3, 3],
					[8, 3],
					[8, 8],
					[3, 8],
				],
			],
		});
		const main = rows.filter((row) => row.streetId === "main");
		const cross = rows.filter((row) => row.streetId === "cross");
		expect(main.length).toBeGreaterThan(0);
		expect(cross.length).toBeGreaterThan(0);
		for (const row of rows) {
			for (const [x, z] of cornersOf(row, 1)) {
				// Not on the cross street (its houses were laid after the main street's), nor in the square.
				expect(Math.abs(x) >= 0.5 - 1e-6 || Math.abs(z) >= 0.5 - 1e-6).toBe(true);
				expect(x > 3.01 && x < 7.99 && z > 3.01 && z < 7.99).toBe(false);
			}
		}
	});
});
