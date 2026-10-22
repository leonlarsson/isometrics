import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";

/** Isometric-ish viewing direction (from target towards camera). */
export const VIEW_DIRECTION = new THREE.Vector3(1, 0.9, 1).normalize();
/** Far enough that every label and tall building stays in front of the camera. */
const CAMERA_DISTANCE = 150;
/** Height of the box used for framing, so tall parts and labels fit too. */
const FRAME_HEIGHT = 6;
const FILL = 0.9;
/** Framing one thing: leave room around it, and don't zoom in closer than this many units. */
const FOCUS_FILL = 0.6;
const FOCUS_MIN_SIZE = 16;

const corner = new THREE.Vector3();

/**
 * Frames the ground with the orthographic camera: fixed far position along
 * VIEW_DIRECTION, zoom computed from the ground's projected corners. With a
 * `frameBox` (frame selection, F) it frames that box instead, centred on it.
 * Runs once the canvas has a size, on ground resize, and when "re-centre" or
 * "frame selection" is requested. Not on every canvas resize: that would throw away the user's pan
 * and zoom whenever a panel opens (the orthographic view keeps its scale and
 * centre on resize by itself).
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

	useEffect(() => {
		if (!(camera instanceof THREE.OrthographicCamera) || !hasSize) {
			return;
		}
		const { width, height } = get().size;

		// The box to fit: the ground (and a bit above it), or the thing being framed.
		const [cx, cy, cz] = box ? box.center : [0, FRAME_HEIGHT / 2, 0];
		const [sx, sy, sz] = box
			? box.size.map((size) => Math.max(size, FOCUS_MIN_SIZE))
			: [groundWidth, FRAME_HEIGHT, groundDepth];
		const target = new THREE.Vector3(cx, box ? cy : 0, cz);
		// Re-centring goes back to the iso view; framing one thing keeps the angle you're looking from.
		const direction =
			box && controls ? camera.position.clone().sub(controls.target).normalize() : VIEW_DIRECTION;

		camera.position.copy(direction).multiplyScalar(CAMERA_DISTANCE).add(target);
		camera.lookAt(target);
		camera.updateMatrixWorld();

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
		// r3f sizes the orthographic frustum in pixels, so zoom = pixels per unit.
		camera.zoom = Math.min(width / (2 * maxX), height / (2 * maxY)) * (box ? FOCUS_FILL : FILL);
		camera.updateProjectionMatrix();

		if (controls) {
			controls.target.copy(target);
			controls.update();
		}
	}, [camera, controls, hasSize, groundWidth, groundDepth, nonce]);

	return null;
};
