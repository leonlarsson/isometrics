import { Line } from "@react-three/drei";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";

import { type IJoinOffer, selectSelectedRoad, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { snap } from "#/lib/math";
import { pastDragThreshold } from "#/lib/pointer";
import { roadEnds, segmentMidpoints, type TRoadEnd } from "#/scene/roads";
import type { TRoad, TRoadPoint, TVec2 } from "#/scene/schema";

import { roadBaseY } from "./RoadMesh";
import { type TGizmoHandle, TransformGizmo } from "./TransformGizmo";
import { applyRoadPointDrag, roadPointStart } from "./transforms";
import { groundPointFrom, useGroundDrag } from "./useGroundDrag";

const HANDLE_LIFT = 0.12;
/** Dragged road ends snap onto another road end within this distance. */
const JOIN_SNAP = 0.8;
const HEIGHT_STEP = 0.25;
const MAX_HEIGHT = 50;

const up = new THREE.Vector3();

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
}

/**
 * A control point: click to select, drag to move across the ground, Shift+drag
 * to raise or lower it, double-click to remove it. Dragging a road end onto
 * another road end snaps to it and offers to join them.
 */
const PointHandle = ({ road, index, point, baseY, selected }: IPointHandleProps) => {
	const palette = usePalette();
	const camera = useThree((s) => s.camera);
	const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
	const [hovered, setHovered] = useState(false);
	const drag = useRef<{
		token: string;
		vertical: boolean;
		startY: number;
		startHeight: number;
		pixelsPerUnit: number;
		join: IJoinOffer | null;
		/** Where the press started (screen px); the point stays put until it passes the threshold. */
		from: { clientX: number; clientY: number };
		moving: boolean;
	} | null>(null);

	const end: TRoadEnd | null = road.closed
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
			scale={hovered || selected ? 1.2 : 1}
			onPointerDown={(e: ThreeEvent<PointerEvent>) => {
				if (e.nativeEvent.button !== 0) {
					return;
				}
				e.stopPropagation();
				const store = useEditor.getState();
				store.selectRoadPoint(road.id, index);
				store.setJoinOffer(null);
				// Screen pixels per unit of world height, from the camera's current view.
				up.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
				const zoom = camera instanceof THREE.OrthographicCamera ? camera.zoom : 20;
				drag.current = {
					token: `point:${performance.now()}`,
					vertical: e.nativeEvent.shiftKey,
					startY: e.nativeEvent.clientY,
					startHeight: point[2],
					pixelsPerUnit: Math.max(1, up.y * zoom),
					join: null,
					from: { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY },
					moving: false,
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
				if (!state.moving && !pastDragThreshold(state.from, e.nativeEvent)) {
					return;
				}
				state.moving = true;
				const store = useEditor.getState();
				// Shift can be pressed or released mid-drag: switch modes, starting from where the point is now.
				const vertical = e.nativeEvent.shiftKey;
				if (vertical !== state.vertical) {
					state.vertical = vertical;
					state.startY = e.nativeEvent.clientY;
					state.startHeight =
						store.scene.roads.find((r) => r.id === road.id)?.points[index]?.[2] ?? point[2];
				}
				if (state.vertical) {
					const raw =
						state.startHeight + (state.startY - e.nativeEvent.clientY) / state.pixelsPerUnit;
					const free = e.nativeEvent.altKey || !store.snapping;
					const height = Math.min(MAX_HEIGHT, Math.max(0, free ? raw : snap(raw, HEIGHT_STEP)));
					store.setRoadPointHeight(road.id, index, height, { coalesce: state.token });
					return;
				}
				let target: TVec2 | null = groundPointFrom(e, baseY + point[2]);
				if (!target) {
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
			onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}
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
}

/** Small handle halfway along a segment: drag it to add a point there. */
const InsertHandle = ({ roadId, index, point, baseY }: IInsertHandleProps) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
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
			scale={hovered ? 1.3 : 1}
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

/** Point and insert handles for the selected road (edit mode only). */
export const RoadHandles = () => {
	const road = useEditor(selectSelectedRoad);
	const layer = useEditor((s) => s.scene.roads.findIndex((r) => r.id === s.selectedRoadId));
	const selectedPoint = useEditor((s) => s.selectedPointIndex);
	const mode = useEditor((s) => s.mode);
	const drawing = useEditor((s) => s.drawing !== null);
	const palette = usePalette();

	if (!road || mode !== "edit" || drawing) {
		return null;
	}
	const baseY = roadBaseY(Math.max(0, layer));

	return (
		<group>
			{segmentMidpoints(road.points, road.closed).map(({ index, point }) => (
				<InsertHandle
					key={`insert-${index}`}
					roadId={road.id}
					index={index}
					point={point}
					baseY={baseY}
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
						selected={selectedPoint === index}
					/>
				</group>
			))}

			{selectedPoint !== null && road.points[selectedPoint] && (
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
