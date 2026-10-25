import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { TViewPose } from "#/scene/schema";

import { blendPoses, directionOf, placeCamera, poseOf, sameView } from "./viewpoints";

const pose: TViewPose = {
	target: [4, -3],
	azimuth: 300,
	elevation: 40,
	span: 24,
	perspective: false,
	fieldOfView: null,
};

describe("viewpoints", () => {
	it("puts the default view where the iso camera looks from", () => {
		const iso = new THREE.Vector3(1, 0.9, 1).normalize();
		const direction = directionOf(315, Math.asin(iso.y) / (Math.PI / 180));
		expect(direction.x).toBeCloseTo(iso.x, 5);
		expect(direction.y).toBeCloseTo(iso.y, 5);
		expect(direction.z).toBeCloseTo(iso.z, 5);
	});

	it("reads back the pose it placed, for both cameras", () => {
		const cameras = [
			new THREE.OrthographicCamera(-400, 400, 300, -300, 0.1, 1000),
			new THREE.PerspectiveCamera(40, 800 / 600, 0.1, 2000),
		];
		for (const camera of cameras) {
			const target = placeCamera(camera, pose, 600, 40);
			const back = poseOf(camera, target, 600, pose.perspective, 40);
			expect(back.target).toEqual(pose.target);
			expect(back.azimuth).toBeCloseTo(pose.azimuth, 1);
			expect(back.elevation).toBeCloseTo(pose.elevation, 1);
			expect(back.span).toBeCloseTo(pose.span, 1);
		}
	});

	it("gives back the same view when the target is off the ground (after zooming to the cursor)", () => {
		const point = new THREE.Vector3(7, 1.5, -2);
		const cameras = [
			new THREE.OrthographicCamera(-400, 400, 300, -300, 0.1, 1000),
			new THREE.PerspectiveCamera(40, 800 / 600, 0.1, 2000),
		];
		for (const camera of cameras) {
			placeCamera(camera, pose, 600, 40);
			// Slide the camera and its target sideways together, lifting the target off the ground.
			const lift = new THREE.Vector3(1.2, 2.5, -0.7);
			const raised = new THREE.Vector3(pose.target[0], 0, pose.target[1]).add(lift);
			camera.position.add(lift);
			camera.updateMatrixWorld();
			const seen = point.clone().project(camera);

			const saved = poseOf(camera, raised, 600, pose.perspective, 40);
			placeCamera(camera, saved, 600, 40);
			const again = point.clone().project(camera);
			// Within a hundredth of the view (a few px): only the pose's rounding differs.
			expect(Math.abs(again.x - seen.x)).toBeLessThan(0.01);
			expect(Math.abs(again.y - seen.y)).toBeLessThan(0.01);
		}
	});

	it("blends the short way round", () => {
		const a = { ...pose, azimuth: 350 };
		const b = { ...pose, azimuth: 10, span: 96 };
		const half = blendPoses(a, b, 0.5);
		expect(((half.azimuth % 360) + 360) % 360).toBeCloseTo(0, 5);
		expect(half.span).toBeCloseTo(48, 5);
	});

	it("tells when two views show the same thing", () => {
		expect(sameView(pose, { ...pose, target: [4.1, -3], azimuth: 300.4 }, 40)).toBe(true);
		expect(sameView(pose, { ...pose, azimuth: 302 }, 40)).toBe(false);
		expect(sameView(pose, { ...pose, span: 30 }, 40)).toBe(false);
		expect(sameView(pose, { ...pose, perspective: true }, 40)).toBe(false);
		// Across 0°, and a field of view that's the world's.
		expect(sameView({ ...pose, azimuth: 359.8 }, { ...pose, azimuth: 0.1 }, 40)).toBe(true);
		const own = { ...pose, perspective: true, fieldOfView: 40 };
		expect(sameView(own, { ...own, fieldOfView: null }, 40)).toBe(true);
		expect(sameView(own, { ...own, fieldOfView: null }, 60)).toBe(false);
	});

	it("keeps a view's own field of view, and none while it's the world's", () => {
		const camera = new THREE.PerspectiveCamera(40, 800 / 600, 0.1, 2000);
		const own = { ...pose, perspective: true, fieldOfView: 70 };
		const target = placeCamera(camera, own, 600, 40);
		expect(camera.fov).toBe(70);
		const back = poseOf(camera, target, 600, true, 40);
		expect(back.fieldOfView).toBe(70);
		expect(back.span).toBeCloseTo(24, 1);
		placeCamera(camera, { ...own, fieldOfView: null }, 600, 55);
		expect(camera.fov).toBe(55);
		expect(poseOf(camera, target, 600, true, 55).fieldOfView).toBeNull();
		// Blending from the world's field of view to a view's own goes evenly.
		expect(blendPoses({ ...own, fieldOfView: 30 }, own, 0.5).fieldOfView).toBe(50);
		expect(blendPoses(pose, pose, 0.5).fieldOfView).toBeNull();
	});
});
