import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import { pointerSpot } from "#/editor/pointerSpot";
import { useEditor } from "#/editor/store";
import { roadOfVehicleNow } from "#/editor/vehiclesNow";
import { isOverWorld } from "#/lib/pointer";
import type { TViewPose } from "#/scene/schema";

import { drawCallsPerFrame } from "./drawCalls";
import { FREE_TILT, orbitAround } from "./orbit";
import { routesShown } from "./RouteHighlight";
import { livePoses } from "./routeDrop";
import { currentView } from "./viewpoints";

const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();
const projected = new THREE.Vector3();
const pivot = new THREE.Vector3();

/**
 * Keeps track of the mouse pointer over the view, so editor/pointerSpot can
 * say where on the ground it is (Ctrl+V pastes there). Over a label card
 * counts as over the world; over a panel or a bar doesn't.
 */
export const PointerSpot = () => {
	const camera = useThree((s) => s.camera);
	const gl = useThree((s) => s.gl);
	const getThree = useThree((s) => s.get);
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
			if (!isOverWorld(element, under)) {
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
		// to click handles and objects exactly, where the camera is (e2e/, ADR-0069), and how many
		// draw calls a frame takes (PERFORMANCE.md).
		const holder = globalThis as {
			__editorView?: {
				screenOf: (point: [number, number, number]) => { x: number; y: number };
				pose: () => TViewPose | null;
				drawCalls: (frames?: number) => Promise<number>;
				roadOfVehicle: (entityId: string) => { roadId: string; drivesTheOtherWay: boolean } | null;
				routesShown: () => Record<string, string[]>;
				poseOf: (entityId: string) => { position: [number, number] } | null;
				orbitStep: (degrees: number) => void;
			};
		};
		// Also in a build for measuring (VITE_BENCH=1, editor/store).
		if (import.meta.env.DEV || import.meta.env.VITE_BENCH === "1") {
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
				// Draw calls per frame, every pass's, averaged over some frames.
				drawCalls: (frames) => drawCallsPerFrame(gl.getContext() as WebGL2RenderingContext, frames),
				// The road a vehicle is on now, as the route highlight marks it (ADR-0136).
				roadOfVehicle: (entityId) => {
					const entity = useEditor.getState().scene.entities.find((e) => e.id === entityId);
					return entity ? roadOfVehicleNow(entity) : null;
				},
				// The roads each way ahead the route highlight shows goes along, by vehicle id.
				routesShown: () => Object.fromEntries(routesShown),
				// Where a driving vehicle is drawn now.
				poseOf: (entityId) => livePoses.get(entityId)?.() ?? null,
				// Turn the camera round the view's centre, as the turntable does (scripts/bench.mjs).
				orbitStep: (degrees) => {
					const orbit = getThree().controls as unknown as {
						target: THREE.Vector3;
						update: () => void;
					} | null;
					if (!orbit) {
						return;
					}
					pivot.copy(orbit.target);
					orbitAround(
						camera.position,
						orbit.target,
						pivot,
						-THREE.MathUtils.degToRad(degrees),
						0,
						FREE_TILT,
					);
					camera.updateMatrixWorld();
					orbit.update();
				},
			};
		}
		return () => {
			window.removeEventListener("pointermove", onMove);
			pointerSpot.read = null;
			delete holder.__editorView;
		};
	}, [camera, element, gl, getThree]);

	return null;
};
