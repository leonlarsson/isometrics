import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { SNAP_STEP, useEditor } from "#/editor/store";
import { clamp, snap } from "#/lib/math";
import { pastDragThreshold, setCursorHidden } from "#/lib/pointer";
import { GROUND_SIZE } from "#/scene/groundShape";
import { groundTopsOf, keepInWorld, keepOnLand } from "#/scene/grounds";
import type { TVec2 } from "#/scene/schema";
import { areaTopsOf, type ITop } from "#/scene/standing";

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const level = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Where a ray meets the level plane at height `y`, as a point of its own; null when it never does. */
export const levelHitOnRay = (ray: THREE.Ray, y: number): THREE.Vector3 | null => {
	level.constant = -y;
	return ray.intersectPlane(level, new THREE.Vector3());
};

/**
 * What a point under the pointer is kept within (ADR-0155): `land`, a shown
 * ground (objects, roads, fences; anywhere in the world when the world lets
 * things go off the ground); `world`, the world's size (areas, which may lie
 * over empty space); `largest`, the largest a world can be (shaping a ground).
 */
export type TKeptWithin = "land" | "world" | "largest";

/** A point under the pointer, kept within what it may be in (`TKeptWithin`). */
export const keptWithin = (point: TVec2, within: TKeptWithin): TVec2 => {
	const { scene } = useEditor.getState();
	if (within === "land") {
		return keepOnLand(scene, point);
	}
	if (within === "world") {
		return keepInWorld(scene, point);
	}
	const half = GROUND_SIZE.most / 2;
	return [clamp(point[0], -half, half), clamp(point[1], -half, half)];
};

/**
 * Where the ray meets the ground (or a raised plane at `planeY`), snapped to
 * the grid unless snapping is off or `altKey` is held, and kept within `within`.
 */
export const groundPointOnRay = (
	ray: THREE.Ray,
	altKey: boolean,
	planeY = 0,
	within: TKeptWithin = "land",
): TVec2 | null => {
	plane.constant = -planeY;
	if (!ray.intersectPlane(plane, hit)) {
		return null;
	}
	const { snapping } = useEditor.getState();
	const free = altKey || !snapping;
	const place = (v: number) => (free ? v : snap(v, SNAP_STEP));
	return keptWithin([place(hit.x), place(hit.z)], within);
};

const end = new THREE.Vector3();
/** Steps along the ray over each top it passes, then halvings at the crossing. */
const MARCH_STEPS = 48;
const BISECTIONS = 10;
const at = new THREE.Vector3();

/**
 * Where on a ray (as a distance along it, between `from` and `to`) it first
 * comes down to a top lifted by `above`, or null when it passes over it.
 */
const firstCrossing = (ray: THREE.Ray, top: ITop, above: number, from: number, to: number) => {
	const isUnder = (t: number) => {
		ray.at(t, at);
		const altitude = top.altitudeAt(at.x, at.z);
		return altitude !== null && at.y <= altitude + above;
	};
	let before = from;
	for (let i = 0; i <= MARCH_STEPS; i++) {
		const t = from + ((to - from) * i) / MARCH_STEPS;
		if (isUnder(t)) {
			if (i === 0) {
				return t;
			}
			// It crossed between the last step and this one: halve the gap to find where.
			let low = t;
			let high = before;
			for (let j = 0; j < BISECTIONS; j++) {
				const middle = (low + high) / 2;
				if (isUnder(middle)) {
					low = middle;
				} else {
					high = middle;
				}
			}
			return low;
		}
		before = t;
	}
	return null;
};

/**
 * Along a ray, where it is over a top's box on the ground and between its
 * lowest and highest (lifted by `above`): [from, to] as distances along it, or null.
 */
const spanOver = (
	ray: THREE.Ray,
	top: ITop,
	above: number,
	end: number,
): [number, number] | null => {
	let from = 0;
	let to = end;
	const { origin, direction } = ray;
	const slabs: [number, number, number, number][] = [
		[origin.x, direction.x, top.minX, top.maxX],
		[origin.z, direction.z, top.minZ, top.maxZ],
		[origin.y, direction.y, above, top.highestAltitude + above],
	];
	for (const [start, along, low, high] of slabs) {
		if (Math.abs(along) < 1e-12) {
			if (start < low || start > high) {
				return null;
			}
			continue;
		}
		const a = (low - start) / along;
		const b = (high - start) / along;
		from = Math.max(from, Math.min(a, b));
		to = Math.min(to, Math.max(a, b));
	}
	return from <= to ? [from, to] : null;
};

/**
 * Where the ray first meets what things stand on (`tops`: raised land and
 * slopes, ADR-0098, and the tops of objects, ADR-0138), or the surface
 * `above` it (an object lifted or sunk that much stays under the pointer):
 * over each top the ray passes, walked along from where it comes over it,
 * then narrowed in where it crosses; the nearest wins. Unsnapped; null when
 * the ray never comes down to the base ground.
 */
export const surfaceHitOnRay = (
	ray: THREE.Ray,
	tops: readonly ITop[],
	above = 0,
): THREE.Vector3 | null => {
	plane.constant = -above;
	if (!ray.intersectPlane(plane, end)) {
		return null;
	}
	// The ray's directions may not be of length 1: distances along it are in its own steps.
	const base = (above - ray.origin.y) / ray.direction.y;
	let nearest = base;
	for (const top of tops) {
		const span = spanOver(ray, top, above, nearest);
		const crossing = span && firstCrossing(ray, top, above, span[0], span[1]);
		if (crossing !== null && crossing < nearest) {
			nearest = crossing;
		}
	}
	return nearest === base ? end.clone() : ray.at(nearest, new THREE.Vector3());
};

/**
 * The ground under the pointer as it stands (raised land and slopes, or what
 * `tops` says things stand on there: the tops of shapes too, ADR-0138),
 * snapped to the grid unless snapping is off or `altKey` is held, and kept on
 * the ground (ADR-0098).
 */
export const surfacePointOnRay = (
	ray: THREE.Ray,
	altKey: boolean,
	above = 0,
	tops?: readonly ITop[],
	within: TKeptWithin = "land",
): TVec2 | null => {
	const { snapping, scene } = useEditor.getState();
	const found = surfaceHitOnRay(
		ray,
		tops ?? [...groundTopsOf(scene.grounds), ...areaTopsOf(scene.areas, scene.grounds)],
		above,
	);
	if (!found) {
		return null;
	}
	const free = altKey || !snapping;
	const place = (v: number) => (free ? v : snap(v, SNAP_STEP));
	// On a ground as it's shaped (ADR-0155), not over empty space beside it.
	return keptWithin([place(found.x), place(found.z)], within);
};

/**
 * Ground position under the pointer, snapped to the grid unless snapping is
 * off or Alt is held. `planeY` projects onto a raised plane instead, so an
 * elevated point stays under the cursor while it's dragged.
 */
export const groundPointFrom = (
	event: ThreeEvent<PointerEvent | MouseEvent>,
	planeY = 0,
	within: TKeptWithin = "land",
): TVec2 | null => groundPointOnRay(event.ray, event.nativeEvent.altKey, planeY, within);

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
	/**
	 * Called with each new snapped ground point while dragging (unsnapped with `snapsToGrid` off: the
	 * pointer's own spot, for a drag that snaps its own way), and the move.
	 */
	onMove: (point: TVec2, token: string, event: ThreeEvent<PointerEvent>) => void;
	/** Whether the points it reports land on the grid (the default) as the snapping says. */
	snapsToGrid?: boolean;
	/** What its points are kept within (`TKeptWithin`): a ground by default. */
	within?: TKeptWithin;
}

/**
 * Pointer handlers that drag something across the ground plane: captures the
 * pointer, pauses camera controls, hides the cursor (the dragged thing marks
 * the spot) and reports snapped ground points. Every move in one gesture
 * shares a coalesce token, so it undoes as one step.
 */
export const useGroundDrag = ({
	planeY = 0,
	onStart,
	onMove,
	snapsToGrid = true,
	within = "land",
}: IGroundDragOptions) => {
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
			const point = groundPointOnRay(
				event.ray,
				!snapsToGrid || event.nativeEvent.altKey,
				planeY,
				within,
			);
			if (
				!point ||
				(last.current && last.current[0] === point[0] && last.current[1] === point[1])
			) {
				return;
			}
			last.current = point;
			onMove(point, token.current, event);
		},
		onPointerUp: end,
		onLostPointerCapture: end,
	};
};
