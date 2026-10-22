import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { MAX_POLAR, orbitAround, settleTarget } from "./orbit";

/** An orthographic camera looking from `position` at `target`, like the editor's. */
const cameraAt = (position: THREE.Vector3, target: THREE.Vector3) => {
	const camera = new THREE.OrthographicCamera(-400, 400, 300, -300, 0.1, 1000);
	camera.position.copy(position);
	camera.lookAt(target);
	camera.updateMatrixWorld();
	return camera;
};

const onScreen = (camera: THREE.Camera, point: THREE.Vector3) => point.clone().project(camera);

describe("orbitAround", () => {
	it("keeps the pivot where it was on screen", () => {
		const position = new THREE.Vector3(80, 70, 80);
		const target = new THREE.Vector3(0, 0, 0);
		const pivot = new THREE.Vector3(6, 0, -3);
		const before = onScreen(cameraAt(position, target), pivot);

		orbitAround(position, target, pivot, 0.7, 0.2);
		const after = onScreen(cameraAt(position, target), pivot);
		expect(after.x).toBeCloseTo(before.x, 5);
		expect(after.y).toBeCloseTo(before.y, 5);
	});

	it("stops tilting at the limit", () => {
		const position = new THREE.Vector3(80, 70, 80);
		const target = new THREE.Vector3(0, 0, 0);
		orbitAround(position, target, new THREE.Vector3(), 0, 5);
		const offset = position.clone().sub(target);
		expect(Math.acos(offset.y / offset.length())).toBeCloseTo(MAX_POLAR, 5);
	});
});

describe("settleTarget", () => {
	const ground = { width: 40, depth: 30 };

	it("puts the target where the line of sight meets the ground, without changing the view", () => {
		const position = new THREE.Vector3(60, 50, 60);
		const target = new THREE.Vector3(3, 4, 2);
		const before = onScreen(cameraAt(position, target), new THREE.Vector3(5, 0, 5));
		settleTarget(position, target, ground);
		expect(target.y).toBeCloseTo(0, 5);
		const after = onScreen(cameraAt(position, target), new THREE.Vector3(5, 0, 5));
		expect(after.x).toBeCloseTo(before.x, 5);
		expect(after.y).toBeCloseTo(before.y, 5);
	});

	it("keeps the target over the slab when the line of sight meets the ground beyond it", () => {
		// Low view: the line of sight reaches the ground far behind the slab.
		const position = new THREE.Vector3(100, 10, 0);
		const target = new THREE.Vector3(0, 9, 0);
		settleTarget(position, target, ground);
		expect(Math.abs(target.x)).toBeLessThanOrEqual(20 + 1e-6);
		expect(Math.abs(target.z)).toBeLessThanOrEqual(15 + 1e-6);
	});
});
