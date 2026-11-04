import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { topsToStandOn } from "#/parts/standing";
import { AreaSchema, EntitySchema } from "#/scene/schema";
import { areaTopsOf } from "#/scene/standing";

import { surfaceHitOnRay } from "./useGroundDrag";

/** A ray from high up at 45° towards −X, down onto a point of the base ground. */
const rayOnto = (x: number, z: number) => {
	const direction = new THREE.Vector3(-1, -1, 0).normalize();
	return new THREE.Ray(new THREE.Vector3(x + 20, 20, z), direction);
};

const world = {
	areas: [
		AreaSchema.parse({
			id: "land",
			kind: "raised_land_01",
			points: [
				[-10, -2],
				[-6, -2],
				[-6, 2],
				[-10, 2],
			],
			height: 2,
		}),
	],
	entities: [
		EntitySchema.parse({ id: "box", kind: "box_01", props: { width: 2, depth: 2, height: 1 } }),
		EntitySchema.parse({ id: "on", kind: "box_01", altitude: 1, props: { height: 0.5 } }),
	],
};

describe("where the pointer meets what things stand on (ADR-0098, ADR-0138)", () => {
	it("meets the base ground where nothing stands", () => {
		const hit = surfaceHitOnRay(rayOnto(4, 0), topsToStandOn(world));
		expect(hit?.x).toBeCloseTo(4);
		expect(hit?.y).toBeCloseTo(0);
	});

	it("meets the top of the highest shape the ray comes down on first", () => {
		// Aimed at the base ground just behind the stack: it meets the upper box's top first.
		const hit = surfaceHitOnRay(rayOnto(-1.2, 0), topsToStandOn(world));
		expect(hit?.y).toBeCloseTo(1.5, 2);
		expect(hit?.x).toBeCloseTo(0.3, 2);
		// Without the upper box (it's the one moving), the lower one's top.
		const below = surfaceHitOnRay(rayOnto(-0.5, 0), topsToStandOn(world, "on"));
		expect(below?.y).toBeCloseTo(1, 2);
		expect(below?.x).toBeCloseTo(0.5, 2);
	});

	it("meets a shape's side where the ray comes at it from the side, at its edge", () => {
		const hit = surfaceHitOnRay(rayOnto(0.5, 0), topsToStandOn(world, "on"));
		expect(hit?.x).toBeCloseTo(1, 2);
		expect(hit?.y).toBeCloseTo(0.5, 2);
	});

	it("keeps an object lifted above them that much higher", () => {
		const hit = surfaceHitOnRay(rayOnto(-0.5, 0), topsToStandOn(world, "on"), 0.5);
		expect(hit?.y).toBeCloseTo(1.5, 2);
	});

	it("meets raised land as before", () => {
		const hit = surfaceHitOnRay(rayOnto(-9, 0), areaTopsOf(world.areas));
		expect(hit?.y).toBeCloseTo(2, 2);
		expect(hit?.x).toBeCloseTo(-7, 2);
		// Its side, where the ray comes at it below its top.
		const side = surfaceHitOnRay(rayOnto(-7, 0), areaTopsOf(world.areas));
		expect(side?.x).toBeCloseTo(-6, 2);
		expect(side?.y).toBeCloseTo(1, 2);
	});
});
