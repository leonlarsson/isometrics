import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type * as THREE from "three";

import {
	type IPointsStart,
	pointsStart,
	pointsStartOf,
	transformPoints,
} from "#/editor/groupTransform";
import {
	drawnModeOf,
	isToggleClick,
	selectSelectedFence,
	selectSeveral,
	useEditor,
} from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { fenceHeightOf } from "#/fences/fenceModel";
import { isClick, pastDragThreshold, setCursorHidden } from "#/lib/pointer";
import { groundHeightAt } from "#/scene/areas";
import { segmentMidpoints } from "#/scene/roads";
import type { TArea, TFence, TFencePoint } from "#/scene/schema";

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
 * (which takes clicks round it) doesn't cover them.
 */

const HANDLE_LIFT = 0.12;
/** Handle geometry is in screen units of this many pixels, so handles keep their size at any zoom. */
const HANDLE_PX = 24;
const POINT_HANDLES: TGizmoHandle[] = ["x", "z", "xz", "y"];

/** Where a fence point stands: the ground there, plus its lift. */
const standsAt = (areas: readonly TArea[], point: readonly number[]) =>
	groundHeightAt(areas, [point[0], point[1]]) + (point[2] ?? 0);

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

	const finish = (event: ThreeEvent<PointerEvent>) => {
		if (!drag.current) {
			return;
		}
		drag.current = null;
		setCursorHidden(false);
		(event.target as unknown as Element).releasePointerCapture?.(event.pointerId);
		if (controls) {
			controls.enabled = true;
		}
		useEditor.getState().setDragging(false);
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
				keepsOthers.current = several;
				drag.current = {
					token: `fence-point:${performance.now()}`,
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
				// Under the pointer on the ground as it stands, so it follows the pointer onto raised land.
				const target = surfacePointFrom(e, point[2]);
				const group = state.group;
				const start = group?.points.find((p) => p.index === index)?.point;
				if (!target || !group || !start) {
					return;
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

			<meshBasicMaterial color={palette.selection} transparent opacity={hovered ? 0.9 : 0.5} />
		</mesh>
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
	const areas = useEditor((s) => s.scene.areas);
	const selectedPoints = useEditor((s) => s.selectedPointIndices);
	// A selection box being drawn over its points (ADR-0065): what letting go would select.
	const boxDrag = useEditor((s) => s.boxDrag);
	const mode = useEditor(drawnModeOf);
	const drawing = useEditor((s) => s.drawing !== null);
	const dragging = useEditor((s) => s.dragging);
	const top = fence ? fenceHeightOf(fence) : 0;

	if (!fence || several || mode !== "edit" || drawing || fence.hidden || fence.locked) {
		return null;
	}

	return (
		<group>
			{segmentMidpoints(fence.points, fence.loops).map(({ index, point }) => (
				<FenceInsertHandle
					key={`insert-${index}`}
					fenceId={fence.id}
					index={index}
					point={[point[0], point[1], point[2]]}
					y={standsAt(areas, point) + top}
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
					y={standsAt(areas, point) + top}
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
