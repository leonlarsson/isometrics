import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";

import { PERSPECTIVE_FOV, pixelsPerUnitAt } from "./cameraMath";

/** Isometric-ish viewing direction (from target towards camera). */
export const VIEW_DIRECTION = new THREE.Vector3(1, 0.9, 1).normalize();
/** Far enough that every label and tall building stays in front of the orthographic camera. */
const CAMERA_DISTANCE = 150;
/** Height of the box used for framing, so tall parts and labels fit too. */
const FRAME_HEIGHT = 6;
const FILL = 0.9;
/** Framing one thing: leave room around it, and don't zoom in closer than this many units. */
const FOCUS_FILL = 0.6;
const FOCUS_MIN_SIZE = 16;

const corner = new THREE.Vector3();

/** Fit the camera's frustum to the canvas (R3F does this for its own camera on resize). */
const fitToCanvas = (camera: THREE.Camera, width: number, height: number) => {
	if (camera instanceof THREE.OrthographicCamera) {
		// r3f sizes the orthographic frustum in pixels, so zoom = pixels per unit.
		Object.assign(camera, {
			left: -width / 2,
			right: width / 2,
			top: height / 2,
			bottom: -height / 2,
		});
	} else if (camera instanceof THREE.PerspectiveCamera) {
		camera.aspect = width / height;
	}
	(camera as THREE.OrthographicCamera | THREE.PerspectiveCamera).updateProjectionMatrix();
};

/**
 * Frames the ground: the camera looks along VIEW_DIRECTION, and the zoom (or,
 * for the perspective camera, the distance) comes from the ground's projected
 * corners. With a `frameBox` (frame selection, F) it frames that box instead,
 * from the angle you're looking at it. Runs once the canvas has a size, on
 * ground resize, and when "re-centre" or "frame selection" is requested; not
 * on every canvas resize (that would throw away the user's pan and zoom when a
 * panel opens), and not when the camera switches (ProjectionSwitch keeps the
 * view then).
 *
 * (drei's <Bounds> moves an orthographic camera very close to the scene,
 * which makes drei <Html> hide labels it thinks are behind the camera.)
 */
export const CameraRig = () => {
	const camera = useThree((s) => s.camera);
	const controls = useThree((s) => s.controls) as unknown as {
		target: THREE.Vector3;
		update: () => void;
	} | null;
	const get = useThree((s) => s.get);
	const hasSize = useThree((s) => s.size.width > 0 && s.size.height > 0);
	const groundWidth = useEditor((s) => s.scene.ground.width);
	const groundDepth = useEditor((s) => s.scene.ground.depth);
	const nonce = useEditor((s) => s.viewNonce);
	const box = useEditor((s) => s.frameBox);
	// What was framed last; a camera switch alone doesn't re-frame.
	const framed = useRef<string | null>(null);

	useEffect(() => {
		const request = `${nonce}:${groundWidth}:${groundDepth}`;
		if (!hasSize || !controls || framed.current === request) {
			return;
		}
		framed.current = request;
		const { width, height } = get().size;

		// The box to fit: the ground (and a bit above it), or the thing being framed.
		const [cx, cy, cz] = box ? box.center : [0, FRAME_HEIGHT / 2, 0];
		const [sx, sy, sz] = box
			? box.size.map((size) => Math.max(size, FOCUS_MIN_SIZE))
			: [groundWidth, FRAME_HEIGHT, groundDepth];
		const target = new THREE.Vector3(cx, box ? cy : 0, cz);
		// Re-centring goes back to the iso view; framing one thing keeps the angle you're looking from.
		const direction = box
			? camera.position.clone().sub(controls.target).normalize()
			: VIEW_DIRECTION.clone();

		camera.position.copy(direction).multiplyScalar(CAMERA_DISTANCE).add(target);
		camera.lookAt(target);
		camera.updateMatrixWorld();

		// How far the box reaches from its centre, across and up the screen.
		let maxX = 0;
		let maxY = 0;
		const centre = target.clone().applyMatrix4(camera.matrixWorldInverse);
		for (const x of [cx - sx / 2, cx + sx / 2]) {
			for (const y of [cy - sy / 2, cy + sy / 2]) {
				for (const z of [cz - sz / 2, cz + sz / 2]) {
					corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).sub(centre);
					maxX = Math.max(maxX, Math.abs(corner.x));
					maxY = Math.max(maxY, Math.abs(corner.y));
				}
			}
		}
		const fill = box ? FOCUS_FILL : FILL;
		// Pixels per world unit that fit the box.
		const scale = Math.min(width / (2 * maxX), height / (2 * maxY)) * fill;
		if (camera instanceof THREE.OrthographicCamera) {
			camera.zoom = scale;
		} else if (camera instanceof THREE.PerspectiveCamera) {
			// The distance at which the target shows at that scale (plus room for the box's depth).
			const halfHeight = height / scale / 2;
			const distance =
				halfHeight / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) + Math.max(sx, sz) / 2;
			camera.position.copy(direction).multiplyScalar(distance).add(target);
		}
		fitToCanvas(camera, width, height);

		controls.target.copy(target);
		controls.update();
	}, [camera, controls, hasSize, groundWidth, groundDepth, nonce]);

	return null;
};

/**
 * Switches between the orthographic (diorama) and perspective cameras when
 * `perspective` changes, keeping the view: same target, same angle, and the
 * target shown at the same scale. See docs/adr/0038-perspective-camera.md.
 */
export const ProjectionSwitch = () => {
	const perspective = useEditor((s) => s.perspective);
	const camera = useThree((s) => s.camera);
	const controls = useThree((s) => s.controls) as unknown as {
		target: THREE.Vector3;
		update: () => void;
	} | null;
	const set = useThree((s) => s.set);
	const get = useThree((s) => s.get);
	// The canvas's own (orthographic) camera, and a perspective one to switch to.
	const cameras = useMemo(
		() => ({
			orthographic: camera,
			perspective: new THREE.PerspectiveCamera(PERSPECTIVE_FOV, 1, 0.1, 2000),
		}),
		[],
	);
	// Where to look once the controls have moved to the new camera.
	const pending = useRef<THREE.Vector3 | null>(null);

	useEffect(() => {
		const current = get().camera;
		const next = perspective ? cameras.perspective : cameras.orthographic;
		if (next === current || !controls) {
			return;
		}
		const { width, height } = get().size;
		const target = controls.target.clone();
		const direction = current.position.clone().sub(target).normalize();
		const scale = pixelsPerUnitAt(current, target, height);
		if (next instanceof THREE.PerspectiveCamera) {
			const visible = height / scale;
			const distance = visible / 2 / Math.tan(THREE.MathUtils.degToRad(next.fov) / 2);
			next.position.copy(direction).multiplyScalar(distance).add(target);
		} else if (next instanceof THREE.OrthographicCamera) {
			next.zoom = scale;
			next.position.copy(direction).multiplyScalar(CAMERA_DISTANCE).add(target);
		}
		next.lookAt(target);
		fitToCanvas(next, width, height);
		next.updateMatrixWorld();
		pending.current = target;
		set({ camera: next as THREE.OrthographicCamera });
	}, [perspective]);

	// The controls are rebuilt for the new camera with a default target: put the view back.
	useEffect(() => {
		if (pending.current && controls && camera) {
			controls.target.copy(pending.current);
			controls.update();
			pending.current = null;
		}
	}, [controls, camera]);

	return null;
};
