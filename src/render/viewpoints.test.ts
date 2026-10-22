import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { TViewPose } from "#/scene/schema";

import { blendPoses, directionOf, placeCamera, poseOf } from "./viewpoints";

const pose: TViewPose = {
	target: [4, -3],
	azimuth: 300,
	elevation: 40,
	span: 24,
	perspective: false,
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
			const target = placeCamera(camera, pose, 600);
			const back = poseOf(camera, target, 600, pose.perspective);
			expect(back.target).toEqual(pose.target);
			expect(back.azimuth).toBeCloseTo(pose.azimuth, 1);
			expect(back.elevation).toBeCloseTo(pose.elevation, 1);
			expect(back.span).toBeCloseTo(pose.span, 1);
		}
	});

	it("blends the short way round", () => {
		const a = { ...pose, azimuth: 350 };
		const b = { ...pose, azimuth: 10, span: 96 };
		const half = blendPoses(a, b, 0.5);
		expect(((half.azimuth % 360) + 360) % 360).toBeCloseTo(0, 5);
		expect(half.span).toBeCloseTo(48, 5);
	});
});
