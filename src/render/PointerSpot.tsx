import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import { pointerSpot } from "#/editor/pointerSpot";

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();

/**
 * Keeps track of the mouse pointer over the view, so editor/pointerSpot can
 * say where on the ground it is (Ctrl+V pastes there). Over a label card
 * counts as over the world; over a panel or a bar doesn't.
 */
export const PointerSpot = () => {
	const camera = useThree((s) => s.camera);
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);

	useEffect(() => {
		let last: { x: number; y: number } | null = null;
		const onMove = (event: PointerEvent) => {
			last = { x: event.clientX, y: event.clientY };
		};
		pointerSpot.read = () => {
			if (!last) {
				return null;
			}
			const under = document.elementFromPoint(last.x, last.y);
			const overWorld =
				under !== null && (element.contains(under) || under.closest("[data-label-layer]") !== null);
			if (!overWorld) {
				return null;
			}
			const rect = element.getBoundingClientRect();
			ndc.set(
				((last.x - rect.left) / rect.width) * 2 - 1,
				-((last.y - rect.top) / rect.height) * 2 + 1,
			);
			raycaster.setFromCamera(ndc, camera);
			return raycaster.ray.intersectPlane(ground, hit) ? [hit.x, hit.z] : null;
		};
		window.addEventListener("pointermove", onMove);
		return () => {
			window.removeEventListener("pointermove", onMove);
			pointerSpot.read = null;
		};
	}, [camera, element]);

	return null;
};
