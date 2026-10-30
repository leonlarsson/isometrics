import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { SNAP_STEP, useEditor } from "#/editor/store";
import { clamp, snap } from "#/lib/math";
import { pastDragThreshold, setCursorHidden } from "#/lib/pointer";
import { cornerTop, groundHeightAt, isRaised } from "#/scene/areas";
import type { TArea, TVec2 } from "#/scene/schema";

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

/**
 * Where the ray meets the ground (or a raised plane at `planeY`), snapped to
 * the grid unless snapping is off or `altKey` is held, and kept on the ground.
 */
export const groundPointOnRay = (ray: THREE.Ray, altKey: boolean, planeY = 0): TVec2 | null => {
	plane.constant = -planeY;
	if (!ray.intersectPlane(plane, hit)) {
		return null;
	}
	const { snapping, scene } = useEditor.getState();
	const free = altKey || !snapping;
	const place = (v: number) => (free ? v : snap(v, SNAP_STEP));
	return [
		clamp(place(hit.x), -scene.ground.width / 2, scene.ground.width / 2),
		clamp(place(hit.z), -scene.ground.depth / 2, scene.ground.depth / 2),
	];
};

const start = new THREE.Vector3();
const end = new THREE.Vector3();
const before = new THREE.Vector3();
const along = new THREE.Vector3();
/** Steps down the ray between the highest and the lowest the ground goes, then halvings at the crossing. */
const MARCH_STEPS = 48;
const BISECTIONS = 10;

/**
 * Where the ray first meets the ground as it stands, on raised land and slopes
 * too (ADR-0098), or the surface `above` it (an object lifted or sunk that
 * much stays under the pointer): walked down the ray from the highest the
 * ground goes, then narrowed in where it crosses. Unsnapped; null when the
 * ray never comes down to it.
 */
export const surfaceHitOnRay = (
	ray: THREE.Ray,
	areas: readonly TArea[],
	above = 0,
): THREE.Vector3 | null => {
	const raised = areas.filter((area) => !area.isHidden && isRaised(area));
	const highest =
		above + Math.max(0, ...raised.flatMap((area) => area.points.map((p) => cornerTop(area, p))));
	plane.constant = -above;
	if (!ray.intersectPlane(plane, end)) {
		return null;
	}
	if (raised.length === 0) {
		return end.clone();
	}
	plane.constant = -highest;
	if (ray.origin.y <= highest || !ray.intersectPlane(plane, start)) {
		start.copy(ray.origin);
	}
	const surfaceAt = (point: THREE.Vector3) => above + groundHeightAt(raised, [point.x, point.z]);
	before.copy(start);
	for (let i = 1; i <= MARCH_STEPS; i++) {
		along.lerpVectors(start, end, i / MARCH_STEPS);
		if (along.y <= surfaceAt(along)) {
			// It crossed between the last step and this one: halve the gap to find where.
			const low = along.clone();
			const high = before.clone();
			for (let j = 0; j < BISECTIONS; j++) {
				const middle = low.clone().add(high).multiplyScalar(0.5);
				if (middle.y <= surfaceAt(middle)) {
					low.copy(middle);
				} else {
					high.copy(middle);
				}
			}
			return low;
		}
		before.copy(along);
	}
	return end.clone();
};

/**
 * The ground under the pointer as it stands (raised land and slopes), snapped
 * to the grid unless snapping is off or `altKey` is held, and kept on the
 * ground (ADR-0098).
 */
export const surfacePointOnRay = (ray: THREE.Ray, altKey: boolean, above = 0): TVec2 | null => {
	const { snapping, scene } = useEditor.getState();
	const found = surfaceHitOnRay(ray, scene.areas, above);
	if (!found) {
		return null;
	}
	const free = altKey || !snapping;
	const place = (v: number) => (free ? v : snap(v, SNAP_STEP));
	return [
		clamp(place(found.x), -scene.ground.width / 2, scene.ground.width / 2),
		clamp(place(found.z), -scene.ground.depth / 2, scene.ground.depth / 2),
	];
};

/**
 * Ground position under the pointer, snapped to the grid unless snapping is
 * off or Alt is held. `planeY` projects onto a raised plane instead, so an
 * elevated point stays under the cursor while it's dragged.
 */
export const groundPointFrom = (
	event: ThreeEvent<PointerEvent | MouseEvent>,
	planeY = 0,
): TVec2 | null => groundPointOnRay(event.ray, event.nativeEvent.altKey, planeY);

/**
 * The ground under the pointer as it stands, or the surface `above` it (a
 * fence point lifted that much, ADR-0103), snapped as `groundPointFrom` is.
 */
export const surfacePointFrom = (event: ThreeEvent<PointerEvent | MouseEvent>, above = 0) =>
	surfacePointOnRay(event.ray, event.nativeEvent.altKey, above);

interface IGroundDragOptions {
	/** Height of the plane to drag on (default: the ground). */
	planeY?: number;
	/**
	 * Called on pointer-down; return false to leave the press alone (no drag; it goes on to the
	 * camera, e.g. Shift/Ctrl to orbit). Receives the drag's coalesce key and the press.
	 */
	onStart?: (token: string, event: ThreeEvent<PointerEvent>) => boolean | undefined;
	/** Called with each new snapped ground point while dragging. */
	onMove: (point: TVec2, token: string) => void;
}

/**
 * Pointer handlers that drag something across the ground plane: captures the
 * pointer, pauses camera controls, hides the cursor (the dragged thing marks
 * the spot) and reports snapped ground points. Every move in one gesture
 * shares a coalesce token, so it undoes as one step.
 */
export const useGroundDrag = ({ planeY = 0, onStart, onMove }: IGroundDragOptions) => {
	const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
	const token = useRef<string | null>(null);
	const last = useRef<TVec2 | null>(null);
	// Where the press started; nothing moves until the pointer passes the drag threshold.
	const from = useRef<{ clientX: number; clientY: number } | null>(null);

	const end = (event: ThreeEvent<PointerEvent>) => {
		if (!token.current) {
			return;
		}
		token.current = null;
		last.current = null;
		from.current = null;
		setCursorHidden(false);
		(event.target as unknown as Element).releasePointerCapture?.(event.pointerId);
		if (controls) {
			controls.enabled = true;
		}
		useEditor.getState().setDragging(false);
	};

	return {
		onPointerDown: (event: ThreeEvent<PointerEvent>) => {
			if (event.nativeEvent.button !== 0) {
				return;
			}
			const next = `ground-drag:${performance.now()}`;
			if (onStart?.(next, event) === false) {
				return;
			}
			event.stopPropagation();
			token.current = next;
			from.current = { clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY };
			(event.target as unknown as Element).setPointerCapture(event.pointerId);
			if (controls) {
				controls.enabled = false;
			}
			useEditor.getState().setDragging(true);
		},
		onPointerMove: (event: ThreeEvent<PointerEvent>) => {
			if (!token.current) {
				return;
			}
			event.stopPropagation();
			if (from.current) {
				if (!pastDragThreshold(from.current, event.nativeEvent)) {
					return;
				}
				from.current = null;
				setCursorHidden(true);
			}
			const point = groundPointFrom(event, planeY);
			if (
				!point ||
				(last.current && last.current[0] === point[0] && last.current[1] === point[1])
			) {
				return;
			}
			last.current = point;
			onMove(point, token.current);
		},
		onPointerUp: end,
		onLostPointerCapture: end,
	};
};
