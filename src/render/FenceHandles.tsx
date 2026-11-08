import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { useShallow } from "zustand/react/shallow";

import {
	type IPointsStart,
	pointsStart,
	pointsStartOf,
	transformPoints,
} from "#/editor/groupTransform";
import {
	drawnModeOf,
	type IJoinOffer,
	isToggleClick,
	SNAP_STEP,
	selectSelectedFence,
	selectSeveral,
	useEditor,
} from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { fenceHeightOf } from "#/fences/fenceModel";
import { isClick, pastDragThreshold, setCursorHidden } from "#/lib/pointer";
import { fenceStretches, gateDraggedTo, gateSpot } from "#/scene/fences";
import { groundHeightAt, type TGroundWorld } from "#/scene/grounds";
import { roadEnds, segmentMidpoints, type TRoadEnd } from "#/scene/roads";
import type { TFence, TFenceGate, TFencePoint } from "#/scene/schema";

import { HANDLE_ORDER, HANDLE_PICK, HandleMaterial } from "./handleLook";
import { type TGizmoHandle, TransformGizmo } from "./TransformGizmo";
import { applyPointsDrag } from "./transforms";
import { surfacePointFrom, useGroundDrag } from "./useGroundDrag";
import { useScreenScale } from "./useScreenScale";
import { setViewCursor } from "./viewCursor";

/**
 * Handles for the selected fence's points (ADR-0103), as a road has them
 * (render/RoadHandles): drag a point to move it, the dots between points to
 * add one, double-click to remove one; Shift- or Ctrl-click adds points to
 * the selection. The gizmo on the selected points moves them and lifts them
 * off the ground. The handles sit on the fence's top, so the fence itself
 * (which takes clicks round it) doesn't cover them. Each gate has a handle
 * too, to drag it along the fence (ADR-0133).
 */

const HANDLE_LIFT = 0.12;
/** Handle geometry is in screen units of this many pixels, so handles keep their size at any zoom. */
const HANDLE_PX = 24;
const POINT_HANDLES: TGizmoHandle[] = ["x", "z", "xz", "y"];
/** Dragged fence ends snap onto another fence end within this distance, as road ends do. */
const JOIN_SNAP = 0.8;

/** Open fence ends a dragged end could join (ADR-0133), not the dragged end itself. */
const joinTargets = (fences: readonly TFence[], fence: TFence, end: TRoadEnd) =>
	fences.flatMap((other) =>
		roadEnds(other)
			.filter(
				(candidate) =>
					!(other.id === fence.id && candidate.end === end) &&
					// A fence's own other end only works if joining makes a real loop.
					!(other.id === fence.id && fence.points.length < 3),
			)
			.map((candidate) => ({ fenceId: other.id, end: candidate.end, point: candidate.point })),
	);

/** Where a fence point stands: the ground there, plus its lift. */
const standsAt = (ground: TGroundWorld, point: readonly number[]) =>
	groundHeightAt(ground, [point[0], point[1]]) + (point[2] ?? 0);

interface IFencePointHandleProps {
	fence: TFence;
	index: number;
	point: TFencePoint;
	/** How high it stands. */
	y: number;
	selected: boolean;
	/** Inside a selection box being drawn (ADR-0065): shown as it would be after letting go. */
	boxed: boolean;
}

interface IPointDrag {
	token: string;
	/** The other fence end it was let go on, to offer joining them. */
	join: IJoinOffer | null;
	from: { clientX: number; clientY: number };
	moving: boolean;
	/** Pressed on one of several selected points: they all move, from where they were. */
	group: IPointsStart | null;
	keepsOthers: boolean;
}

const FencePointHandle = ({ fence, index, point, y, selected, boxed }: IFencePointHandleProps) => {
	const palette = usePalette();
	const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Group>(HANDLE_PX, hovered || selected || boxed ? 1.2 : 1);
	const drag = useRef<IPointDrag | null>(null);
	// Survives the drag ending (pointer up comes before the click).
	const keepsOthers = useRef(false);

	const end: TRoadEnd | null =
		roadEnds(fence).find((candidate) => candidate.index === index)?.end ?? null;

	const finish = (event: ThreeEvent<PointerEvent>) => {
		const state = drag.current;
		if (!state) {
			return;
		}
		drag.current = null;
		setCursorHidden(false);
		(event.target as unknown as Element).releasePointerCapture?.(event.pointerId);
		if (controls) {
			controls.enabled = true;
		}
		const store = useEditor.getState();
		store.setDragging(false);
		if (state.join) {
			store.setJoinOffer(state.join);
		}
	};

	return (
		<group
			position={[point[0], y + HANDLE_LIFT, point[1]]}
			ref={handle}
			onPointerDown={(e: ThreeEvent<PointerEvent>) => {
				// With Shift, Ctrl or Cmd the press is the camera's (a click toggles the point, below).
				if (e.nativeEvent.button !== 0 || isToggleClick(e.nativeEvent)) {
					return;
				}
				e.stopPropagation();
				const store = useEditor.getState();
				const several =
					store.selectedPointIndices.length > 1 && store.selectedPointIndices.includes(index);
				if (!several) {
					store.selectFencePoint(fence.id, index);
				}
				store.setJoinOffer(null);
				keepsOthers.current = several;
				drag.current = {
					token: `fence-point:${performance.now()}`,
					join: null,
					from: { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY },
					moving: false,
					group: null,
					keepsOthers: several,
				};
				(e.target as unknown as Element).setPointerCapture(e.pointerId);
				if (controls) {
					controls.enabled = false;
				}
				store.setDragging(true);
			}}
			onPointerMove={(e: ThreeEvent<PointerEvent>) => {
				const state = drag.current;
				if (!state) {
					return;
				}
				e.stopPropagation();
				if (!state.moving) {
					if (!pastDragThreshold(state.from, e.nativeEvent)) {
						return;
					}
					state.moving = true;
					keepsOthers.current = false;
					state.group = pointsStart();
					setCursorHidden(true);
				}
				// Under the pointer on the ground as it stands, so it follows the pointer onto raised land,
				// at the height the handle is drawn (the fence's top), so it stays under the pointer.
				let target = surfacePointFrom(e, point[2] + fenceHeightOf(fence));
				const group = state.group;
				const start = group?.points.find((p) => p.index === index)?.point;
				if (!target || !group || !start) {
					return;
				}
				// An end dragged on its own onto another fence's end snaps to it, to offer joining them.
				state.join = null;
				if (end && group.points.length === 1) {
					const spot = target;
					const near = joinTargets(useEditor.getState().scene.fences, fence, end).find(
						(candidate) =>
							Math.hypot(candidate.point[0] - spot[0], candidate.point[1] - spot[1]) < JOIN_SNAP,
					);
					if (near) {
						target = [near.point[0], near.point[1]];
						state.join = {
							target: "fence",
							aId: fence.id,
							aEnd: end,
							bId: near.fenceId,
							bEnd: near.end,
						};
					}
				}
				// This point lands on the grid; any others selected move by as much.
				transformPoints(
					group,
					{ offset: [target[0] - start[0], target[1] - start[1]] },
					{ coalesce: state.token, gesture: true },
				);
			}}
			onPointerUp={finish}
			onLostPointerCapture={finish}
			onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				useEditor.getState().removeFencePoint(fence.id, index);
			}}
			onClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				if (!isClick(e)) {
					return;
				}
				const store = useEditor.getState();
				if (isToggleClick(e.nativeEvent)) {
					store.togglePoint(index);
				} else if (keepsOthers.current) {
					store.selectFencePoint(fence.id, index);
				}
				keepsOthers.current = false;
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
				<cylinderGeometry args={[0.4, 0.4, 0.06, 24]} />

				<HandleMaterial color={palette.selection} />
			</mesh>

			<mesh position={[0, 0.02, 0]} renderOrder={HANDLE_ORDER + 1}>
				<cylinderGeometry args={[0.26, 0.26, 0.06, 24]} />

				<HandleMaterial color={selected ? palette.selection : "#ffffff"} />
			</mesh>
		</group>
	);
};

interface IFenceInsertHandleProps {
	fenceId: string;
	/** Index of the segment's first point; the new point goes after it. */
	index: number;
	point: TFencePoint;
	y: number;
	visible: boolean;
}

/** Small handle halfway along a segment: drag it to add a point there. Hidden while a handle is dragged. */
const FenceInsertHandle = ({ fenceId, index, point, y, visible }: IFenceInsertHandleProps) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Mesh>(HANDLE_PX, hovered ? 1.3 : 1);
	const drag = useGroundDrag({
		planeY: y,
		onStart: (token) => {
			const store = useEditor.getState();
			store.insertFencePoint(fenceId, index + 1, point, { coalesce: token });
			store.selectFencePoint(fenceId, index + 1);
			return true;
		},
		onMove: (next, token) =>
			useEditor.getState().moveFencePoint(fenceId, index + 1, next, { coalesce: token }),
	});

	return (
		<mesh
			renderOrder={HANDLE_ORDER}
			position={[point[0], y + HANDLE_LIFT, point[1]]}
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

/** Where a gate's handle stands: its middle on its stretch, on the fence's top there. */
const gateHandleAt = (
	fence: TFence,
	gate: Pick<TFenceGate, "spanIndex" | "alongShare">,
	ground: TGroundWorld,
	top: number,
): [number, number, number] | null => {
	const spot = gateSpot(fence, gate);
	const stretches = fenceStretches(fence);
	const stretch = stretches[Math.min(Math.max(0, gate.spanIndex), stretches.length - 1)];
	if (!spot || !stretch) {
		return null;
	}
	const t = Math.min(1, Math.max(0, gate.alongShare));
	const lift = (stretch[0][2] ?? 0) + ((stretch[1][2] ?? 0) - (stretch[0][2] ?? 0)) * t;
	return [spot[0], groundHeightAt(ground, spot) + lift + top, spot[1]];
};

interface IFenceGateHandleProps {
	fence: TFence;
	index: number;
	/** Where it stands: the gate's middle, on the fence's top. */
	at: [number, number, number];
	/** Which way the fence runs there, a unit vector on the ground. */
	direction: readonly number[];
}

/**
 * A gate's handle (ADR-0133): drag it to move the gate along its fence, onto
 * the stretch nearest the pointer, half a grid square at a time along it while
 * snapping is on (Alt places it freely), never so near a stretch's end that
 * the gate wouldn't fit. One drag is one undo step.
 */
const FenceGateHandle = ({ fence, index, at, direction }: IFenceGateHandleProps) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Group>(HANDLE_PX, hovered ? 1.2 : 1);
	const drag = useGroundDrag({
		planeY: at[1],
		snapsToGrid: false,
		// With Shift, Ctrl or Cmd the press is the camera's.
		onStart: (_, event) => !isToggleClick(event.nativeEvent),
		onMove: (spot, token, event) => {
			const store = useEditor.getState();
			const now = store.scene.fences.find((each) => each.id === fence.id);
			const gate = now?.gates[index];
			if (!now || !gate) {
				return;
			}
			const free = event.nativeEvent.altKey || !store.snapping;
			const place = gateDraggedTo(now, gate.width, spot, free ? undefined : SNAP_STEP);
			if (!place || (place.spanIndex === gate.spanIndex && place.alongShare === gate.alongShare)) {
				return;
			}
			store.updateFence(
				fence.id,
				(f) => {
					const draft = f.gates[index];
					if (draft) {
						draft.spanIndex = place.spanIndex;
						draft.alongShare = place.alongShare;
					}
				},
				// One gesture: however long the pointer pauses, one undo step.
				{ coalesce: token, gesture: true },
			);
		},
	});

	return (
		<group
			position={[at[0], at[1] + HANDLE_LIFT, at[2]]}
			rotation={[0, Math.atan2(-direction[1], direction[0]), 0]}
			ref={handle}
			{...drag}
			onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}
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
				<boxGeometry args={[1, 0.06, 0.46]} />

				<HandleMaterial color={palette.selection} />
			</mesh>

			{/* Two bars across it, like a gate's: what tells it from a point's round handle. */}
			{[-0.2, 0.2].map((x) => (
				<mesh key={x} position={[x, 0.02, 0]} renderOrder={HANDLE_ORDER + 1}>
					<boxGeometry args={[0.12, 0.06, 0.3]} />

					<HandleMaterial color="#ffffff" />
				</mesh>
			))}
		</group>
	);
};

/** The move gizmo on the selected points, at their middle: along the ground, and up to lift them. */
const FencePointsGizmo = ({ fence }: { fence: TFence }) => {
	const start = useRef<IPointsStart | null>(null);
	const indices = useEditor((s) => s.selectedPointIndices);
	// From what it subscribes to, so it follows the points it moves (ADR-0093).
	const center = useMemo(() => pointsStartOf({ fence }, indices)?.center ?? null, [fence, indices]);
	if (!center) {
		return null;
	}

	return (
		<group position={center}>
			<TransformGizmo
				handles={POINT_HANDLES}
				onStart={() => {
					start.current = pointsStart();
				}}
				onDrag={(drag) => {
					if (start.current) {
						applyPointsDrag(start.current, drag);
					}
				}}
			/>
		</group>
	);
};

/** Point and insert handles for the selected fence (Edit mode only). */
export const FenceHandles = () => {
	const fence = useEditor(selectSelectedFence);
	// Its points are edited on their own, not while it's one of several selected things.
	const several = useEditor(selectSeveral);
	// What its points stand on: the grounds and the areas on them (ADR-0155).
	const ground = useEditor(useShallow((s) => ({ areas: s.scene.areas, grounds: s.scene.grounds })));
	const selectedPoints = useEditor((s) => s.selectedPointIndices);
	// A selection box being drawn over its points (ADR-0065): what letting go would select.
	const boxDrag = useEditor((s) => s.boxDrag);
	const mode = useEditor(drawnModeOf);
	const drawing = useEditor((s) => s.drawing !== null);
	const dragging = useEditor((s) => s.dragging);
	const top = fence ? fenceHeightOf(fence) : 0;

	if (!fence || several || mode !== "edit" || drawing || fence.isHidden || fence.isLocked) {
		return null;
	}

	const stretches = fenceStretches(fence);
	const gates = fence.gates.flatMap((gate, index) => {
		const at = gateHandleAt(fence, gate, ground, top);
		const stretch = stretches[Math.min(Math.max(0, gate.spanIndex), stretches.length - 1)];
		if (!at || !stretch) {
			return [];
		}
		const [a, b] = stretch;
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		const direction = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
		return [{ index, at, direction, reach: Math.max(0.3, gate.width / 2) }];
	});
	// A gate's handle takes the place of the dot for adding a point under it, in its opening.
	const underAGate = (point: readonly number[]) =>
		gates.some((gate) => Math.hypot(gate.at[0] - point[0], gate.at[2] - point[1]) < gate.reach);

	return (
		<group userData={HANDLE_PICK}>
			{gates.map((gate) => (
				<FenceGateHandle
					key={`gate-${gate.index}`}
					fence={fence}
					index={gate.index}
					at={gate.at}
					direction={gate.direction}
				/>
			))}

			{segmentMidpoints(fence.points, fence.loops)
				.filter(({ point }) => !underAGate(point))
				.map(({ index, point }) => (
					<FenceInsertHandle
						key={`insert-${index}`}
						fenceId={fence.id}
						index={index}
						point={[point[0], point[1], point[2]]}
						y={standsAt(ground, point) + top}
						visible={!dragging}
					/>
				))}

			{fence.points.map((point, index) => (
				<FencePointHandle
					// biome-ignore lint/suspicious/noArrayIndexKey: handles are positional; keeping the instance during a drag matters
					key={index}
					fence={fence}
					index={index}
					point={point}
					y={standsAt(ground, point) + top}
					selected={
						selectedPoints.includes(index) && !(boxDrag?.removing && boxDrag.points.includes(index))
					}
					boxed={!boxDrag?.removing && (boxDrag?.points.includes(index) ?? false)}
				/>
			))}

			{selectedPoints.length > 0 && <FencePointsGizmo fence={fence} />}
		</group>
	);
};
