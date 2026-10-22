import * as THREE from "three";

/**
 * Camera measurements that work for both the orthographic (diorama) and the
 * perspective camera. See docs/adr/0038-perspective-camera.md.
 */

/** Field of view of the perspective camera (degrees, vertical). */
export const PERSPECTIVE_FOV = 40;

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
