import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import type { TViewPose } from "#/scene/schema";

import { blendPoses, currentView, placeCamera, poseOf, projectionSwitch } from "./viewpoints";
import { resetViewShift } from "./viewShift";

/** How long gliding to a viewpoint takes. */
const FLIGHT_SECONDS = 0.8;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

interface IFlight {
	/** Where it started; read on the first frame, after a camera switch has happened. */
	from: TViewPose | null;
	to: TViewPose;
	progress: number;
	/** A jump, not a glide: it goes straight there. */
	instant: boolean;
}

/**
 * Glides the camera to a requested viewpoint (`flight` in the store), and
 * lets the UI read the current view to save it. Grabbing or scrolling the
 * scene stops a flight where it is. See docs/adr/0039-saved-viewpoints.md.
 */
export const CameraFlight = () => {
	const request = useEditor((s) => s.flight);
	const get = useThree((s) => s.get);
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);
	const flight = useRef<IFlight | null>(null);

	useEffect(() => {
		currentView.read = () => {
			const { camera, controls, size } = get();
			const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
			return target ? poseOf(camera, target, size.height, useEditor.getState().perspective) : null;
		};
		return () => {
			currentView.read = null;
		};
	}, []);

	useEffect(() => {
		if (request) {
			resetViewShift();
			flight.current = { from: null, to: request.pose, progress: 0, instant: request.instant };
		}
	}, [request?.nonce]);

	useEffect(() => {
		const stop = () => {
			flight.current = null;
		};
		element.addEventListener("pointerdown", stop);
		element.addEventListener("wheel", stop, { passive: true });
		return () => {
			element.removeEventListener("pointerdown", stop);
			element.removeEventListener("wheel", stop);
		};
	}, [element]);

	useFrame((_, delta) => {
		const current = flight.current;
		const { camera, size } = get();
		const controls = get().controls as unknown as {
			object: THREE.Camera;
			target: THREE.Vector3;
			update: () => void;
		} | null;
		// Not before the canvas has a size: there's nothing to fit the view to yet.
		if (!current || !controls || size.height === 0) {
			return;
		}
		current.from ??= poseOf(camera, controls.target, size.height, current.to.perspective);
		current.progress = current.instant
			? 1
			: Math.min(1, current.progress + Math.min(delta, 0.1) / FLIGHT_SECONDS);
		const pose = blendPoses(current.from, current.to, easeInOut(current.progress));
		controls.target.copy(placeCamera(camera, pose, size.height));
		controls.update();
		// Done once it's there on the camera it asked for, with that camera's controls settled in.
		const settled =
			!projectionSwitch.pending &&
			camera instanceof THREE.PerspectiveCamera === current.to.perspective &&
			controls.object === camera;
		if (current.progress >= 1 && settled) {
			flight.current = null;
		}
	});

	return null;
};
