import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { IFenceGatePlace } from "#/scene/fences";

import { gateLeavesOf, type IFenceGateLook } from "./gates";

const look: IFenceGateLook = {
	infill: "boards",
	frameColor: "frame",
	infillColor: "boards",
	leafInset: 0.05,
};

/** A gate 2 wide, along +x. */
const place: IFenceGatePlace = {
	index: 0,
	from: [0, 0, 0],
	to: [2, 0.4, 0],
	length: 2,
	direction: [1, 0],
};

/** Where a leaf's free end is once turned open about its hinge, as a swinging gate's group turns it. */
const openEnd = (leaf: ReturnType<typeof gateLeavesOf>[number]) => {
	const end = new THREE.Vector3(leaf.shut[0] * leaf.length, 0, leaf.shut[1] * leaf.length);
	end.applyAxisAngle(new THREE.Vector3(0, 1, 0), leaf.openTurn);
	return [leaf.hinge[0] + end.x, leaf.hinge[2] + end.z];
};

describe("gate leaves (ADR-0133)", () => {
	it("hangs a leaf at the side nearer the fence's start, swinging to the right of its way", () => {
		const [leaf] = gateLeavesOf(place, { opensToTheLeft: false, hasTwoLeaves: false }, look);
		expect(leaf.hinge[0]).toBeCloseTo(0.05);
		expect(leaf.hinge[1]).toBeCloseTo(0.01);
		expect(leaf.length).toBeCloseTo(1.9);
		// Shut, its end follows the ground across.
		expect(leaf.shutEndBase).toBeCloseTo(0.39);
		// The builder's right of +x is +z; 80° round, it ends there.
		const [x, z] = openEnd(leaf);
		expect(x).toBeCloseTo(0.05 + 1.9 * Math.cos((80 * Math.PI) / 180));
		expect(z).toBeCloseTo(1.9 * Math.sin((80 * Math.PI) / 180));
	});

	it("swings two leaves the same side, each from its own post, and to the left if it opens that way", () => {
		const two = gateLeavesOf(place, { opensToTheLeft: true, hasTwoLeaves: true }, look);
		expect(two[0].hinge[0]).toBeCloseTo(0.05);
		expect(two[1].hinge[0]).toBeCloseTo(1.95);
		for (const leaf of two) {
			expect(openEnd(leaf)[1]).toBeLessThan(-0.9);
		}
		// Too narrow for a leaf.
		const narrow = { ...place, length: 0.1 };
		expect(gateLeavesOf(narrow, { opensToTheLeft: false, hasTwoLeaves: false }, look)).toEqual([]);
	});
});
