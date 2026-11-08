import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
	insertGroundCorner,
	moveGroundCorner,
	moveGroundCornersBy,
	removeGroundCorner,
	resizeGround,
	selectGroundCorner,
	useGroundShaping,
} from "#/editor/groundShaping";
import { drawnModeOf, isToggleClick, SNAP_STEP, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { snap } from "#/lib/math";
import { isClick, pastDragThreshold } from "#/lib/pointer";
import { groundCornersOf } from "#/scene/groundShape";
import type { TScene, TVec2 } from "#/scene/schema";

import { pixelsPerUnitAt } from "./cameraMath";
import { HANDLE_ORDER, HANDLE_PICK, HandleMaterial } from "./handleLook";
import { alongLine, BALL_RADIUS, HIT, STAND_OFF } from "./SizeHandles";
import {
	GizmoMaterial,
	Handle,
	HitMaterial,
	RENDER_ORDER,
	type TGizmoHandle,
	TransformGizmo,
	UNIT_PX,
} from "./TransformGizmo";
import { useGroundDrag } from "./useGroundDrag";
import { useScreenScale } from "./useScreenScale";
import { setViewCursor } from "./viewCursor";

/** Handles stand a little above the ground's top (y 0). */
const HANDLE_Y = 0.12;
/** Handle geometry is in screen units of this many pixels, so handles keep their size at any zoom. */
const HANDLE_PX = 24;

const corners = () => groundCornersOf(useEditor.getState().scene.ground);

/**
 * One of the ground's corners: click to select, drag to move (all the selected
 * corners when it's one of them), double-click to remove (it keeps three).
 * Shift- or Ctrl-click adds it to the selected corners or takes it out.
 */
const CornerHandle = ({
	index,
	point,
	selected,
}: {
	index: number;
	point: TVec2;
	selected: boolean;
}) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Group>(HANDLE_PX, hovered || selected ? 1.2 : 1);
	// Pressed on one of several selected corners: they move together, from where they all started.
	const group = useRef<{ from: TVec2[]; indices: readonly number[] } | null>(null);
	const drag = useGroundDrag({
		planeY: 0,
		reachesPastGround: true,
		onStart: (_token, event) => {
			// With Shift, Ctrl or Cmd the press is the camera's (a click toggles the corner, below).
			if (isToggleClick(event.nativeEvent)) {
				return false;
			}
			const { selected: indices } = useGroundShaping.getState();
			const several = indices.length > 1 && indices.includes(index);
			if (!several) {
				selectGroundCorner(index);
			}
			group.current = several ? { from: corners(), indices } : null;
			return true;
		},
		onMove: (next, token) => {
			const options = { coalesce: token, gesture: true };
			const state = group.current;
			if (state) {
				// This corner lands on the grid; the others move by as much.
				const start = state.from[index];
				moveGroundCornersBy(
					state.from,
					state.indices,
					[next[0] - start[0], next[1] - start[1]],
					options,
				);
				return;
			}
			moveGroundCorner(index, next, options);
		},
	});

	return (
		<group
			position={[point[0], HANDLE_Y, point[1]]}
			ref={handle}
			{...drag}
			onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				removeGroundCorner(index);
			}}
			onClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				if (isClick(e) && isToggleClick(e.nativeEvent)) {
					selectGroundCorner(index, true);
				}
			}}
			onPointerOver={(e: ThreeEvent<PointerEvent>) => {
				e.stopPropagation();
				setHovered(true);
				setViewCursor("grab");
			}}
			onPointerOut={() => {
				setHovered(false);
				setViewCursor("");
			}}
		>
			<mesh renderOrder={HANDLE_ORDER}>
				<cylinderGeometry args={[0.4, 0.4, 0.06, 4]} />

				<HandleMaterial color={palette.selection} />
			</mesh>

			<mesh position={[0, 0.02, 0]} renderOrder={HANDLE_ORDER + 1}>
				<cylinderGeometry args={[0.26, 0.26, 0.06, 4]} />

				<HandleMaterial color={selected ? palette.selection : "#ffffff"} />
			</mesh>
		</group>
	);
};

/** A dot halfway along a side of a shaped ground: drag it to add a corner there. */
const InsertHandle = ({
	index,
	point,
	visible,
}: {
	index: number;
	point: TVec2;
	visible: boolean;
}) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Mesh>(HANDLE_PX, hovered ? 1.3 : 1);
	const drag = useGroundDrag({
		planeY: 0,
		reachesPastGround: true,
		onStart: (token) => {
			insertGroundCorner(index + 1, point, { coalesce: token, gesture: true });
			return true;
		},
		onMove: (next, token) => moveGroundCorner(index + 1, next, { coalesce: token, gesture: true }),
	});

	return (
		<mesh
			renderOrder={HANDLE_ORDER}
			position={[point[0], HANDLE_Y, point[1]]}
			ref={handle}
			visible={visible}
			{...drag}
			onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}
			onPointerOver={(e: ThreeEvent<PointerEvent>) => {
				e.stopPropagation();
				setHovered(true);
				setViewCursor("copy");
			}}
			onPointerOut={() => {
				setHovered(false);
				setViewCursor("");
			}}
		>
			<cylinderGeometry args={[0.2, 0.2, 0.05, 20]} />

			<HandleMaterial color={palette.selection} transparent opacity={hovered ? 0.9 : 0.5} />
		</mesh>
	);
};

const knobAt = new THREE.Vector3();

/**
 * A size handle in the middle of a side of the ground (the rectangle round
 * it, for a shape), like an object's (ADR-0124): a ball in its axis's colour
 * standing off the side, dragged along the axis to resize the ground there.
 * It stays centred, so the opposite side moves as much; a shape stretches.
 * Snaps to whole units (Alt, or snapping off, sizes freely); right-click or
 * Esc during the drag puts it back.
 */
const SideHandle = ({ axis, sign }: { axis: "x" | "z"; sign: 1 | -1 }) => {
	const colors = usePalette().gizmo;
	const ground = useEditor((s) => s.scene.ground);
	const camera = useThree((s) => s.camera);
	const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
	const root = useRef<THREE.Group>(null);
	const knob = useRef<THREE.Group>(null);
	const [active, setActive] = useState(false);
	const session = useRef<{
		token: string;
		from: { clientX: number; clientY: number };
		started: boolean;
		anchor: number;
		origin: THREE.Vector3;
		direction: THREE.Vector3;
		start: { width: number; depth: number };
		before: TScene;
	} | null>(null);

	// The same size on screen at any zoom, standing a little off its side.
	useFrame(({ size }) => {
		if (!root.current || !knob.current) {
			return;
		}
		root.current.getWorldPosition(knobAt);
		const unit = UNIT_PX / pixelsPerUnitAt(camera, knobAt, size.height);
		knob.current.scale.setScalar(unit);
		knob.current.position.set(
			axis === "x" ? sign * STAND_OFF * unit : 0,
			0,
			axis === "z" ? sign * STAND_OFF * unit : 0,
		);
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

	const at: TVec2 = axis === "x" ? [(sign * ground.width) / 2, 0] : [0, (sign * ground.depth) / 2];

	return (
		<group ref={root} position={[at[0], 0, at[1]]}>
			<Handle
				color={colors[axis]}
				hoverColor={colors.hover}
				active={active}
				onPointerDown={(e) => {
					if (e.nativeEvent.button !== 0) {
						return;
					}
					e.stopPropagation();
					const store = useEditor.getState();
					session.current = {
						token: `ground-size:${axis}:${performance.now()}`,
						from: { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY },
						started: false,
						anchor: 0,
						origin: new THREE.Vector3(at[0], 0, at[1]),
						direction: new THREE.Vector3(axis === "x" ? sign : 0, 0, axis === "z" ? sign : 0),
						start: { width: store.scene.ground.width, depth: store.scene.ground.depth },
						before: store.scene,
					};
					setActive(true);
					(e.target as unknown as Element).setPointerCapture(e.pointerId);
					if (controls) {
						controls.enabled = false;
					}
					store.setDragging(true);
					store.setCancelGesture(cancel);
				}}
				onPointerMove={(e) => {
					const current = session.current;
					if (!current) {
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
					const free = e.nativeEvent.altKey || !useEditor.getState().snapping;
					// Both sides move, as it stays centred.
					const grow = (along - current.anchor) * 2;
					const size = (start: number) => (free ? start + grow : snap(start + grow, 1));
					const options = { coalesce: current.token, gesture: true };
					if (axis === "x") {
						resizeGround(size(current.start.width), current.start.depth, options);
					} else {
						resizeGround(current.start.width, size(current.start.depth), options);
					}
				}}
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
					<group ref={knob} name={`ground size handle ${sign > 0 ? "+" : "−"}${axis}`}>
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

const CORNER_HANDLES: TGizmoHandle[] = ["x", "z", "xz"];

/** The move gizmo on the selected corners, at their middle: along the ground. */
const CornersGizmo = ({ points, indices }: { points: TVec2[]; indices: readonly number[] }) => {
	const from = useRef<TVec2[] | null>(null);
	const center = useMemo(() => {
		const chosen = indices.map((i) => points[i]).filter(Boolean);
		if (chosen.length === 0) {
			return null;
		}
		return [
			chosen.reduce((sum, p) => sum + p[0], 0) / chosen.length,
			chosen.reduce((sum, p) => sum + p[1], 0) / chosen.length,
		] as TVec2;
	}, [points, indices]);
	if (!center) {
		return null;
	}

	return (
		<group position={[center[0], 0, center[1]]}>
			<TransformGizmo
				handles={CORNER_HANDLES}
				onStart={() => {
					from.current = corners();
				}}
				onDrag={(drag) => {
					if (!from.current) {
						return;
					}
					const step = (value: number) => (drag.free ? value : snap(value, SNAP_STEP));
					moveGroundCornersBy(from.current, indices, [step(drag.offset[0]), step(drag.offset[1])], {
						coalesce: drag.token,
						gesture: true,
					});
				}}
			/>
		</group>
	);
};

/**
 * The ground's handles while it's being shaped (ADR-0155, Edit mode): a
 * handle on each corner, the move gizmo on the selected ones, and on each
 * side a dot that adds a corner, or on the rectangle a handle that resizes it.
 */
export const GroundHandles = () => {
	const isOn = useGroundShaping((s) => s.isOn);
	const selected = useGroundShaping((s) => s.selected);
	const ground = useEditor((s) => s.scene.ground);
	const mode = useEditor(drawnModeOf);
	const drawing = useEditor((s) => s.drawing !== null);
	const dragging = useEditor((s) => s.dragging);
	const points = useMemo(() => groundCornersOf(ground), [ground]);
	if (!isOn || mode !== "edit" || drawing) {
		return null;
	}
	const chosen = selected.filter((index) => index < points.length);

	return (
		<group userData={HANDLE_PICK}>
			{/* The size handles on the sides of the rectangle (round a shape, which they stretch). */}
			{(
				[
					["x", 1],
					["x", -1],
					["z", 1],
					["z", -1],
				] as const
			).map(([axis, sign]) => (
				<SideHandle key={`${axis}${sign}`} axis={axis} sign={sign} />
			))}

			{ground.points !== null &&
				points.map((point, index) => {
					const after = points[(index + 1) % points.length];
					return (
						<InsertHandle
							// biome-ignore lint/suspicious/noArrayIndexKey: one per side, by position
							key={`insert-${index}`}
							index={index}
							point={[(point[0] + after[0]) / 2, (point[1] + after[1]) / 2]}
							visible={!dragging}
						/>
					);
				})}

			{/* Kept while dragging: the gizmo's own drag sets dragging, and unmounting it ends the drag. */}
			{chosen.length > 0 && <CornersGizmo points={points} indices={chosen} />}

			{points.map((point, index) => (
				<CornerHandle
					// biome-ignore lint/suspicious/noArrayIndexKey: handles are positional; keeping the instance during a drag matters
					key={index}
					index={index}
					point={point}
					selected={chosen.includes(index)}
				/>
			))}
		</group>
	);
};
