import { describe, expect, it } from "vitest";

import { isInsidePolygon, waterSeams } from "./areas";
import { AreaSchema } from "./schema";

const area = (id: string, points: [number, number][], extra = {}) =>
	AreaSchema.parse({ id, type: "water_01", points, ...extra });

const square = (x: number, z: number, size: number): [number, number][] => [
	[x, z],
	[x + size, z],
	[x + size, z + size],
	[x, z + size],
];

describe("water seams (ADR-0075)", () => {
	it("knows inside from outside", () => {
		expect(isInsidePolygon([1, 1], square(0, 0, 2))).toBe(true);
		expect(isInsidePolygon([3, 1], square(0, 0, 2))).toBe(false);
	});

	it("are where water meets other water, not land", () => {
		// A calm basin with the bay along its south side only.
		const basin = area("basin", square(0, 0, 4));
		const bay = area("bay", [
			[-5, 4],
			[9, 4],
			[9, 10],
			[-5, 10],
		]);
		const seams = waterSeams(basin, [basin, bay]);
		expect(seams).toHaveLength(1);
		const [x1, z1, x2, z2] = seams[0];
		expect(Math.min(x1, x2)).toBeCloseTo(0);
		expect(Math.max(x1, x2)).toBeCloseTo(4);
		expect(z1).toBeCloseTo(4);
		expect(z2).toBeCloseTo(4);
	});

	it("are none without other water, or for land and raised water", () => {
		const pond = area("pond", square(0, 0, 4));
		expect(waterSeams(pond, [pond])).toEqual([]);
		const lawn = AreaSchema.parse({ id: "lawn", type: "grass_01", points: square(-2, -2, 8) });
		expect(waterSeams(pond, [pond, lawn])).toEqual([]);
		const raised = area("raised", square(0, 0, 4), { height: 1 });
		expect(waterSeams(raised, [raised, area("lake", square(-5, -5, 20))])).toEqual([]);
	});
});
