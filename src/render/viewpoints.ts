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

/**
 * Unit vector from the target towards the camera for a compass angle and
 * height (degrees). Straight down stops a hair short of 90°, so the compass
 * angle still says which way the view is turned.
 */
export const directionOf = (azimuth: number, elevation: number) => {
	const a = azimuth * DEG2RAD;
	const e = Math.min(elevation, 89.99) * DEG2RAD;
	return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), -Math.cos(e) * Math.sin(a));
};

/**
 * The pose a camera looking at `target` has now. `height` is the canvas height
 * (CSS px). A pose's target is on the ground, but the controls' target can be
 * above or below it (zooming to the cursor moves it sideways in 3D), so it's
 * slid along the line of sight down to the ground first: the same view, with
 * a target that placeCamera puts back in the same place. Its field of view is
 * null while it's the world's (`worldFieldOfView`), so it follows the world's.
 */
export const poseOf = (
	camera: THREE.Camera,
	target: THREE.Vector3,
	height: number,
	perspective: boolean,
	worldFieldOfView: number,
): TViewPose => {
	const direction = camera.position.clone().sub(target).normalize();
	const onGround =
		Math.abs(direction.y) > 1e-6
			? target.clone().addScaledVector(direction, -target.y / direction.y)
			: target.clone().setY(0);
	return {
		target: [round(onGround.x, 2), round(onGround.z, 2)],
		// Hundredths of a degree: coarser rounding shows as a shift when zoomed in close.
		azimuth: round(normalizeDegrees(Math.atan2(-direction.z, direction.x) / DEG2RAD), 2),
		elevation: round(clamp(Math.asin(direction.y) / DEG2RAD, 0, 90), 2),
		span: round(clamp(height / pixelsPerUnitAt(camera, onGround, height), 1, 5000), 2),
		perspective,
		fieldOfView:
			camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - worldFieldOfView) >= 0.05
				? round(camera.fov, 1)
				: null,
	};
};

/**
 * Put the camera at a pose (looking at its target, which the caller gives the
 * controls), with the pose's field of view, or else the world's.
 */
export const placeCamera = (
	camera: THREE.Camera,
	pose: TViewPose,
	height: number,
	worldFieldOfView: number,
) => {
	const target = new THREE.Vector3(pose.target[0], 0, pose.target[1]);
	const direction = directionOf(pose.azimuth, pose.elevation);
	if (camera instanceof THREE.PerspectiveCamera) {
		const fieldOfView = pose.fieldOfView ?? worldFieldOfView;
		if (camera.fov !== fieldOfView) {
			camera.fov = fieldOfView;
			camera.updateProjectionMatrix();
		}
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
	// One that follows the world's field of view blends as if it had the other's.
	const fieldOfViewA = a.fieldOfView ?? b.fieldOfView;
	const fieldOfViewB = b.fieldOfView ?? a.fieldOfView;
	return {
		target: [mix(a.target[0], b.target[0]), mix(a.target[1], b.target[1])],
		azimuth: a.azimuth + turnBetween(a.azimuth, b.azimuth) * t,
		elevation: mix(a.elevation, b.elevation),
		// Spans scale, so blend them evenly in proportion rather than in units.
		span: a.span * (b.span / a.span) ** t,
		perspective: b.perspective,
		fieldOfView:
			fieldOfViewA === null || fieldOfViewB === null ? null : mix(fieldOfViewA, fieldOfViewB),
	};
};

/**
 * Reads the current view as a pose; set by the camera flight in the viewport,
 * so the UI can save the view it's looking at. Null until the viewport exists.
 */
export const currentView: { read: (() => TViewPose | null) | null } = { read: null };

/**
 * Set while the camera switches between orthographic and perspective (render/ProjectionSwitch),
 * until the controls on the new camera have their target back. A jump waits for it, so the
 * switch doesn't put the old target back over it.
 */
export const projectionSwitch = { pending: false };

/**
 * Set by render/CameraFlight: gives a running glide a new field of view to
 * end at (a slider moved during it). False when no glide is running.
 */
export const flightFieldOfView: { retarget: ((fieldOfView: number) => boolean) | null } = {
	retarget: null,
};
