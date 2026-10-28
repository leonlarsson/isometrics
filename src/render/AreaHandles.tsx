import type { ThreeEvent } from "@react-three/fiber";
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
	selectSelectedArea,
	selectSeveral,
	useEditor,
} from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { isClick } from "#/lib/pointer";
import { cornerTop, takesCornerHeights } from "#/scene/areas";
import type { TVec2 } from "#/scene/schema";

import { areaBaseY } from "./AreaMesh";
import { type TGizmoHandle, TransformGizmo } from "./TransformGizmo";
import { applyPointsDrag } from "./transforms";
import { useGroundDrag } from "./useGroundDrag";
import { useScreenScale } from "./useScreenScale";

const HANDLE_LIFT = 0.12;
/** Handle geometry is in screen units of this many pixels, so handles keep their size at any zoom. */
const HANDLE_PX = 24;

interface ICornerHandleProps {
	areaId: string;
	index: number;
	point: readonly number[];
	/** Where its handle stands: on the area's top at this corner. */
	y: number;
	selected: boolean;
	/** Inside a selection box being drawn (ADR-0065): shown as it would be after letting go. */
	boxed: boolean;
}

/**
 * A corner: click to select, drag to move (all the selected corners when it's
 * one of them), double-click to remove (an area keeps three). Shift- or
 * Ctrl-click adds it to the selected corners or takes it out (ADR-0065).
 */
const CornerHandle = ({ areaId, index, point, y, selected, boxed }: ICornerHandleProps) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Group>(HANDLE_PX, hovered || selected || boxed ? 1.2 : 1);
	// Pressed on one of several selected corners: they move together, and a click selects just this one.
	const group = useRef<{ start: IPointsStart | null; keepsOthers: boolean } | null>(null);
	const drag = useGroundDrag({
		planeY: y,
		onStart: (_token, event) => {
			// With Shift, Ctrl or Cmd the press is the camera's (a click toggles the corner, below).
			if (isToggleClick(event.nativeEvent)) {
				return false;
			}
			const store = useEditor.getState();
			const several =
				store.selectedPointIndices.length > 1 && store.selectedPointIndices.includes(index);
			if (!several) {
				store.selectAreaPoint(areaId, index);
			}
			group.current = { start: null, keepsOthers: several };
			return true;
		},
		onMove: (next, token) => {
			const state = group.current;
			if (state?.keepsOthers) {
				// This corner lands on the grid; the others move by as much.
				state.start ??= pointsStart();
				const start = state.start?.points.find((p) => p.index === index)?.point ?? point;
				if (state.start) {
					transformPoints(
						state.start,
						{ offset: [next[0] - start[0], next[1] - start[1]] },
						{ coalesce: token },
					);
				}
				return;
			}
			useEditor.getState().moveAreaPoint(areaId, index, next, { coalesce: token });
		},
	});

	return (
		<group
			position={[point[0], y + HANDLE_LIFT, point[1]]}
			ref={handle}
			{...drag}
			onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				useEditor.getState().removeAreaPoint(areaId, index);
			}}
			onClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				const state = group.current;
				group.current = null;
				if (!isClick(e)) {
					return;
				}
				const store = useEditor.getState();
				if (isToggleClick(e.nativeEvent)) {
					store.togglePoint(index);
				} else if (state?.keepsOthers && !state.start) {
					store.selectAreaPoint(areaId, index);
				}
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
				<cylinderGeometry args={[0.4, 0.4, 0.06, 4]} />

				<meshBasicMaterial color={palette.selection} />
			</mesh>

			<mesh position={[0, 0.02, 0]}>
				<cylinderGeometry args={[0.26, 0.26, 0.06, 4]} />

				<meshBasicMaterial color={selected ? palette.selection : "#ffffff"} />
			</mesh>
		</group>
	);
};

/** Small dot halfway along an edge: drag it to add a corner there. Hidden while a handle is dragged. */
const InsertHandle = ({
	areaId,
	index,
	point,
	y,
	visible,
}: {
	areaId: string;
	index: number;
	point: TVec2;
	y: number;
	visible: boolean;
}) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Mesh>(HANDLE_PX, hovered ? 1.3 : 1);
	const drag = useGroundDrag({
		planeY: y,
		onStart: (token) => {
			const store = useEditor.getState();
			store.insertAreaPoint(areaId, index + 1, point, { coalesce: token });
			store.selectAreaPoint(areaId, index + 1);
			return true;
		},
		onMove: (next, token) =>
			useEditor.getState().moveAreaPoint(areaId, index + 1, next, { coalesce: token }),
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

const CORNER_HANDLES: TGizmoHandle[] = ["x", "z", "xz", "y"];
/** Water stays level: its corners only move along the ground (the Corner panel says why). */
const LEVEL_CORNER_HANDLES: TGizmoHandle[] = ["x", "z", "xz"];

/**
 * The move gizmo on the selected corners (ADR-0065, ADR-0096), at their
 * middle on the top: along the ground, and up or down with the green arrow.
 */
const CornersGizmo = ({ baseY }: { baseY: number }) => {
	const start = useRef<IPointsStart | null>(null);
	const area = useEditor(selectSelectedArea);
	const indices = useEditor((s) => s.selectedPointIndices);
	// From what it subscribes to, so it follows the corners it moves (ADR-0093).
	const center = useMemo(
		() => (area ? (pointsStartOf({ area }, indices)?.center ?? null) : null),
		[area, indices],
	);
	if (!center) {
		return null;
	}

	return (
		<group position={[center[0], baseY + center[1], center[2]]}>
			<TransformGizmo
				handles={area && takesCornerHeights(area) ? CORNER_HANDLES : LEVEL_CORNER_HANDLES}
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

/** Corner and insert handles for the selected area (edit mode only). */
export const AreaHandles = () => {
	const area = useEditor(selectSelectedArea);
	// Its points are edited on their own, not while it's one of several selected things.
	const several = useEditor(selectSeveral);
	const layer = useEditor((s) => s.scene.areas.findIndex((a) => a.id === s.selectedAreaId));
	const selectedPoints = useEditor((s) => s.selectedPointIndices);
	// A selection box being drawn over its corners (ADR-0065): what letting go would select.
	const boxDrag = useEditor((s) => s.boxDrag);
	const mode = useEditor(drawnModeOf);
	const drawing = useEditor((s) => s.drawing !== null);
	const dragging = useEditor((s) => s.dragging);

	if (!area || several || mode !== "edit" || drawing || area.hidden || area.locked) {
		return null;
	}
	const baseY = areaBaseY(Math.max(0, layer));
	// Each corner's handle stands on the top there; the dots between them halfway up the side.
	const tops = area.points.map((point) => cornerTop(area, point));

	return (
		<group>
			{area.points.map((point, index) => {
				const next = (index + 1) % area.points.length;
				const after = area.points[next];
				return (
					<InsertHandle
						// biome-ignore lint/suspicious/noArrayIndexKey: one per side, by position
						key={`insert-${index}`}
						areaId={area.id}
						index={index}
						point={[(point[0] + after[0]) / 2, (point[1] + after[1]) / 2]}
						y={baseY + (tops[index] + tops[next]) / 2}
						visible={!dragging}
					/>
				);
			})}

			{/* Kept while dragging: the gizmo's own drag sets dragging, and unmounting it ends the drag. */}
			{selectedPoints.length > 0 && <CornersGizmo baseY={baseY} />}

			{area.points.map((point, index) => (
				<CornerHandle
					// biome-ignore lint/suspicious/noArrayIndexKey: handles are positional; keeping the instance during a drag matters
					key={index}
					areaId={area.id}
					index={index}
					point={point}
					y={baseY + tops[index]}
					selected={
						selectedPoints.includes(index) && !(boxDrag?.removing && boxDrag.points.includes(index))
					}
					boxed={!boxDrag?.removing && (boxDrag?.points.includes(index) ?? false)}
				/>
			))}
		</group>
	);
};
