import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { forgetBounds, raycastWithinBounds } from "./raycastBounds";

/** An object's group, as EntityNode makes it, with a box at x and a spy on the box's own test. */
const objectAt = (x: number) => {
	const group = new THREE.Group();
	group.raycast = raycastWithinBounds;
	const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
	box.position.x = x;
	group.add(box);
	group.updateMatrixWorld(true);
	const tested = vi.spyOn(box, "raycast");
	return { group, box, tested };
};

/** A ray straight down onto the ground near x (off a box's diagonal, which it would hit twice). */
const rayDownAt = (x: number) =>
	new THREE.Raycaster(new THREE.Vector3(x + 0.1, 10, 0.2), new THREE.Vector3(0, -1, 0));

describe("testing an object's meshes only where the pointer is (PERFORMANCE.md)", () => {
	it("leaves out the meshes of an object standing still that the ray misses, and finds the ones it hits", () => {
		const { group, box, tested } = objectAt(0);
		forgetBounds(group, false);
		expect(rayDownAt(5).intersectObject(group, true)).toEqual([]);
		expect(tested).not.toHaveBeenCalled();
		const [hit] = rayDownAt(0).intersectObject(group, true);
		expect(hit?.object).toBe(box);
	});

	it("works its bounds out again after it renders, where it is then", () => {
		const { group, box } = objectAt(0);
		forgetBounds(group, false);
		expect(rayDownAt(0).intersectObject(group, true)).toHaveLength(1);
		box.position.x = 5;
		group.updateMatrixWorld(true);
		forgetBounds(group, false);
		expect(rayDownAt(5).intersectObject(group, true)).toHaveLength(1);
		expect(rayDownAt(0).intersectObject(group, true)).toEqual([]);
	});

	it("always tests a moving object's meshes", () => {
		const { group, tested } = objectAt(0);
		forgetBounds(group, true);
		rayDownAt(5).intersectObject(group, true);
		expect(tested).toHaveBeenCalled();
	});
});
