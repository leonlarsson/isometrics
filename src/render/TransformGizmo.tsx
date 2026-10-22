import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { pastDragThreshold } from "#/lib/pointer";
import type { TScene, TVec2 } from "#/scene/schema";

import { gizmoArea } from "./labelRegistry";

/** The handles a gizmo can show. `xz` is the square that slides freely on the ground. */
export type TGizmoHandle = "x" | "z" | "xz" | "y" | "rotate" | "scale";

/** One step of a gizmo drag, measured from where the drag started. */
export interface IGizmoDrag {
	handle: TGizmoHandle;
	/** Ground offset [x, z] (move handles; the other axis stays 0 on an axis arrow). */
	offset: TVec2;
	/** Height change in world units (the up arrow). */
	lift: number;
	/** Turn around the vertical axis in degrees, counter-clockwise seen from above (the ring). */
	turn: number;
	/** Size factor relative to the start (the size handle). */
	ratio: number;
	/** Alt held: place freely, without snapping. */
	free: boolean;
	/** Coalesce key shared by every step of this drag. */
	token: string;
	/** The pointer, for drags with the mouse (keyboard transforms have none). */
	pointer?: { ray: THREE.Ray; altKey: boolean };
}

interface ITransformGizmoProps {
	handles: TGizmoHandle[];
	/**
	 * Called once when a drag really starts (past the drag threshold): snapshot the start values.
	 * Gets the drag's coalesce key, for changes that belong to the same undo step, and the handle.
	 */
	onStart: (token: string, handle: TGizmoHandle) => void;
	onDrag: (drag: IGizmoDrag) => void;
	/** Called when a started drag ends: `completed` false when it was cancelled. */
	onEnd?: (completed: boolean, token: string) => void;
}

/** Gizmo size on screen: one gizmo unit is this many pixels at any zoom. */
const UNIT_PX = 64;
const RING_RADIUS = 1.35;
const SCALE_DISTANCE = 1.8;
const RENDER_ORDER = 1000;

/** The gizmo's extent around its centre, in gizmo units (for keeping label cards off it). */
const EXTENT = { side: 1.6, up: 1.3, down: 2.0 };

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const center = new THREE.Vector3();
const hit = new THREE.Vector3();
const up = new THREE.Vector3();

/** Mark the gizmo's meshes so the scene's event filter puts them first (see GizmoFirst). */
const GIZMO_USER_DATA = { gizmo: true };

const isGizmoObject = (object: THREE.Object3D | null): boolean => {
	for (let current = object; current; current = current.parent) {
		if (current.userData.gizmo) {
			return true;
		}
	}
	return false;
};

/**
 * Gizmo handles are drawn on top of everything, but pointer events go to the
 * nearest surface: an arrow inside a building would lose to the building.
 * This puts gizmo hits ahead of everything else. Mount once inside the Canvas.
 */
export const GizmoFirst = () => {
	const setEvents = useThree((s) => s.setEvents);
	useEffect(() => {
		setEvents({
			filter: (items) => [
				...items.filter((item) => isGizmoObject(item.object)),
				...items.filter((item) => !isGizmoObject(item.object)),
			],
		});
	}, [setEvents]);
	return null;
};

interface IDragSession {
	handle: TGizmoHandle;
	token: string;
	from: { clientX: number; clientY: number };
	started: boolean;
	center: THREE.Vector3;
	anchor: THREE.Vector3;
	startY: number;
	pixelsPerUnit: number;
	/** Ring: the last pointer angle, and the turn accumulated so far (degrees). */
	angle: number;
	turn: number;
	/** The scene before the drag, for cancelling. */
	before: TScene;
}

const angleOf = (point: THREE.Vector3, center: THREE.Vector3) =>
	(Math.atan2(-(point.z - center.z), point.x - center.x) * 180) / Math.PI;

/** Wrap an angle difference into (-180, 180]. */
const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;

interface IHandleEvents {
	onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
	onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
	onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
	onLostPointerCapture: (e: ThreeEvent<PointerEvent>) => void;
	onContextMenu: (e: ThreeEvent<MouseEvent>) => void;
	onClick: (e: ThreeEvent<MouseEvent>) => void;
}

interface IHandleProps extends IHandleEvents {
	color: string;
	hoverColor: string;
	active: boolean;
	/** The visible parts, drawn in the given colour (brighter while hovered or dragged). */
	children: (color: string) => ReactNode;
	/** An invisible, larger shape that catches the pointer. */
	hitArea: ReactNode;
}

/** One grabbable part of the gizmo. Its group takes the pointer capture, so it gets the whole drag. */
const Handle = ({ color, hoverColor, active, children, hitArea, ...events }: IHandleProps) => {
	const [hovered, setHovered] = useState(false);
	const shown = hovered || active ? hoverColor : color;
	return (
		<group
			userData={GIZMO_USER_DATA}
			onPointerOver={(e: ThreeEvent<PointerEvent>) => {
				e.stopPropagation();
				setHovered(true);
				document.body.style.cursor = "grab";
			}}
			onPointerOut={() => {
				setHovered(false);
				document.body.style.cursor = "";
			}}
			{...events}
		>
			{children(shown)}

			{hitArea}
		</group>
	);
};

/** Material for visible gizmo parts: always on top, unlit. */
const GizmoMaterial = ({ color, opacity = 1 }: { color: string; opacity?: number }) => {
	return (
		<meshBasicMaterial
			color={color}
			depthTest={false}
			depthWrite={false}
			transparent
			opacity={opacity}
			toneMapped={false}
		/>
	);
};

/** Invisible, generous hit area so thin handles are easy to grab. */
const HitMaterial = () => {
	return <meshBasicMaterial visible={false} />;
};

const Arrow = ({ color, direction }: { color: string; direction: "x" | "y" | "z" }) => {
	// Cylinders point along +Y; turn them onto the axis.
	const rotation: [number, number, number] =
		direction === "x" ? [0, 0, -Math.PI / 2] : direction === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
	return (
		<group rotation={rotation}>
			<mesh position={[0, 0.55, 0]} renderOrder={RENDER_ORDER}>
				<cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />

				<GizmoMaterial color={color} />
			</mesh>

			<mesh position={[0, 1, 0]} renderOrder={RENDER_ORDER}>
				<coneGeometry args={[0.1, 0.24, 16]} />

				<GizmoMaterial color={color} />
			</mesh>
		</group>
	);
};

const ArrowHit = ({ direction }: { direction: "x" | "y" | "z" }) => {
	const rotation: [number, number, number] =
		direction === "x" ? [0, 0, -Math.PI / 2] : direction === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
	return (
		<mesh rotation={rotation} position={[0, 0, 0]}>
			<cylinderGeometry args={[0.16, 0.16, 1.0, 8, 1, false]} />

			<HitMaterial />
		</mesh>
	);
};

/**
 * A transform gizmo at the parent's origin, aligned with the world axes and the
 * same size on screen at any zoom: arrows move along X (red), Z (blue) and up
 * (green), the square slides on the ground, the ring turns around the vertical
 * axis and the knob outside it resizes. It reports raw offsets; the owner snaps
 * and commits them (with `{ coalesce: token, gesture: true }`). Esc or a right
 * click during a drag cancels it.
 */
export const TransformGizmo = ({ handles, onStart, onDrag, onEnd }: ITransformGizmoProps) => {
	const palette = usePalette();
	const colors = palette.gizmo;
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
	const root = useRef<THREE.Group>(null);
	const session = useRef<IDragSession | null>(null);
	const [active, setActive] = useState<TGizmoHandle | null>(null);

	// Same size on screen at any zoom: r3f's orthographic zoom is pixels per world unit. Also tell
	// the label layer where the gizmo is on screen.
	useFrame(() => {
		if (!root.current) {
			return;
		}
		root.current.scale.setScalar(UNIT_PX / (camera.zoom || 1));
		root.current.getWorldPosition(center).project(camera);
		const x = ((center.x + 1) / 2) * size.width;
		const y = ((1 - center.y) / 2) * size.height;
		gizmoArea.active = true;
		gizmoArea.left = x - EXTENT.side * UNIT_PX;
		gizmoArea.right = x + EXTENT.side * UNIT_PX;
		gizmoArea.top = y - EXTENT.up * UNIT_PX;
		gizmoArea.bottom = y + EXTENT.down * UNIT_PX * 0.6;
	});
	useEffect(
		() => () => {
			gizmoArea.active = false;
		},
		[],
	);

	const finish = (target: EventTarget | null, pointerId?: number, completed = false) => {
		const current = session.current;
		if (!current) {
			return;
		}
		session.current = null;
		setActive(null);
		if (pointerId !== undefined) {
			(target as Element | null)?.releasePointerCapture?.(pointerId);
		}
		if (controls) {
			controls.enabled = true;
		}
		const store = useEditor.getState();
		store.setDragging(false);
		store.setCancelGesture(null);
		if (current.started) {
			onEnd?.(completed, current.token);
		}
	};

	const cancel = () => {
		const current = session.current;
		if (!current) {
			return;
		}
		useEditor.getState().revertTo(current.before);
		finish(null);
	};

	const groundHit = (e: ThreeEvent<PointerEvent>, y: number) => {
		plane.constant = -y;
		return e.ray.intersectPlane(plane, hit) ? hit.clone() : null;
	};

	const start = (handle: TGizmoHandle) => (e: ThreeEvent<PointerEvent>) => {
		if (e.nativeEvent.button !== 0 || !root.current) {
			return;
		}
		e.stopPropagation();
		const center = root.current.getWorldPosition(new THREE.Vector3());
		// Screen pixels per world unit straight up, for the up arrow.
		up.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
		session.current = {
			handle,
			token: `gizmo:${handle}:${performance.now()}`,
			from: { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY },
			started: false,
			center,
			anchor: center.clone(),
			startY: e.nativeEvent.clientY,
			pixelsPerUnit: Math.max(1, up.y * camera.zoom),
			angle: 0,
			turn: 0,
			before: useEditor.getState().scene,
		};
		setActive(handle);
		(e.target as unknown as Element).setPointerCapture(e.pointerId);
		if (controls) {
			controls.enabled = false;
		}
		const store = useEditor.getState();
		store.setDragging(true);
		store.setCancelGesture(cancel);
	};

	const move = (e: ThreeEvent<PointerEvent>) => {
		const current = session.current;
		if (!current) {
			return;
		}
		e.stopPropagation();
		if (!current.started) {
			if (!pastDragThreshold(current.from, e.nativeEvent)) {
				return;
			}
			// Measure from here, so the distance already covered doesn't make the target jump.
			const anchor = groundHit(e, current.center.y);
			if (!anchor) {
				return;
			}
			current.started = true;
			current.anchor = anchor;
			current.startY = e.nativeEvent.clientY;
			current.angle = angleOf(anchor, current.center);
			current.before = useEditor.getState().scene;
			onStart(current.token, current.handle);
			return;
		}
		const point = groundHit(e, current.center.y);
		if (!point) {
			return;
		}
		const dx = point.x - current.anchor.x;
		const dz = point.z - current.anchor.z;
		const { handle } = current;
		const angle = angleOf(point, current.center);
		current.turn += wrap(angle - current.angle);
		current.angle = angle;
		const startDistance = Math.hypot(
			current.anchor.x - current.center.x,
			current.anchor.z - current.center.z,
		);
		const distance = Math.hypot(point.x - current.center.x, point.z - current.center.z);
		onDrag({
			handle,
			offset: handle === "x" ? [dx, 0] : handle === "z" ? [0, dz] : [dx, dz],
			lift: (current.startY - e.nativeEvent.clientY) / current.pixelsPerUnit,
			turn: current.turn,
			ratio: startDistance > 1e-6 ? distance / startDistance : 1,
			free: e.nativeEvent.altKey || !useEditor.getState().snapping,
			token: current.token,
			pointer: { ray: e.ray, altKey: e.nativeEvent.altKey },
		});
	};

	const dragEvents = {
		onPointerMove: move,
		onPointerUp: (e: ThreeEvent<PointerEvent>) => {
			if (session.current) {
				e.stopPropagation();
			}
			finish(e.target, e.pointerId, true);
		},
		onLostPointerCapture: (e: ThreeEvent<PointerEvent>) => finish(e.target, undefined, true),
		onContextMenu: (e: ThreeEvent<MouseEvent>) => {
			if (session.current) {
				e.stopPropagation();
				e.nativeEvent.preventDefault();
				cancel();
			}
		},
		onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
	};

	// Release everything if the gizmo goes away mid-drag (e.g. the object was deleted).
	useEffect(() => () => finish(null), []);

	const has = (handle: TGizmoHandle) => handles.includes(handle);
	const handleProps = (handle: TGizmoHandle) => ({
		...dragEvents,
		active: active === handle,
		hoverColor: colors.hover,
		onPointerDown: start(handle),
	});
	const diagonal = SCALE_DISTANCE / Math.SQRT2;

	return (
		<group ref={root}>
			{has("x") && (
				<Handle
					{...handleProps("x")}
					color={colors.x}
					hitArea={
						<group position={[0.6, 0, 0]}>
							<ArrowHit direction="x" />
						</group>
					}
				>
					{(color) => <Arrow color={color} direction="x" />}
				</Handle>
			)}

			{has("z") && (
				<Handle
					{...handleProps("z")}
					color={colors.z}
					hitArea={
						<group position={[0, 0, 0.6]}>
							<ArrowHit direction="z" />
						</group>
					}
				>
					{(color) => <Arrow color={color} direction="z" />}
				</Handle>
			)}

			{has("y") && (
				<Handle
					{...handleProps("y")}
					color={colors.y}
					hitArea={
						<group position={[0, 0.6, 0]}>
							<ArrowHit direction="y" />
						</group>
					}
				>
					{(color) => <Arrow color={color} direction="y" />}
				</Handle>
			)}

			{has("xz") && (
				<Handle
					{...handleProps("xz")}
					color={colors.y}
					hitArea={
						<mesh position={[0.35, 0, 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
							<planeGeometry args={[0.34, 0.34]} />

							<HitMaterial />
						</mesh>
					}
				>
					{(color) => (
						<mesh
							position={[0.35, 0, 0.35]}
							rotation={[-Math.PI / 2, 0, 0]}
							renderOrder={RENDER_ORDER}
						>
							<planeGeometry args={[0.26, 0.26]} />

							<GizmoMaterial color={color} opacity={0.75} />
						</mesh>
					)}
				</Handle>
			)}

			{has("rotate") && (
				<Handle
					{...handleProps("rotate")}
					color={colors.y}
					hitArea={
						<mesh rotation={[Math.PI / 2, 0, 0]}>
							<torusGeometry args={[RING_RADIUS, 0.14, 6, 48]} />

							<HitMaterial />
						</mesh>
					}
				>
					{(color) => (
						<mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={RENDER_ORDER}>
							<torusGeometry args={[RING_RADIUS, 0.03, 6, 64]} />

							<GizmoMaterial color={color} />
						</mesh>
					)}
				</Handle>
			)}

			{has("scale") && (
				<Handle
					{...handleProps("scale")}
					color={colors.size}
					hitArea={
						<mesh position={[diagonal, 0, diagonal]}>
							<boxGeometry args={[0.36, 0.36, 0.36]} />

							<HitMaterial />
						</mesh>
					}
				>
					{(color) => (
						<mesh position={[diagonal, 0, diagonal]} renderOrder={RENDER_ORDER}>
							<boxGeometry args={[0.2, 0.2, 0.2]} />

							<GizmoMaterial color={color} />
						</mesh>
					)}
				</Handle>
			)}
		</group>
	);
};
