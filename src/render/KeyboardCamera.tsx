import { useFrame } from "@react-three/fiber";
import { KeyStateTracker } from "@tanstack/react-hotkeys";
import { useEffect } from "react";
import * as THREE from "three";

import { readCameraFeel } from "#/editor/cameraFeel";
import { runningCameraMoves, type TCameraMove } from "#/editor/keyboardCamera";
import { useEditor } from "#/editor/store";
import { clamp } from "#/lib/math";

import { pixelsPerUnitAt, zoomLimits } from "./cameraMath";
import { orbitAround, polarLimits } from "./orbit";

/** At the usual keyboard speed: how much of the view's height a pan crosses per second. */
const PAN_PER_SECOND = 0.5;
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
		// Panning goes at the keyboard's speed, turning and tilting at the orbit speed and zooming at
		// the zoom speed, like dragging and scrolling (Your camera, editor/cameraFeel).
		const feel = readCameraFeel();
		const seconds = Math.min(delta, 0.1);
		const step = seconds * feel.keyboardSpeed;
		const { scene } = useEditor.getState();
		const span = size.height / pixelsPerUnitAt(camera, target, size.height);

		for (const move of runningCameraMoves.keys()) {
			const pan = PAN[move];
			if (pan) {
				// Along the ground: forwards is where the camera looks, flattened.
				forward.subVectors(target, camera.position).setY(0).normalize();
				right.crossVectors(forward, UP).normalize();
				shift
					.copy(right)
					.multiplyScalar(pan[0])
					.addScaledVector(forward, pan[1])
					.multiplyScalar(span * PAN_PER_SECOND * step);
				camera.position.add(shift);
				target.add(shift);
			} else if (move === "turnLeft" || move === "turnRight") {
				const turn = THREE.MathUtils.degToRad(TURN_PER_SECOND * seconds * feel.orbitSpeed);
				pivot.copy(target);
				orbitAround(
					camera.position,
					target,
					pivot,
					move === "turnLeft" ? turn : -turn,
					0,
					polarLimits(scene.camera, camera instanceof THREE.PerspectiveCamera),
				);
			} else if (move === "tiltUp" || move === "tiltDown") {
				// Up looks down more steeply, like a map; down lowers the camera towards the horizon.
				const tilt = THREE.MathUtils.degToRad(TILT_PER_SECOND * seconds * feel.orbitSpeed);
				pivot.copy(target);
				orbitAround(
					camera.position,
					target,
					pivot,
					0,
					move === "tiltUp" ? -tilt : tilt,
					polarLimits(scene.camera, camera instanceof THREE.PerspectiveCamera),
				);
			} else if (move === "zoomIn" || move === "zoomOut") {
				const factor = Math.exp(
					(move === "zoomIn" ? -1 : 1) * ZOOM_RATE * seconds * feel.zoomSpeed,
				);
				const limits = zoomLimits(scene.camera, scene.ground, size.height);
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
