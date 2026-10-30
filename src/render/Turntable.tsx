import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { runningCameraMoves } from "#/editor/keyboardCamera";
import { readPreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";

import { orbitAround, polarLimits } from "./orbit";

/** Seconds it takes to come up to speed, so it starts gently. */
const EASE_IN_SECONDS = 2;

const pivot = new THREE.Vector3();

interface IControls {
	target: THREE.Vector3;
	update: () => void;
}

/**
 * The turntable (scene.camera.turntable, ADR-0062): in View mode, after the
 * world's delay without input, the view slowly circles its centre, easing in;
 * any press, scroll or key stops it at once and starts the wait again. Not
 * while following a vehicle or gliding to a viewpoint.
 */
export const Turntable = () => {
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);
	// Not while the world keeps the isometric angle, which turns only a quarter at a time.
	const enabled = useEditor(
		(s) =>
			s.mode === "view" && s.scene.camera.turntable.isOn && !s.scene.camera.keepsIsometricAngle,
	);
	// When there was last any input (performance.now() ms), and how long it has been turning.
	const lastInput = useRef(performance.now());
	const turning = useRef(0);

	useEffect(() => {
		if (!enabled) {
			return;
		}
		const onInput = () => {
			lastInput.current = performance.now();
			turning.current = 0;
		};
		onInput();
		element.addEventListener("pointerdown", onInput);
		element.addEventListener("wheel", onInput, { passive: true });
		window.addEventListener("pointermove", onInput);
		window.addEventListener("keydown", onInput);
		return () => {
			element.removeEventListener("pointerdown", onInput);
			element.removeEventListener("wheel", onInput);
			window.removeEventListener("pointermove", onInput);
			window.removeEventListener("keydown", onInput);
		};
	}, [enabled, element]);

	useFrame(({ camera, controls }, delta) => {
		if (!enabled || !controls) {
			return;
		}
		const { scene, cameraFollow } = useEditor.getState();
		const idle = (performance.now() - lastInput.current) / 1000;
		if (idle < scene.camera.turntable.delay || cameraFollow || runningCameraMoves.size > 0) {
			return;
		}
		const step = Math.min(delta, 0.1);
		turning.current += step;
		const ease = Math.min(1, turning.current / EASE_IN_SECONDS);
		const orbit = controls as unknown as IControls;
		// The camera goes round the other way to the world.
		const turn = -THREE.MathUtils.degToRad(scene.camera.turntable.speed) * step * ease * ease;
		pivot.copy(orbit.target);
		orbitAround(
			camera.position,
			orbit.target,
			pivot,
			turn,
			0,
			polarLimits(scene.camera, readPreferences().cameraControl === "free"),
		);
		camera.updateMatrixWorld();
		orbit.update();
	});

	return null;
};
