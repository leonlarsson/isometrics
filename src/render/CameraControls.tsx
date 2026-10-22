import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { clamp } from "#/lib/math";

import { MAX_POLAR, MIN_POLAR, orbitAround, settleTarget } from "./orbit";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const anchor = new THREE.Vector3();
const hit = new THREE.Vector3();
const shift = new THREE.Vector3();
const pivot = new THREE.Vector3();

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

/**
 * Right-drag (or Ctrl/Shift + left-drag) orbits around the point under the
 * cursor, like Google Maps: an object if one is there, otherwise the ground.
 * OrbitControls can only orbit around its target, so the camera and target
 * are turned together around that point (render/orbit), then the target
 * slides along the line of sight back over the ground, which doesn't change
 * the view. Touch twist still uses OrbitControls (around the view's centre).
 */
const useOrbitAroundCursor = () => {
	const camera = useThree((s) => s.camera);
	const scene = useThree((s) => s.scene);
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);
	const controls = useThree((s) => s.controls) as unknown as IOrbitControls | null;

	useEffect(() => {
		if (!controls) {
			return;
		}
		let orbiting: { id: number; x: number; y: number } | null = null;

		/** What's under the pointer: the nearest visible mesh, else the ground. */
		const pivotAt = (event: PointerEvent) => {
			const rect = element.getBoundingClientRect();
			pointer.set(
				((event.clientX - rect.left) / rect.width) * 2 - 1,
				-((event.clientY - rect.top) / rect.height) * 2 + 1,
			);
			raycaster.setFromCamera(pointer, camera);
			const found = raycaster.intersectObjects(scene.children, true).find(
				(item) =>
					item.object instanceof THREE.Mesh &&
					item.object.visible &&
					// Not the gizmo's invisible grab areas.
					(item.object.material as THREE.Material).visible !== false,
			);
			if (found) {
				pivot.copy(found.point);
				return true;
			}
			return raycaster.ray.intersectPlane(groundPlane, pivot) !== null;
		};

		const onDown = (event: PointerEvent) => {
			const modified = event.ctrlKey || event.metaKey || event.shiftKey;
			const wants = event.button === 2 || (event.button === 0 && modified);
			if (!wants || !controls.enabled || useEditor.getState().placingKind || !pivotAt(event)) {
				return;
			}
			orbiting = { id: event.pointerId, x: event.clientX, y: event.clientY };
		};

		const onMove = (event: PointerEvent) => {
			if (event.pointerId !== orbiting?.id) {
				return;
			}
			const height = element.clientHeight || 1;
			const dx = event.clientX - orbiting.x;
			const dy = event.clientY - orbiting.y;
			orbiting.x = event.clientX;
			orbiting.y = event.clientY;
			// A drag across the canvas height turns the view once (as OrbitControls does); dragging
			// down tips it towards straight down.
			orbitAround(
				camera.position,
				controls.target,
				pivot,
				(-2 * Math.PI * dx) / height,
				(-2 * Math.PI * dy) / height,
			);
			settleTarget(camera.position, controls.target, useEditor.getState().scene.ground);
			controls.update();
		};

		const onUp = (event: PointerEvent) => {
			if (event.pointerId === orbiting?.id) {
				orbiting = null;
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
	}, [camera, scene, element, controls]);
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

/** Keep this much room (px) between a revealed selection and the edges of the visible area. */
const REVEAL_MARGIN = 48;

/**
 * When UI covers the bottom of the viewport (the narrow layout's sheet), render
 * the view shifted up by half that height, so the uncovered part acts as a full
 * viewport centred on the camera target. Eases in and out as the sheet moves.
 * Raycasts and label projection use the same projection, so they stay aligned.
 */
const useViewInset = () => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const offset = useRef(0);

	useFrame((_, delta) => {
		const goal = useEditor.getState().viewInset / 2;
		const lens =
			camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera
				? camera
				: null;
		const view = lens?.view ?? null;
		const current =
			view?.enabled && view.fullWidth === size.width && view.fullHeight === size.height;
		if (Math.abs(goal - offset.current) < 0.5 && (goal === 0 ? !view?.enabled : current)) {
			return;
		}
		offset.current += (goal - offset.current) * Math.min(1, delta * 10);
		if (Math.abs(goal - offset.current) < 0.5) {
			offset.current = goal;
		}
		if (!lens) {
			return;
		}
		if (offset.current === 0) {
			lens.clearViewOffset();
		} else {
			lens.setViewOffset(size.width, size.height, 0, offset.current, size.width, size.height);
		}
	});
};

/**
 * When the sheet covers the newly selected object, glide the camera so the
 * object is centred in the part of the scene that's still visible.
 */
const useRevealSelection = () => {
	const camera = useThree((s) => s.camera);
	const controls = useThree((s) => s.controls) as unknown as IOrbitControls | null;
	const size = useThree((s) => s.size);
	const selectedId = useEditor((s) => s.selectedId);
	const inset = useEditor((s) => s.viewInset);
	const remaining = useRef(new THREE.Vector3());

	useEffect(() => {
		const entity = useEditor.getState().scene.entities.find((e) => e.id === selectedId);
		if (!entity || inset === 0 || !controls) {
			return;
		}
		// Where the object will be once the view offset has settled: the target sits in the middle
		// of the visible area, and the orthographic view moves everything by the same offset.
		const object = new THREE.Vector3(entity.position[0], entity.elevation, entity.position[1]);
		const onScreen = object.clone().project(camera);
		const target = controls.target.clone().project(camera);
		const visible = size.height - inset;
		const x = size.width / 2 + ((onScreen.x - target.x) * size.width) / 2;
		const y = visible / 2 - ((onScreen.y - target.y) * size.height) / 2;
		const inView =
			x > REVEAL_MARGIN &&
			x < size.width - REVEAL_MARGIN &&
			y > REVEAL_MARGIN &&
			y < visible - REVEAL_MARGIN;
		if (!inView) {
			remaining.current.set(object.x - controls.target.x, 0, object.z - controls.target.z);
		}
	}, [selectedId, inset]);

	useFrame((_, delta) => {
		if (!controls || remaining.current.lengthSq() < 1e-6) {
			return;
		}
		const step = remaining.current.clone().multiplyScalar(Math.min(1, delta * 8));
		remaining.current.sub(step);
		camera.position.add(step);
		controls.target.add(step);
		controls.update();
	});
};

const CameraBehaviours = () => {
	useGroundPan();
	useOrbitAroundCursor();
	useKeepTargetOnGround();
	useViewInset();
	useRevealSelection();
	return null;
};

/**
 * Map-style camera: left-drag pans (grabbing the ground), right-drag or
 * Ctrl/Shift + left-drag orbits around the point under the cursor, the wheel
 * zooms towards the cursor. On touch, one finger pans and two pinch to zoom
 * and twist to orbit. See docs/adr/0028 and 0037.
 */
export const CameraControls = () => {
	return (
		<>
			<OrbitControls
				makeDefault
				enableDamping
				dampingFactor={0.12}
				minPolarAngle={MIN_POLAR}
				maxPolarAngle={MAX_POLAR}
				// Zoom limits: orthographic zoom for the diorama view, distance for perspective.
				minZoom={2}
				maxZoom={160}
				minDistance={2}
				maxDistance={400}
				zoomToCursor
				// Left-drag panning is useGroundPan's and orbiting is useOrbitAroundCursor's, so the mouse
				// only zooms here (wheel or middle button). Touch keeps OrbitControls' pan, pinch and twist.
				enablePan={false}
				mouseButtons={{
					LEFT: null as unknown as THREE.MOUSE,
					MIDDLE: THREE.MOUSE.DOLLY,
					RIGHT: null as unknown as THREE.MOUSE,
				}}
				touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
			/>

			<CameraBehaviours />
		</>
	);
};
