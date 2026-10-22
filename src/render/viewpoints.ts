import * as THREE from "three";

import { clamp, DEG2RAD, normalizeDegrees, round } from "#/lib/math";
import type { TViewPose } from "#/scene/schema";

import { pixelsPerUnitAt } from "./cameraMath";

/**
 * Saved viewpoints as camera maths: read the current view as a pose (target,
 * azimuth, elevation, span) and put a camera there. Plain vectors, no React,
 * so it's unit-tested. See docs/adr/0039-saved-viewpoints.md.
 */

/** How far the orthographic camera stands back (as in CameraRig): far enough for every label. */
const ORTHOGRAPHIC_DISTANCE = 150;

/** Unit vector from the target towards the camera for a compass angle and height (degrees). */
export const directionOf = (azimuth: number, elevation: number) => {
	const a = azimuth * DEG2RAD;
	const e = elevation * DEG2RAD;
	return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), -Math.cos(e) * Math.sin(a));
};

/** The pose a camera looking at `target` has now. `height` is the canvas height (CSS px). */
export const poseOf = (
	camera: THREE.Camera,
	target: THREE.Vector3,
	height: number,
	perspective: boolean,
): TViewPose => {
	const direction = camera.position.clone().sub(target).normalize();
	return {
		target: [round(target.x, 2), round(target.z, 2)],
		azimuth: round(normalizeDegrees(Math.atan2(-direction.z, direction.x) / DEG2RAD), 1),
		elevation: round(clamp(Math.asin(direction.y) / DEG2RAD, 15, 87), 1),
		span: round(clamp(height / pixelsPerUnitAt(camera, target, height), 2, 400), 2),
		perspective,
	};
};

/** Put the camera at a pose (looking at its target, which the caller gives the controls). */
export const placeCamera = (camera: THREE.Camera, pose: TViewPose, height: number) => {
	const target = new THREE.Vector3(pose.target[0], 0, pose.target[1]);
	const direction = directionOf(pose.azimuth, pose.elevation);
	if (camera instanceof THREE.PerspectiveCamera) {
		const distance = pose.span / 2 / Math.tan((camera.fov * DEG2RAD) / 2);
		camera.position.copy(direction).multiplyScalar(distance).add(target);
	} else {
		camera.position.copy(direction).multiplyScalar(ORTHOGRAPHIC_DISTANCE).add(target);
		if (camera instanceof THREE.OrthographicCamera) {
			camera.zoom = height / pose.span;
			camera.updateProjectionMatrix();
		}
	}
	camera.lookAt(target);
	camera.updateMatrixWorld();
	return target;
};

/** The shortest way round from one angle to another (degrees, -180…180). */
const turnBetween = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/** The pose `t` (0…1) of the way from `a` to `b`, turning the short way round. */
export const blendPoses = (a: TViewPose, b: TViewPose, t: number): TViewPose => {
	const mix = (x: number, y: number) => x + (y - x) * t;
	return {
		target: [mix(a.target[0], b.target[0]), mix(a.target[1], b.target[1])],
		azimuth: a.azimuth + turnBetween(a.azimuth, b.azimuth) * t,
		elevation: mix(a.elevation, b.elevation),
		// Spans scale, so blend them evenly in proportion rather than in units.
		span: a.span * (b.span / a.span) ** t,
		perspective: b.perspective,
	};
};

/**
 * Reads the current view as a pose; set by the camera flight in the viewport,
 * so the UI can save the view it's looking at. Null until the viewport exists.
 */
export const currentView: { read: (() => TViewPose | null) | null } = { read: null };
