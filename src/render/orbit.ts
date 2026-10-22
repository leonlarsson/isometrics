import * as THREE from "three";

import { clamp } from "#/lib/math";

/**
 * Orbiting around a point under the cursor (render/CameraControls), as plain
 * vector maths so it can be unit-tested. See docs/adr/0037-camera.md.
 */

/** How far the camera may tilt: from nearly straight down to fairly low over the ground. */
export const MIN_POLAR = 0.05;
export const MAX_POLAR = 1.3;

const UP = new THREE.Vector3(0, 1, 0);
const offset = new THREE.Vector3();
const axis = new THREE.Vector3();

/** Turn `point` around the line through `center` along `direction` by `angle` (radians). */
const rotateAround = (
	point: THREE.Vector3,
	center: THREE.Vector3,
	direction: THREE.Vector3,
	angle: number,
) => point.sub(center).applyAxisAngle(direction, angle).add(center);

/**
 * Turn the camera and its target together around `pivot`: `turn` around the
 * vertical (radians), then `tilt` towards or away from straight down, kept
 * within MIN_POLAR…MAX_POLAR. The pivot keeps its place on screen. Mutates
 * `position` and `target`.
 */
export const orbitAround = (
	position: THREE.Vector3,
	target: THREE.Vector3,
	pivot: THREE.Vector3,
	turn: number,
	tilt: number,
) => {
	rotateAround(position, pivot, UP, turn);
	rotateAround(target, pivot, UP, turn);

	offset.subVectors(position, target);
	const polar = Math.acos(clamp(offset.y / offset.length(), -1, 1));
	const change = clamp(polar + tilt, MIN_POLAR, MAX_POLAR) - polar;
	if (Math.abs(change) > 1e-9) {
		// Positive angles around up × offset tip the camera down towards the horizon.
		axis.crossVectors(UP, offset).normalize();
		rotateAround(position, pivot, axis, change);
		rotateAround(target, pivot, axis, change);
	}
};

/**
 * Move the target along the line of sight (which leaves the picture as it is)
 * to where that line meets the ground, or, if that's off the ground slab, to
 * the nearest point of the line that's over it. The editor keeps the target
 * over the ground (CameraControls' useKeepTargetOnGround) by shifting the
 * view, which would make an orbit jump. Mutates `target`.
 */
export const settleTarget = (
	position: THREE.Vector3,
	target: THREE.Vector3,
	ground: { width: number; depth: number },
) => {
	const direction = offset.subVectors(target, position).normalize();
	const [hw, hd] = [ground.width / 2, ground.depth / 2];
	// Where along the line (distance from the camera) it is over the slab, per axis.
	let from = 0;
	let to = Number.POSITIVE_INFINITY;
	for (const [start, step, half] of [
		[position.x, direction.x, hw],
		[position.z, direction.z, hd],
	]) {
		if (Math.abs(step) < 1e-9) {
			if (Math.abs(start) > half) {
				return;
			}
			continue;
		}
		const a = (-half - start) / step;
		const b = (half - start) / step;
		from = Math.max(from, Math.min(a, b));
		to = Math.min(to, Math.max(a, b));
	}
	if (from > to) {
		return; // Looking past the slab altogether: leave it.
	}
	const onGround = direction.y < -1e-9 ? -position.y / direction.y : target.distanceTo(position);
	target.copy(position).addScaledVector(direction, clamp(onGround, from, to));
};
