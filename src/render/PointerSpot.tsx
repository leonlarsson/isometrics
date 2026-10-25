import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import { pointerSpot } from "#/editor/pointerSpot";
import type { TViewPose } from "#/scene/schema";

import { currentView } from "./viewpoints";

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();
const projected = new THREE.Vector3();

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
		// Development: where a point in the world is on screen (client px), for the end-to-end tests
		// to click handles and objects exactly, and where the camera is (e2e/, ADR-0069).
		const holder = globalThis as {
			__editorView?: {
				screenOf: (point: [number, number, number]) => { x: number; y: number };
				pose: () => TViewPose | null;
			};
		};
		if (import.meta.env.DEV) {
			holder.__editorView = {
				screenOf: ([x, y, z]) => {
					const rect = element.getBoundingClientRect();
					projected.set(x, y, z).project(camera);
					return {
						x: rect.left + ((projected.x + 1) / 2) * rect.width,
						y: rect.top + ((1 - projected.y) / 2) * rect.height,
					};
				},
				// The camera as it is now (target, angles, span, projection), glides included.
				pose: () => currentView.read?.() ?? null,
			};
		}
		return () => {
			window.removeEventListener("pointermove", onMove);
			pointerSpot.read = null;
			delete holder.__editorView;
		};
	}, [camera, element]);

	return null;
};
