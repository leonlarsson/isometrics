import { useFrame } from "@react-three/fiber";
import { KeyStateTracker } from "@tanstack/react-hotkeys";
import { useEffect } from "react";
import * as THREE from "three";

import {
	flyingSpeed,
	rightButtonPress,
	runningCameraMoves,
	type TCameraMove,
} from "#/editor/keyboardCamera";
import { readPreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";
import { clamp } from "#/lib/math";

import { pixelsPerUnitAt, zoomLimits } from "./cameraMath";
import { FREE_TILT, orbitAround, polarLimits } from "./orbit";

/** At the usual keyboard speed: how much of the view's height a pan crosses per second. */
const PAN_PER_SECOND = 0.5;
/**
 * A move along one axis from `at` by `by`, cut short at ±`half`. From beyond
 * the edge (left there another way), moving back in is fine, further out isn't.
 */
const keepWithin = (at: number, by: number, half: number) => {
	if (at > half) {
		return Math.min(by, 0);
	}
	if (at < -half) {
		return Math.max(by, 0);
	}
	return clamp(at + by, -half, half) - at;
};

/** With simple camera control, how high above the ground moving with the keys stops the camera. */
const GROUND_CLEARANCE = 0.5;
/** Degrees per second for turning and tilting. */
const TURN_PER_SECOND = 70;
const TILT_PER_SECOND = 40;
/** How fast zooming changes the span (it doubles or halves in ln 2 / 1.6 s). */
const ZOOM_RATE = 1.6;

const UP = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const shift = new THREE.Vector3();
const pivot = new THREE.Vector3();
const offset = new THREE.Vector3();

/** Sideways and forwards (−1, 0 or 1) for each pan. */
const PAN: Partial<Record<TCameraMove, [number, number]>> = {
	panLeft: [-1, 0],
	panRight: [1, 0],
	panForward: [0, 1],
	panBack: [0, -1],
};

interface IControls {
	target: THREE.Vector3;
	update: () => void;
	dispatchEvent: (event: { type: "change" }) => void;
}

/**
 * Carries out the camera moves started from the keyboard (editor/keyboardCamera)
 * while their keys are held: pans along the ground relative to the view, turns
 * and tilts around the view's centre, zooms within the world's limits. Pressing
 * on the scene or switching windows stops them.
 */
export const KeyboardCamera = () => {
	useEffect(() => {
		// The tracker starts listening when it's first asked for: now, so it sees the first key too.
		KeyStateTracker.getInstance();
		const stopAll = () => runningCameraMoves.clear();
		window.addEventListener("blur", stopAll);
		window.addEventListener("pointerdown", stopAll);
		return () => {
			window.removeEventListener("blur", stopAll);
			window.removeEventListener("pointerdown", stopAll);
		};
	}, []);

	useFrame(({ camera, controls, size }, delta) => {
		if (runningCameraMoves.size === 0 || !controls || size.height === 0) {
			return;
		}
		const tracker = KeyStateTracker.getInstance();
		const now = performance.now();
		for (const [move, { key, until }] of runningCameraMoves) {
			if (now > until && !tracker.isKeyHeld(key)) {
				runningCameraMoves.delete(move);
			}
		}
		const orbit = controls as unknown as IControls;
		const { target } = orbit;
		const { scene, holdingRightButton: flying } = useEditor.getState();
		// Panning goes at the keyboard's speed (and, flying, the speed set by scrolling), turning and
		// tilting at the orbit speed and zooming at the zoom speed, like dragging and scrolling
		// (Preferences, editor/preferences).
		const preferences = readPreferences();
		const seconds = Math.min(delta, 0.1);
		const step = seconds * preferences.keyboardSpeed * (flying ? flyingSpeed.factor : 1);
		// How far a move goes: by how much the view shows, or, flying, by how much it showed when the
		// right button went down, so speed doesn't change with where you happen to look.
		const span = flying
			? rightButtonPress.span
			: size.height / pixelsPerUnitAt(camera, target, size.height);

		const simple = preferences.cameraControl === "simple";
		/**
		 * Move the camera and what it looks at together. With simple camera control the camera
		 * stays above the world: it stops at the ground and at the world's edges, the move cut
		 * short, so nothing drifts.
		 */
		const moveBy = (by: THREE.Vector3) => {
			if (simple) {
				const { width, depth } = scene.ground;
				const at = camera.position;
				if (at.y + by.y < GROUND_CLEARANCE) {
					by.y = Math.min(0, GROUND_CLEARANCE - at.y);
				}
				by.x = keepWithin(at.x, by.x, width / 2);
				by.z = keepWithin(at.z, by.z, depth / 2);
			}
			camera.position.add(by);
			target.add(by);
		};

		for (const move of runningCameraMoves.keys()) {
			const pan = PAN[move];
			if (pan) {
				// Forwards is where the camera looks: flattened onto the ground, or, flying with the right
				// mouse button held, straight along the view, as in Blender's fly mode or Unreal.
				forward.subVectors(target, camera.position);
				if (!flying) {
					forward.setY(0);
				}
				forward.normalize();
				right.crossVectors(forward, UP).normalize();
				shift
					.copy(right)
					.multiplyScalar(pan[0])
					.addScaledVector(forward, pan[1])
					.multiplyScalar(span * PAN_PER_SECOND * step);
				moveBy(shift);
			} else if (move === "moveUp" || move === "moveDown") {
				// Straight up or down, like flying in a game (Q and E).
				shift.set(0, (move === "moveUp" ? 1 : -1) * span * PAN_PER_SECOND * step, 0);
				moveBy(shift);
			} else if (move === "turnLeft" || move === "turnRight") {
				const turn = THREE.MathUtils.degToRad(TURN_PER_SECOND * seconds * preferences.orbitSpeed);
				pivot.copy(target);
				orbitAround(
					camera.position,
					target,
					pivot,
					move === "turnLeft" ? turn : -turn,
					0,
					flying ? FREE_TILT : polarLimits(scene.camera, preferences.cameraControl === "free"),
				);
			} else if (move === "tiltUp" || move === "tiltDown") {
				// Up looks down more steeply, like a map; down lowers the camera towards the horizon.
				const tilt = THREE.MathUtils.degToRad(TILT_PER_SECOND * seconds * preferences.orbitSpeed);
				pivot.copy(target);
				orbitAround(
					camera.position,
					target,
					pivot,
					0,
					move === "tiltUp" ? -tilt : tilt,
					flying ? FREE_TILT : polarLimits(scene.camera, preferences.cameraControl === "free"),
				);
			} else if (move === "zoomIn" || move === "zoomOut") {
				const factor = Math.exp(
					(move === "zoomIn" ? -1 : 1) * ZOOM_RATE * seconds * preferences.zoomSpeed,
				);
				const limits = zoomLimits(
					scene.camera,
					scene.ground,
					size.height,
					preferences.cameraControl === "free",
				);
				if (camera instanceof THREE.OrthographicCamera) {
					camera.zoom = clamp(camera.zoom / factor, limits.minZoom, limits.maxZoom);
					camera.updateProjectionMatrix();
				} else {
					offset.subVectors(camera.position, target);
					offset.setLength(clamp(offset.length() * factor, limits.minDistance, limits.maxDistance));
					camera.position.copy(target).add(offset);
				}
			}
		}
		camera.updateMatrixWorld();
		orbit.update();
		// OrbitControls only reports its own zooming, so say the view changed (render/CameraMemory).
		orbit.dispatchEvent({ type: "change" });
	});

	return null;
};
