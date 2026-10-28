import { Line } from "@react-three/drei";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

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
	selectSelectedRoad,
	selectSeveral,
	useEditor,
} from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { isClick, pastDragThreshold, setCursorHidden } from "#/lib/pointer";
import { roadEnds, segmentMidpoints, type TRoadEnd } from "#/scene/roads";
import type { TRoad, TRoadPoint, TVec2 } from "#/scene/schema";

import { roadBaseY } from "./RoadMesh";
import { type TGizmoHandle, TransformGizmo } from "./TransformGizmo";
import { applyPointsDrag, applyRoadPointDrag, roadPointStart } from "./transforms";
import { groundPointFrom, useGroundDrag } from "./useGroundDrag";
import { useScreenScale } from "./useScreenScale";

const HANDLE_LIFT = 0.12;
/** Handle geometry is in screen units of this many pixels, so handles keep their size at any zoom. */
const HANDLE_PX = 24;
/** Dragged road ends snap onto another road end within this distance. */
const JOIN_SNAP = 0.8;

/** Open road ends a dragged end could join, excluding the dragged end itself. */
const joinTargets = (roads: TRoad[], road: TRoad, end: TRoadEnd) =>
	roads.flatMap((other) =>
		roadEnds(other)
			.filter(
				(candidate) =>
					!(other.id === road.id && candidate.end === end) &&
					// A road's own other end only works if joining makes a real loop.
					!(other.id === road.id && road.points.length < 3),
			)
			.map((candidate) => ({ roadId: other.id, end: candidate.end, point: candidate.point })),
	);

interface IPointHandleProps {
	road: TRoad;
	index: number;
	point: TRoadPoint;
	baseY: number;
	selected: boolean;
	/** Inside a selection box being drawn (ADR-0065): shown as it would be after letting go. */
	boxed: boolean;
}

interface IPointDrag {
	token: string;
	join: IJoinOffer | null;
	/** Where the press started (screen px); the point stays put until it passes the threshold. */
	from: { clientX: number; clientY: number };
	moving: boolean;
	/** Pressed on one of several selected points: they all move, from where they were. */
	group: IPointsStart | null;
	/** Pressed on one of several selected points: a click without moving selects just this one. */
	keepsOthers: boolean;
}

/**
 * A control point: click to select, drag to move across the ground (all the
 * selected points when it's one of them), double-click to remove it. Shift- or
 * Ctrl-click adds it to the selected points or takes it out; Shift/Ctrl-drag
 * orbits the camera, as everywhere (ADR-0065). Dragging a road end onto another
 * road end snaps to it and offers to join them.
 */
const PointHandle = ({ road, index, point, baseY, selected, boxed }: IPointHandleProps) => {
	const palette = usePalette();
	const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Group>(HANDLE_PX, hovered || selected || boxed ? 1.2 : 1);
	const drag = useRef<IPointDrag | null>(null);
	// Survives the drag ending (pointer up comes before the click).
	const keepsOthers = useRef(false);

	const end: TRoadEnd | null = road.loops
		? null
		: index === 0
			? "start"
			: index === road.points.length - 1
				? "end"
				: null;

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
			position={[point[0], baseY + point[2] + HANDLE_LIFT, point[1]]}
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
					store.selectRoadPoint(road.id, index);
				}
				store.setJoinOffer(null);
				keepsOthers.current = several;
				drag.current = {
					token: `point:${performance.now()}`,
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
					state.group = state.keepsOthers ? pointsStart() : null;
					// Hide the cursor while dragging, so it doesn't cover the spot.
					setCursorHidden(true);
				}
				const store = useEditor.getState();
				let target: TVec2 | null = groundPointFrom(e, baseY + point[2]);
				if (!target) {
					return;
				}
				if (state.group) {
					// This point lands on the grid; the others move by as much.
					const start = state.group.points.find((p) => p.index === index)?.point ?? point;
					transformPoints(
						state.group,
						{ offset: [target[0] - start[0], target[1] - start[1]] },
						{ coalesce: state.token },
					);
					return;
				}
				state.join = null;
				if (end) {
					const near = joinTargets(store.scene.roads, road, end).find(
						(candidate) =>
							Math.hypot(candidate.point[0] - target![0], candidate.point[1] - target![1]) <
							JOIN_SNAP,
					);
					if (near) {
						target = [near.point[0], near.point[1]];
						state.join = { aId: road.id, aEnd: end, bId: near.roadId, bEnd: near.end };
					}
				}
				store.moveRoadPoint(road.id, index, target, { coalesce: state.token });
			}}
			onPointerUp={finish}
			onLostPointerCapture={finish}
			onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				useEditor.getState().removeRoadPoint(road.id, index);
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
					store.selectRoadPoint(road.id, index);
				}
				keepsOthers.current = false;
			}}
			onPointerOver={(e: ThreeEvent<PointerEvent>) => {
				e.stopPropagation();
				setHovered(true);
				document.body.style.cursor = "grab";
			}}
			onPointerOut={() => {
				setHovered(false);
				document.body.style.cursor = "";
			}}
		>
			<mesh>
				<cylinderGeometry args={[0.4, 0.4, 0.06, 24]} />

				<meshBasicMaterial color={palette.selection} />
			</mesh>

			<mesh position={[0, 0.02, 0]}>
				<cylinderGeometry args={[0.26, 0.26, 0.06, 24]} />

				<meshBasicMaterial color={selected ? palette.selection : "#ffffff"} />
			</mesh>
		</group>
	);
};

interface IInsertHandleProps {
	roadId: string;
	/** Index of the segment's first point; the new point goes after it. */
	index: number;
	point: TRoadPoint;
	baseY: number;
	visible: boolean;
}

/** Small handle halfway along a segment: drag it to add a point there. Hidden while a handle is dragged. */
const InsertHandle = ({ roadId, index, point, baseY, visible }: IInsertHandleProps) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Mesh>(HANDLE_PX, hovered ? 1.3 : 1);
	const drag = useGroundDrag({
		planeY: baseY + point[2],
		onStart: (token) => {
			const store = useEditor.getState();
			store.insertRoadPoint(roadId, index + 1, point, { coalesce: token });
			store.selectRoadPoint(roadId, index + 1);
			return true;
		},
		onMove: (next, token) =>
			useEditor.getState().moveRoadPoint(roadId, index + 1, next, { coalesce: token }),
	});

	return (
		<mesh
			position={[point[0], baseY + point[2] + HANDLE_LIFT, point[1]]}
			ref={handle}
			visible={visible}
			{...drag}
			onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}
			onPointerOver={(e: ThreeEvent<PointerEvent>) => {
				e.stopPropagation();
				setHovered(true);
				document.body.style.cursor = "copy";
			}}
			onPointerOut={() => {
				setHovered(false);
				document.body.style.cursor = "";
			}}
		>
			<cylinderGeometry args={[0.2, 0.2, 0.05, 20]} />

			<meshBasicMaterial color={palette.selection} transparent opacity={hovered ? 0.9 : 0.5} />
		</mesh>
	);
};

const POINT_HANDLES: TGizmoHandle[] = ["x", "z", "xz", "y"];

/** Move gizmo on the selected road point: along X / Z, on the ground, and up for height. */
const RoadPointGizmo = ({
	roadId,
	index,
	point,
	baseY,
}: {
	roadId: string;
	index: number;
	point: TRoadPoint;
	baseY: number;
}) => {
	const start = useRef<TRoadPoint | null>(null);

	return (
		<group position={[point[0], baseY + (point[2] ?? 0), point[1]]}>
			<TransformGizmo
				handles={POINT_HANDLES}
				onStart={() => {
					start.current = roadPointStart(roadId, index);
				}}
				onDrag={(drag) => {
					if (start.current) {
						applyRoadPointDrag(roadId, index, start.current, drag);
					}
				}}
			/>
		</group>
	);
};

/** The move gizmo for several selected points (ADR-0065), at their middle: along the ground, and up. */
const PointsGizmo = ({ baseY }: { baseY: number }) => {
	const start = useRef<IPointsStart | null>(null);
	const road = useEditor(selectSelectedRoad);
	const indices = useEditor((s) => s.selectedPointIndices);
	// From what it subscribes to, so it follows the points it moves (ADR-0093).
	const center = useMemo(
		() => (road ? (pointsStartOf({ road }, indices)?.center ?? null) : null),
		[road, indices],
	);
	if (!center) {
		return null;
	}

	return (
		<group position={[center[0], baseY + center[1], center[2]]}>
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

/** Point and insert handles for the selected road (edit mode only). */
export const RoadHandles = () => {
	const road = useEditor(selectSelectedRoad);
	// Its points are edited on their own, not while it's one of several selected things.
	const several = useEditor(selectSeveral);
	const layer = useEditor((s) => s.scene.roads.findIndex((r) => r.id === s.selectedRoadId));
	const selectedPoint = useEditor((s) => s.selectedPointIndex);
	const selectedPoints = useEditor((s) => s.selectedPointIndices);
	// A selection box being drawn over its points (ADR-0065): what letting go would select.
	const boxDrag = useEditor((s) => s.boxDrag);
	const mode = useEditor(drawnModeOf);
	const drawing = useEditor((s) => s.drawing !== null);
	const dragging = useEditor((s) => s.dragging);
	const palette = usePalette();

	if (!road || several || mode !== "edit" || drawing || road.hidden || road.locked) {
		return null;
	}
	const baseY = roadBaseY(Math.max(0, layer));

	return (
		<group>
			{segmentMidpoints(road.points, road.loops).map(({ index, point }) => (
				<InsertHandle
					key={`insert-${index}`}
					roadId={road.id}
					index={index}
					point={point}
					baseY={baseY}
					visible={!dragging}
				/>
			))}

			{road.points.map((point, index) => (
				<group
					// biome-ignore lint/suspicious/noArrayIndexKey: handles are positional; keeping the instance during a drag matters
					key={index}
				>
					{point[2] > 0 && (
						// Drop line to the ground, so raised points read clearly in 3D.
						<Line
							points={[
								[point[0], baseY, point[1]],
								[point[0], baseY + point[2], point[1]],
							]}
							color={palette.selection}
							lineWidth={1}
							dashed
							dashSize={0.15}
							gapSize={0.1}
						/>
					)}

					<PointHandle
						road={road}
						index={index}
						point={point}
						baseY={baseY}
						selected={
							selectedPoints.includes(index) &&
							!(boxDrag?.removing && boxDrag.points.includes(index))
						}
						boxed={!boxDrag?.removing && (boxDrag?.points.includes(index) ?? false)}
					/>
				</group>
			))}

			{selectedPoints.length > 1 && <PointsGizmo baseY={baseY} />}

			{selectedPoints.length === 1 && selectedPoint !== null && road.points[selectedPoint] && (
				<RoadPointGizmo
					roadId={road.id}
					index={selectedPoint}
					point={road.points[selectedPoint]}
					baseY={baseY}
				/>
			)}
		</group>
	);
};
