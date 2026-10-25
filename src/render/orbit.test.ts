import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { orbitAround, polarLimits, settleTarget } from "./orbit";

const limits = polarLimits({ lowestElevation: 15, steepestElevation: 87 }, false);

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

		orbitAround(position, target, pivot, 0.7, 0.2, limits);
		const after = onScreen(cameraAt(position, target), pivot);
		expect(after.x).toBeCloseTo(before.x, 5);
		expect(after.y).toBeCloseTo(before.y, 5);
	});

	it("stops tilting at the limit", () => {
		const position = new THREE.Vector3(80, 70, 80);
		const target = new THREE.Vector3(0, 0, 0);
		orbitAround(position, target, new THREE.Vector3(), 0, 5, limits);
		const offset = position.clone().sub(target);
		expect(Math.acos(offset.y / offset.length())).toBeCloseTo(limits.max, 5);
		// 15° above the ground.
		expect(90 - (limits.max * 180) / Math.PI).toBeCloseTo(15, 5);
	});

	it("tilts all the way to straight down and level, without losing which way it faces", () => {
		const full = polarLimits({ lowestElevation: 0, steepestElevation: 90 }, false);
		const position = new THREE.Vector3(80, 70, 80);
		const target = new THREE.Vector3(0, 0, 0);
		orbitAround(position, target, new THREE.Vector3(), 0, -5, full);
		expect(position.x / position.z).toBeCloseTo(1, 5);
		expect(Number.isFinite(position.x)).toBe(true);
		orbitAround(position, target, new THREE.Vector3(), 0.5, 0, full);
		expect(Number.isFinite(position.x)).toBe(true);
		orbitAround(position, target, new THREE.Vector3(), 0, 5, full);
		expect(position.y).toBeCloseTo(0, 5);
	});

	it("tilts below level only in perspective", () => {
		const sky = { lowestElevation: -60, steepestElevation: 87 };
		expect(polarLimits(sky, true).max).toBeCloseTo((150 * Math.PI) / 180, 5);
		expect(polarLimits(sky, false).max).toBeCloseTo(Math.PI / 2, 5);
		expect(polarLimits({ ...sky, lowestElevation: -90 }, true).max).toBeLessThan(Math.PI);
	});

	it("reads the limits either way round", () => {
		expect(polarLimits({ lowestElevation: 80, steepestElevation: 30 }, false)).toEqual(
			polarLimits({ lowestElevation: 30, steepestElevation: 80 }, false),
		);
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
