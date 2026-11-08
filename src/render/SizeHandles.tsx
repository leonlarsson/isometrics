import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { clamp, round, snap } from "#/lib/math";
import { pastDragThreshold } from "#/lib/pointer";
import type { TAnyPart } from "#/parts/registry";
import type { TEntity, TScene } from "#/scene/schema";

import { pixelsPerUnitAt } from "./cameraMath";
import { shiftDragMovesView } from "./dragKeys";
import { GizmoMaterial, Handle, HitMaterial, RENDER_ORDER, UNIT_PX } from "./TransformGizmo";

/**
 * Handles on the sides, the top and the bottom of the selected object, for
 * parts that say which of their props size them along each axis (`sizeAlong`,
 * ADR-0124): dragging one moves that side out or in, the opposite side
 * staying where it is, like pulling a face in a 3D tool; the bottom's lifts or
 * lowers the base under a top that stays (ADR-0138). Sizes snap to their
 * field's step (Alt, or snapping off, sizes freely). Drawn inside the
 * object's own turned and scaled group, so they sit on its sides however it's
 * turned or tipped.
 */

type TAxis = "x" | "y" | "z";

/** The sides that have handles: each way along X and Z, the top and the bottom. */
const SIDES: readonly { axis: TAxis; sign: 1 | -1 }[] = [
	{ axis: "x", sign: 1 },
	{ axis: "x", sign: -1 },
	{ axis: "z", sign: 1 },
	{ axis: "z", sign: -1 },
	{ axis: "y", sign: 1 },
	{ axis: "y", sign: -1 },
];

/**
 * How far out from its side a handle stands, and its size, in gizmo units (the same on screen):
 * a ball in its axis's colour, like the move arrows, told from the gizmo's cube that resizes the
 * whole object by its shape as well as its colour (ADR-0089).
 */
export const STAND_OFF = 0.3;
/**
 * The bottom's handle stands further off: the transform gizmo stands on the
 * object's base too, its square just in front of it (ADR-0138).
 */
const STAND_OFF_BELOW = 0.6;
export const BALL_RADIUS = 0.1;
export const HIT = 0.34;

interface ISession {
	token: string;
	from: { clientX: number; clientY: number };
	started: boolean;
	/** The side's outward direction and its middle, in the world, when the drag began. */
	direction: THREE.Vector3;
	origin: THREE.Vector3;
	/** Where along that line the pointer was when the drag really started. */
	anchor: number;
	start: { size: number; position: [number, number]; altitude: number };
	before: TScene;
}

/** How far along a line (from `origin`, unit `direction`) the point nearest the pointer's ray is. */
export const alongLine = (ray: THREE.Ray, origin: THREE.Vector3, direction: THREE.Vector3) => {
	const w0 = origin.clone().sub(ray.origin);
	const b = direction.dot(ray.direction);
	const d = direction.dot(w0);
	const e = ray.direction.dot(w0);
	const denominator = 1 - b * b;
	// The side points straight at the viewer: nothing to measure along.
	return Math.abs(denominator) < 1e-4 ? null : (b * e - d) / denominator;
};

const worldScale = new THREE.Vector3();
const worldPosition = new THREE.Vector3();
const worldTurn = new THREE.Quaternion();

/** One side's handle, kept the same size on screen. */
const SideHandle = ({
	entity,
	part,
	axis,
	sign,
	prop,
	value,
	position,
}: {
	entity: TEntity;
	part: TAnyPart;
	axis: TAxis;
	sign: 1 | -1;
	prop: string;
	/** The size it has now. */
	value: number;
	/** Its side's middle, in the part's own space. */
	position: [number, number, number];
}) => {
	const colors = usePalette().gizmo;
	const camera = useThree((s) => s.camera);
	const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
	const root = useRef<THREE.Group>(null);
	const knob = useRef<THREE.Group>(null);
	const session = useRef<ISession | null>(null);
	const [active, setActive] = useState(false);
	const outward = new THREE.Vector3(
		axis === "x" ? sign : 0,
		axis === "y" ? sign : 0,
		axis === "z" ? sign : 0,
	);

	// The same size on screen at any zoom, standing a little off its side, whatever the object's scale.
	useFrame(({ size }) => {
		if (!root.current || !knob.current) {
			return;
		}
		root.current.getWorldPosition(worldPosition);
		root.current.getWorldScale(worldScale);
		const unit = UNIT_PX / pixelsPerUnitAt(camera, worldPosition, size.height) / worldScale.x;
		knob.current.scale.setScalar(unit);
		const standOff = axis === "y" && sign < 0 ? STAND_OFF_BELOW : STAND_OFF;
		knob.current.position.copy(outward).multiplyScalar(standOff * unit);
	});

	const finish = (target: EventTarget | null, pointerId?: number) => {
		if (!session.current) {
			return;
		}
		session.current = null;
		setActive(false);
		if (pointerId !== undefined) {
			(target as Element | null)?.releasePointerCapture?.(pointerId);
		}
		if (controls) {
			controls.enabled = true;
		}
		const store = useEditor.getState();
		store.setDragging(false);
		store.setCancelGesture(null);
	};

	const cancel = () => {
		const current = session.current;
		if (current) {
			useEditor.getState().revertTo(current.before);
			finish(null);
		}
	};

	useEffect(() => () => finish(null), []);

	const field = part.fields.find((spec) => spec.key === prop);
	const range = field?.type === "number" ? field : null;

	const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
		// With Shift the press moves the view (pans or orbits), over the handle too (ADR-0156).
		if (
			e.nativeEvent.button !== 0 ||
			!root.current ||
			!range ||
			shiftDragMovesView(e.nativeEvent)
		) {
			return;
		}
		e.stopPropagation();
		const origin = root.current.getWorldPosition(new THREE.Vector3());
		root.current.getWorldQuaternion(worldTurn);
		const store = useEditor.getState();
		session.current = {
			token: `size:${entity.id}:${prop}:${performance.now()}`,
			from: { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY },
			started: false,
			direction: outward.clone().applyQuaternion(worldTurn).normalize(),
			origin,
			anchor: 0,
			start: { size: value, position: entity.position, altitude: entity.altitude },
			before: store.scene,
		};
		setActive(true);
		(e.target as unknown as Element).setPointerCapture(e.pointerId);
		if (controls) {
			controls.enabled = false;
		}
		store.setDragging(true);
		store.setCancelGesture(cancel);
	};

	const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
		const current = session.current;
		if (!current || !range) {
			return;
		}
		e.stopPropagation();
		const along = alongLine(e.ray, current.origin, current.direction);
		if (along === null) {
			return;
		}
		if (!current.started) {
			if (!pastDragThreshold(current.from, e.nativeEvent)) {
				return;
			}
			// Measured from here, so the distance already covered doesn't make the side jump.
			current.started = true;
			current.anchor = along;
			return;
		}
		const store = useEditor.getState();
		const scale = entity.scale;
		const free = e.nativeEvent.altKey || !store.snapping;
		const wanted = current.start.size + (along - current.anchor) / scale;
		const size = clamp(free ? wanted : snap(wanted, range.step), range.min, range.max);
		// The opposite side stays: the middle moves half the change, out along this side. The top
		// grows from the base, which is where the object stands, so nothing moves; the bottom moves
		// the base the whole change, under the top (ADR-0138).
		const moves = axis !== "y" ? 0.5 : sign < 0 ? 1 : 0;
		const shift = current.direction
			.clone()
			.multiplyScalar((size - current.start.size) * scale * moves);
		store.updateEntity(
			entity.id,
			(draft) => {
				draft.props[prop] = round(size);
				draft.position = [
					round(current.start.position[0] + shift.x),
					round(current.start.position[1] + shift.z),
				];
				draft.altitude = round(current.start.altitude + shift.y);
			},
			{ coalesce: current.token, gesture: true },
		);
	};

	return (
		<group ref={root} position={position}>
			<Handle
				color={colors[axis]}
				hoverColor={colors.hover}
				active={active}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={(e) => {
					if (session.current) {
						e.stopPropagation();
					}
					finish(e.target, e.pointerId);
				}}
				onLostPointerCapture={(e) => finish(e.target)}
				onContextMenu={(e) => {
					if (session.current) {
						e.stopPropagation();
						e.nativeEvent.preventDefault();
						cancel();
					}
				}}
				onClick={(e) => e.stopPropagation()}
				hitArea={null}
			>
				{(color) => (
					<group ref={knob} name={`size handle ${sign > 0 ? "+" : "−"}${axis}`}>
						<mesh renderOrder={RENDER_ORDER}>
							<sphereGeometry args={[BALL_RADIUS, 16, 12]} />

							<GizmoMaterial color={color} />
						</mesh>

						<mesh>
							<boxGeometry args={[HIT, HIT, HIT]} />

							<HitMaterial />
						</mesh>
					</group>
				)}
			</Handle>
		</group>
	);
};

/** The selected object's size handles, one on each side its part sizes (and not while data sizes it). */
export const SizeHandles = ({
	entity,
	part,
	props,
}: {
	entity: TEntity;
	part: TAnyPart;
	/** Its props as drawn. */
	props: Record<string, unknown>;
}) => {
	const sizeAlong = part.sizeAlong;
	if (!sizeAlong) {
		return null;
	}
	const [width, depth] = part.footprint(props);
	const height = part.height(props);
	return (
		<>
			{SIDES.map(({ axis, sign }) => {
				const prop = sizeAlong[axis];
				// A size that follows data is drawn as the data says: dragging it would do nothing.
				if (!prop || Object.hasOwn(entity.data, prop)) {
					return null;
				}
				const position: [number, number, number] =
					axis === "x"
						? [(sign * width) / 2, height / 2, 0]
						: axis === "z"
							? [0, height / 2, (sign * depth) / 2]
							: [0, sign > 0 ? height : 0, 0];
				return (
					<SideHandle
						key={`${axis}${sign}`}
						entity={entity}
						part={part}
						axis={axis}
						sign={sign}
						prop={prop}
						value={Number(props[prop])}
						position={position}
					/>
				);
			})}
		</>
	);
};
