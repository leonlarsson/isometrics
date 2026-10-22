import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";

/** Isometric-ish viewing direction (from target towards camera). */
const VIEW_DIRECTION = new THREE.Vector3(1, 0.9, 1).normalize();
/** Far enough that every label and tall building stays in front of the camera. */
const CAMERA_DISTANCE = 150;
/** Height of the box used for framing, so tall parts and labels fit too. */
const FRAME_HEIGHT = 6;
const FILL = 0.9;

const corner = new THREE.Vector3();

/**
 * Frames the ground with the orthographic camera: fixed far position along
 * VIEW_DIRECTION, zoom computed from the ground's projected corners.
 * Runs once the canvas has a size, on ground resize, and when "re-centre" is
 * requested. Not on every canvas resize: that would throw away the user's pan
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

	useEffect(() => {
		if (!(camera instanceof THREE.OrthographicCamera) || !hasSize) {
			return;
		}
		const { width, height } = get().size;

		camera.position.copy(VIEW_DIRECTION).multiplyScalar(CAMERA_DISTANCE);
		camera.lookAt(0, 0, 0);
		camera.updateMatrixWorld();

		let maxX = 0;
		let maxY = 0;
		for (const x of [-groundWidth / 2, groundWidth / 2]) {
			for (const y of [0, FRAME_HEIGHT]) {
				for (const z of [-groundDepth / 2, groundDepth / 2]) {
					corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
					maxX = Math.max(maxX, Math.abs(corner.x));
					maxY = Math.max(maxY, Math.abs(corner.y));
				}
			}
		}
		// r3f sizes the orthographic frustum in pixels, so zoom = pixels per unit.
		camera.zoom = Math.min(width / (2 * maxX), height / (2 * maxY)) * FILL;
		camera.updateProjectionMatrix();

		if (controls) {
			controls.target.set(0, 0, 0);
			controls.update();
		}
	}, [camera, controls, hasSize, groundWidth, groundDepth, nonce]);

	return null;
};
