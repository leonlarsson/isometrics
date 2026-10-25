import { advance, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import { pixelsPerUnitAt } from "./cameraMath";
import { viewShift } from "./viewShift";

const sideways = new THREE.Vector3();

interface IOrbitControls {
	target: THREE.Vector3;
	update: () => void;
}

/**
 * Keeps the world still on screen when a side panel opens, folds or is resized
 * (ADR-0055), and resizes the canvas in the same frame as the layout changes.
 *
 * The canvas grows or shrinks on one side; the world should stay where it is,
 * showing more or less of it on that side, instead of re-centring in the new
 * canvas. The diorama camera slides sideways by as much as the canvas's centre
 * moved; the perspective one stays put and shifts its view instead (viewShift,
 * applied by useViewOffset in CameraControls), since sliding it would change
 * what it sees. Resizing the window doesn't move the panels' edges, so the
 * view stays centred then, as before.
 *
 * React Three Fiber learns its new size a frame or two late (its measurement
 * goes through a React update), so the old picture and the label cards would
 * sit at the old place for those frames and visibly jump. A ResizeObserver
 * runs after layout and before the browser paints: the camera, the canvas size
 * and a fresh frame all happen there, from one measurement.
 */
export const InstantResize = () => {
	const get = useThree((s) => s.get);

	useEffect(() => {
		const container = get().gl.domElement.parentElement;
		if (!container) {
			return;
		}
		let insets: { left: number; right: number } | null = null;
		const observer = new ResizeObserver(() => {
			const box = container.getBoundingClientRect();
			// Hidden for a moment (React hides the canvas while something in it loads): that's no
			// panel moving, so remember the edges from before and wait for it to show again.
			if (box.width === 0 || box.height === 0) {
				return;
			}
			const left = box.left;
			const right = window.innerWidth - box.right;
			const last = insets;
			insets = { left, right };
			const state = get();
			const controls = state.controls as unknown as IOrbitControls | null;
			if (last && controls && (left !== last.left || right !== last.right)) {
				// The canvas's centre moved by half of what its edges did.
				const moved = (left - last.left - (right - last.right)) / 2;
				const { camera } = state;
				if (camera instanceof THREE.PerspectiveCamera) {
					viewShift.x -= moved;
				} else {
					const units = moved / pixelsPerUnitAt(camera, controls.target, box.height);
					sideways.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(units);
					camera.position.add(sideways);
					controls.target.add(sideways);
					controls.update();
				}
			}
			const { size } = state;
			if (box.width === size.width && box.height === size.height) {
				return;
			}
			state.setSize(box.width, box.height, box.top, box.left);
			// Draw now, with the camera and label cards updated, instead of at the next frame.
			advance(performance.now(), true, get());
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	return null;
};
