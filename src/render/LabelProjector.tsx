import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { gizmoArea, labelAnchors, labelElements } from "./labelRegistry";

const point = new THREE.Vector3();

/** Cards this far (px) from the gizmo can't overlap it, so they skip the precise check. */
const NEAR_GIZMO = 400;

/** Whether a card's on-screen box overlaps the gizmo's area. */
const overGizmo = (element: HTMLElement, canvas: DOMRect, x: number, y: number) => {
	if (!gizmoArea.active) {
		return false;
	}
	const centerX = (gizmoArea.left + gizmoArea.right) / 2;
	const centerY = (gizmoArea.top + gizmoArea.bottom) / 2;
	if (Math.abs(x - centerX) > NEAR_GIZMO || Math.abs(y - centerY) > NEAR_GIZMO) {
		return false;
	}
	const card = element.firstElementChild?.getBoundingClientRect();
	if (!card) {
		return false;
	}
	return (
		card.right - canvas.left > gizmoArea.left &&
		card.left - canvas.left < gizmoArea.right &&
		card.bottom - canvas.top > gizmoArea.top &&
		card.top - canvas.top < gizmoArea.bottom
	);
};

/**
 * Projects every registered label anchor to screen space and moves its card.
 * Cards over the transform gizmo get `data-under-gizmo`, which fades them and
 * lets the pointer through to the handles.
 */
export const LabelProjector = () => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const gl = useThree((s) => s.gl);

	useFrame(() => {
		const canvas = gl.domElement.getBoundingClientRect();
		for (const [id, element] of labelElements) {
			const anchor = labelAnchors.get(id);
			if (!anchor) {
				element.style.visibility = "hidden";
				continue;
			}
			anchor.getWorldPosition(point).project(camera);
			const x = ((point.x + 1) / 2) * size.width;
			const y = ((1 - point.y) / 2) * size.height;
			element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
			element.style.visibility = Math.abs(point.z) <= 1 ? "visible" : "hidden";
			const covering = overGizmo(element, canvas, x, y);
			if (covering !== element.hasAttribute("data-under-gizmo")) {
				element.toggleAttribute("data-under-gizmo", covering);
			}
		}
	});

	return null;
};
