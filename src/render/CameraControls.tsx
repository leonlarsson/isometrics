import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { clamp } from "#/lib/math";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const anchor = new THREE.Vector3();
const hit = new THREE.Vector3();
const shift = new THREE.Vector3();

interface IOrbitControls {
	enabled: boolean;
	target: THREE.Vector3;
	update: () => void;
	addEventListener: (type: "change", listener: () => void) => void;
	removeEventListener: (type: "change", listener: () => void) => void;
}

/**
 * Left-drag on empty space grabs the ground and slides it, so the spot under
 * the cursor stays under the cursor (OrbitControls' own pan drifts on a tilted
 * view). Objects and handles claim their presses first by disabling the
 * controls, so this only runs when nothing else took the press.
 */
const useGroundPan = () => {
	const camera = useThree((s) => s.camera);
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);
	const controls = useThree((s) => s.controls) as unknown as IOrbitControls | null;

	useEffect(() => {
		if (!controls) {
			return;
		}
		let panning: number | null = null;
		const pointers = new Set<number>();

		const groundHit = (event: PointerEvent, out: THREE.Vector3) => {
			const rect = element.getBoundingClientRect();
			pointer.set(
				((event.clientX - rect.left) / rect.width) * 2 - 1,
				-((event.clientY - rect.top) / rect.height) * 2 + 1,
			);
			raycaster.setFromCamera(pointer, camera);
			return raycaster.ray.intersectPlane(groundPlane, out) !== null;
		};

		const onDown = (event: PointerEvent) => {
			pointers.add(event.pointerId);
			// A second finger hands over to OrbitControls' pinch and twist.
			if (pointers.size > 1) {
				panning = null;
				return;
			}
			const plain = !(event.ctrlKey || event.metaKey || event.shiftKey);
			if (event.button !== 0 || !plain || !controls.enabled || useEditor.getState().placingKind) {
				return;
			}
			if (groundHit(event, anchor)) {
				panning = event.pointerId;
			}
		};

		const onMove = (event: PointerEvent) => {
			if (event.pointerId !== panning || !groundHit(event, hit)) {
				return;
			}
			shift.subVectors(anchor, hit);
			camera.position.add(shift);
			controls.target.add(shift);
			camera.updateMatrixWorld();
			controls.update();
		};

		const onUp = (event: PointerEvent) => {
			pointers.delete(event.pointerId);
			if (event.pointerId === panning) {
				panning = null;
			}
		};

		element.addEventListener("pointerdown", onDown);
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		return () => {
			element.removeEventListener("pointerdown", onDown);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
		};
	}, [camera, element, controls]);
};

/** Keep the view's centre over the ground, so panning or zooming can't lose the world. */
const useKeepTargetOnGround = () => {
	const camera = useThree((s) => s.camera);
	const controls = useThree((s) => s.controls) as unknown as IOrbitControls | null;
	const ground = useEditor((s) => s.scene.ground);

	useEffect(() => {
		if (!controls) {
			return;
		}
		const onChange = () => {
			const { target } = controls;
			const x = clamp(target.x, -ground.width / 2, ground.width / 2);
			const z = clamp(target.z, -ground.depth / 2, ground.depth / 2);
			if (x === target.x && z === target.z) {
				return;
			}
			shift.set(x - target.x, 0, z - target.z);
			target.add(shift);
			camera.position.add(shift);
		};
		controls.addEventListener("change", onChange);
		return () => controls.removeEventListener("change", onChange);
	}, [camera, controls, ground.width, ground.depth]);
};

const GroundPan = () => {
	useGroundPan();
	useKeepTargetOnGround();
	return null;
};

/**
 * Map-style camera: left-drag pans (grabbing the ground), right-drag or
 * Ctrl/Shift + left-drag orbits, the wheel zooms towards the cursor. On touch,
 * one finger pans and two pinch to zoom and twist to orbit.
 */
export const CameraControls = () => {
	return (
		<>
			<OrbitControls
				makeDefault
				enableDamping
				dampingFactor={0.12}
				minPolarAngle={0.25}
				maxPolarAngle={1.2}
				minZoom={2}
				maxZoom={160}
				zoomToCursor
				// Plain left-drag panning is GroundPan's; with Ctrl/Shift held, OrbitControls turns
				// its left-button "pan" into an orbit, which is the one we want.
				enablePan={false}
				mouseButtons={{
					LEFT: THREE.MOUSE.PAN,
					MIDDLE: THREE.MOUSE.DOLLY,
					RIGHT: THREE.MOUSE.ROTATE,
				}}
				touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
			/>

			<GroundPan />
		</>
	);
};
