import { describe, expect, it } from "vitest";

import {
	GROUND_SHAPES,
	groundCornersOf,
	groundOutlineOf,
	isPlainGround,
	resized,
	sizeAround,
	withCorners,
} from "./groundShape";
import { SceneSchema } from "./schema";

const plain = SceneSchema.parse({
	version: 1,
	grounds: [{ id: "ground", width: 40, depth: 30 }],
}).grounds[0];

describe("the ground's shape (ADR-0155)", () => {
	it("is the plain rectangle in a world saved before it, drawn as it always was", () => {
		expect(plain.points).toBeNull();
		expect(plain.cornerRadius).toBe(0);
		expect(isPlainGround(plain)).toBe(true);
		expect(groundOutlineOf(plain)).toBeNull();
		expect(groundCornersOf(plain)).toEqual([
			[-20, -15],
			[20, -15],
			[20, 15],
			[-20, 15],
		]);
	});

	it("keeps its width and depth the centred size round its corners", () => {
		expect(
			sizeAround([
				[-10, -4],
				[16, -4],
				[0, 9],
			]),
		).toEqual({ width: 32, depth: 18 });
		// Never smaller than a ground can be, nor past the largest.
		expect(
			withCorners([
				[0, 0],
				[1, 0],
				[0, 1],
			]),
		).toMatchObject({ width: 4, depth: 4 });
		expect(
			withCorners([
				[-400, 0],
				[0, 0],
				[0, 1],
			]).points[0],
		).toEqual([-250, 0]);
	});

	it("stretches a shape to fill a new size, and resizes the rectangle by its sides", () => {
		const shaped = { width: 40, depth: 30, points: groundCornersOf(plain) };
		expect(resized(shaped, 80, 30).points?.[1]).toEqual([40, -15]);
		expect(resized(plain, 80, 30)).toEqual({ width: 80, depth: 30, points: null });
	});

	it("rounds its corners when asked, and draws a shape's corners as they are otherwise", () => {
		const rounded = groundOutlineOf({ ...plain, cornerRadius: 5 });
		expect(rounded?.length).toBeGreaterThan(4);
		for (const [x, z] of rounded ?? []) {
			expect(Math.abs(x)).toBeLessThanOrEqual(20);
			expect(Math.abs(z)).toBeLessThanOrEqual(15);
		}
		const triangle: [number, number][] = [
			[0, -10],
			[10, 10],
			[-10, 10],
		];
		expect(groundOutlineOf({ ...plain, points: triangle })).toEqual(triangle);
	});

	it("makes every shape inside its width × depth, each a valid ground", () => {
		for (const shape of GROUND_SHAPES) {
			const made = shape.make(40, 30);
			const ground = SceneSchema.parse({
				version: 1,
				grounds: [{ id: "ground", width: 40, depth: 30, ...made }],
			}).grounds[0];
			expect(ground.points, shape.id).toEqual(made.points);
			for (const [x, z] of made.points ?? []) {
				expect(Math.abs(x), shape.id).toBeLessThanOrEqual(20);
				expect(Math.abs(z), shape.id).toBeLessThanOrEqual(15);
			}
		}
	});
});
