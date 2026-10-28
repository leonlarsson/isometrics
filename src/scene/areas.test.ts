import { describe, expect, it } from "vitest";

import {
	areaTopAt,
	cornerTop,
	cornerWithLift,
	isInsidePolygon,
	isRaised,
	liftForTop,
	polygonArea,
	takesCornerHeights,
	triangulateOutline,
	triangulateWithPoints,
	waterSeams,
} from "./areas";
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

describe("area corners with their own heights (ADR-0096)", () => {
	const covered = (points: [number, number][]) =>
		triangulateOutline(points).reduce(
			(sum, [a, b, c]) => sum + polygonArea([points[a], points[b], points[c]]),
			0,
		);

	it("cuts an outline into triangles that cover it, turning its way, concave or not", () => {
		const corner: [number, number][] = [
			[0, 0],
			[4, 0],
			[4, 2],
			[2, 2],
			[2, 4],
			[0, 4],
		];
		expect(triangulateOutline(corner)).toHaveLength(4);
		expect(covered(corner)).toBeCloseTo(polygonArea(corner));
		const reversed = [...corner].reverse();
		expect(covered(reversed)).toBeCloseTo(polygonArea(reversed));
	});

	it("knows how high the top is anywhere inside: a ramp up to a lifted side", () => {
		const ramp = AreaSchema.parse({
			id: "ramp",
			points: [
				[0, 0],
				[4, 0, 2],
				[4, 4, 2],
				[0, 4],
			],
		});
		expect(isRaised(ramp)).toBe(true);
		expect(areaTopAt(ramp, [2, 1])).toBeCloseTo(1);
		expect(areaTopAt(ramp, [3, 3])).toBeCloseTo(1.5);
		expect(areaTopAt(ramp, [6, 1])).toBeNull();
	});

	it("keeps a corner's top on the ground, and flat corners as [x, z]", () => {
		const raised = { height: 1 };
		expect(liftForTop(raised, -3)).toBe(-1);
		expect(liftForTop(raised, 1)).toBe(0);
		expect(cornerWithLift(1, 2, 0)).toEqual([1, 2]);
		expect(cornerWithLift(1, 2, 0.5)).toEqual([1, 2, 0.5]);
		expect(isRaised(AreaSchema.parse({ id: "low", points: square(0, 0, 2) }))).toBe(false);
	});

	it("keeps water level: its corners have no heights of their own, whatever they kept", () => {
		const lake = area("lake", square(0, 0, 2));
		expect(takesCornerHeights(lake)).toBe(false);
		const tilted = area("tilted", [[0, 0, 2] as never, ...square(0, 0, 2).slice(1)], { height: 1 });
		expect(cornerTop(tilted, tilted.points[0])).toBe(1);
		expect(isRaised({ ...tilted, height: 0 })).toBe(false);
	});
});

describe("peaks inside an area (ADR-0101)", () => {
	const field = (peaks: [number, number, number][], type = "grass_01") =>
		AreaSchema.parse({ id: "hill", type, points: square(0, 0, 4), peaks });

	it("joins a peak in the middle to every corner, so a hill rises evenly", () => {
		const triangles = triangulateWithPoints(square(0, 0, 4), [[2, 2]]);
		expect(triangles).toHaveLength(4);
		expect(triangles.every((triangle) => triangle.includes(4))).toBe(true);
	});

	it("knows the top's height round a peak, and leaves out points outside", () => {
		const hill = field([[2, 2, 3]]);
		expect(isRaised(hill)).toBe(true);
		expect(areaTopAt(hill, [2, 2])).toBeCloseTo(3);
		expect(areaTopAt(hill, [1, 1])).toBeCloseTo(1.5);
		expect(areaTopAt(hill, [3, 1])).toBeCloseTo(1.5);
		expect(triangulateWithPoints(square(0, 0, 4), [[9, 9]])).toHaveLength(2);
	});

	it("lets water stay level, whatever peaks it kept", () => {
		const pond = field([[2, 2, 3]], "water_01");
		expect(isRaised(pond)).toBe(false);
		expect(areaTopAt(pond, [2, 2])).toBe(0);
	});
});
