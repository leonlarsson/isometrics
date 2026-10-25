import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { runningCameraMoves } from "#/editor/keyboardCamera";
import { readPreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";
import type { TViewPose } from "#/scene/schema";

import {
	blendPoses,
	currentView,
	isometricPoseOf,
	placeCamera,
	poseOf,
	projectionSwitch,
	runningFlight,
} from "./viewpoints";
import { resetViewShift } from "./viewShift";

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

interface IFlight {
	/** Where it started; read on the first frame, after a camera switch has happened. */
	from: TViewPose | null;
	to: TViewPose;
	progress: number;
	/** How long it takes; 0 jumps straight there. */
	seconds: number;
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
			const { projection, scene } = useEditor.getState();
			return target
				? poseOf(camera, target, size.height, projection, scene.camera.fieldOfView)
				: null;
		};
		return () => {
			currentView.read = null;
		};
	}, []);

	// The camera menu's (or I's) isometric angle: from the view as it is now.
	const isometricNonce = useEditor((s) => s.isometricNonce);
	useEffect(() => {
		const pose = isometricNonce > 0 ? currentView.read?.() : null;
		if (pose) {
			useEditor.getState().glideTo(isometricPoseOf(pose));
		}
	}, [isometricNonce]);

	useEffect(() => {
		if (request) {
			resetViewShift();
			const { fieldOfView } = useEditor.getState().scene.camera;
			flight.current = {
				from: null,
				to: { ...request.pose, fieldOfView: request.pose.fieldOfView ?? fieldOfView },
				progress: 0,
				// Opening a world jumps; a glide takes as long as this browser's camera settings say.
				seconds: request.instant ? 0 : readPreferences().glideSeconds,
			};
		}
	}, [request?.nonce]);

	useEffect(() => {
		runningFlight.retarget = (fieldOfView) => {
			const current = flight.current;
			if (!current) {
				return false;
			}
			current.to = { ...current.to, fieldOfView };
			return true;
		};
		runningFlight.stop = () => {
			flight.current = null;
		};
		return () => {
			runningFlight.retarget = null;
			runningFlight.stop = null;
		};
	}, []);

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
		// Moving the camera with the keyboard stops a glide where it is, like grabbing the scene.
		if (runningCameraMoves.size > 0 && current.seconds > 0) {
			flight.current = null;
			return;
		}
		const worldFieldOfView = useEditor.getState().scene.camera.fieldOfView;
		// From the field of view the camera has to the one the view asks for, the world's or its own.
		current.from ??= {
			...poseOf(camera, controls.target, size.height, current.to.projection, worldFieldOfView),
			fieldOfView: camera instanceof THREE.PerspectiveCamera ? camera.fov : null,
		};
		current.progress =
			current.seconds <= 0
				? 1
				: Math.min(1, current.progress + Math.min(delta, 0.1) / current.seconds);
		const pose = blendPoses(current.from, current.to, easeInOut(current.progress));
		controls.target.copy(placeCamera(camera, pose, size.height, worldFieldOfView));
		controls.update();
		// Done once it's there on the camera it asked for, with that camera's controls settled in.
		const settled =
			!projectionSwitch.pending &&
			camera instanceof THREE.PerspectiveCamera === (current.to.projection === "perspective") &&
			controls.object === camera;
		if (current.progress >= 1 && settled) {
			flight.current = null;
		}
	});

	return null;
};
