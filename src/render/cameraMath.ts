import * as THREE from "three";

import { DEG2RAD } from "#/lib/math";
import type { TCameraSettings } from "#/scene/schema";

/**
 * Camera measurements that work for both the orthographic (diorama) and the
 * perspective camera. See docs/adr/0038-perspective-camera.md.
 */

const local = new THREE.Vector3();

/**
 * Screen pixels per world unit at `point`: constant for the orthographic
 * camera (its zoom), smaller with distance for the perspective one.
 */
export const pixelsPerUnitAt = (
	camera: THREE.Camera,
	point: THREE.Vector3,
	viewportHeight: number,
): number => {
	if (camera instanceof THREE.OrthographicCamera) {
		return camera.zoom;
	}
	if (camera instanceof THREE.PerspectiveCamera) {
		const depth = Math.max(-local.copy(point).applyMatrix4(camera.matrixWorldInverse).z, 1e-3);
		const visible = (2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / camera.zoom;
		return viewportHeight / visible;
	}
	return 20;
};

/**
 * A lens's focal length (mm) and the field of view it gives (degrees, top to
 * bottom), as on a full-frame camera: a 36 × 24 mm sensor, so 24 mm high.
 */
const SENSOR_HEIGHT = 24;

export const focalLengthOf = (fieldOfView: number) =>
	SENSOR_HEIGHT / 2 / Math.tan((fieldOfView * DEG2RAD) / 2);

export const fieldOfViewOf = (focalLength: number) =>
	(2 * Math.atan(SENSOR_HEIGHT / 2 / focalLength)) / DEG2RAD;

/** The longest straight line across the ground: its diagonal. */
export const groundSpan = (ground: { width: number; depth: number }) =>
	Math.hypot(ground.width, ground.depth);

/**
 * How far the orthographic camera stands back from its target. In that view
 * distance doesn't change how big things look, only what's in front of the
 * camera: far enough that the whole ground, and tall things on it, are.
 */
export const orthographicDistance = (ground: { width: number; depth: number }) =>
	Math.max(150, groundSpan(ground) + 50);

/** How far out the camera can zoom (grid units from the top of the view to the bottom). */
export const farthestSpanOf = (
	camera: Pick<TCameraSettings, "farthestSpan">,
	ground: { width: number; depth: number },
) => camera.farthestSpan ?? Math.round(Math.max(120, groundSpan(ground) * 2.5));

/** How close and far free camera control lets the camera zoom (grid units across the view). */
const FREE_CLOSEST = 0.01;
const FREE_FARTHEST = 100000;

/**
 * The controls' zoom limits for the world's closest and farthest zoom, or with
 * free camera control (editor/preferences) next to none: orthographic zoom
 * (pixels per unit, for a canvas `height` px high) and the perspective
 * camera's distance from its target (for its field of view).
 */
export const zoomLimits = (
	camera: Pick<TCameraSettings, "closestSpan" | "farthestSpan" | "fieldOfView">,
	ground: { width: number; depth: number },
	height: number,
	free = false,
) => {
	const closest = free ? FREE_CLOSEST : camera.closestSpan;
	const farthest = free ? FREE_FARTHEST : Math.max(closest, farthestSpanOf(camera, ground));
	const distanceFor = (span: number) => span / 2 / Math.tan((camera.fieldOfView * DEG2RAD) / 2);
	return {
		minZoom: height / farthest,
		maxZoom: height / closest,
		minDistance: distanceFor(closest),
		maxDistance: distanceFor(farthest),
	};
};
