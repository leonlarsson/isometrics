import { describe, expect, it } from "vitest";

import {
	coverageOf,
	type IWeatherMapArea,
	type TWeatherMapAmount,
	WEATHER_MAP_AMOUNTS,
	weatherMapAt,
	weatherMapGridOf,
	weatherMapOf,
} from "./weatherMap";

const none = Object.fromEntries(WEATHER_MAP_AMOUNTS.map((name) => [name, 0])) as Record<
	TWeatherMapAmount,
	number
>;
const square = (x: number, z: number, size: number) => [
	[x, z],
	[x + size, z],
	[x + size, z + size],
	[x, z + size],
];
const storm = (points: number[][], rain = 1): IWeatherMapArea => ({
	points,
	amounts: { ...none, rain, wetness: rain, overcast: 0.8, cloudAltitude: 0.1 },
});

describe("the weather map", () => {
	it("is nothing without areas of their own weather", () => {
		expect(weatherMapOf([])).toBeNull();
		expect(weatherMapGridOf([])).toBeNull();
	});

	it("has an area's own weather inside it and the world's outside, fading at the edge", () => {
		const map = weatherMapOf([storm(square(0, 0, 20))]);
		expect(map).not.toBeNull();
		if (!map) {
			return;
		}
		const world = { ...none, rain: 0.1 };
		expect(weatherMapAt(map, [10, 10], world).rain).toBeCloseTo(1, 2);
		expect(weatherMapAt(map, [10, 10], world).overcast).toBeCloseTo(0.8, 2);
		// Far outside the map: the world's.
		expect(weatherMapAt(map, [200, 200], world).rain).toBeCloseTo(0.1, 5);
		// At the outline itself, halfway between.
		const atEdge = weatherMapAt(map, [0, 10], world).rain;
		expect(atEdge).toBeGreaterThan(0.3);
		expect(atEdge).toBeLessThan(0.8);
		// Just outside the fade: the world's again.
		expect(weatherMapAt(map, [-1.5, 10], world).rain).toBeCloseTo(0.1, 2);
	});

	it("leaves a texel of nothing round its sides, so beyond the map reads as uncovered", () => {
		const map = weatherMapOf([storm(square(-5, -5, 10))]);
		if (!map) {
			throw new Error("no map");
		}
		const coverage = (i: number, j: number) =>
			map.values[
				(j * map.width + i) * (WEATHER_MAP_AMOUNTS.length + 1) + WEATHER_MAP_AMOUNTS.length
			];
		for (let i = 0; i < map.width; i++) {
			expect(coverage(i, 0)).toBe(0);
			expect(coverage(i, map.depth - 1)).toBe(0);
		}
		for (let j = 0; j < map.depth; j++) {
			expect(coverage(0, j)).toBe(0);
			expect(coverage(map.width - 1, j)).toBe(0);
		}
	});

	it("puts a later area on top where they overlap", () => {
		const map = weatherMapOf([storm(square(0, 0, 20), 1), storm(square(10, 0, 20), 0.2)]);
		if (!map) {
			throw new Error("no map");
		}
		expect(weatherMapAt(map, [15, 10], none).rain).toBeCloseTo(0.2, 2);
		expect(weatherMapAt(map, [5, 10], none).rain).toBeCloseTo(1, 2);
	});

	it("keeps an outline's coverage until the outline or the grid changes", () => {
		const points = square(0, 0, 10);
		const grid = weatherMapGridOf([points]);
		if (!grid) {
			throw new Error("no grid");
		}
		expect(coverageOf(points, grid)).toBe(coverageOf(points, grid));
		expect(coverageOf(square(0, 0, 10), grid)).not.toBe(coverageOf(points, grid));
	});

	it("stays at most 256 texels a side for a huge area", () => {
		const grid = weatherMapGridOf([square(-2000, -2000, 4000)]);
		expect(grid?.width).toBeLessThanOrEqual(256);
		expect(grid?.depth).toBeLessThanOrEqual(256);
	});
});
