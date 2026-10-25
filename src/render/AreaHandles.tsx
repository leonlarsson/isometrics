import type { ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import type * as THREE from "three";

import { selectSelectedArea, selectSeveral, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { segmentMidpoints } from "#/scene/roads";
import type { TVec2 } from "#/scene/schema";

import { areaBaseY } from "./AreaMesh";
import { useGroundDrag } from "./useGroundDrag";
import { useScreenScale } from "./useScreenScale";

const HANDLE_LIFT = 0.12;
/** Handle geometry is in screen units of this many pixels, so handles keep their size at any zoom. */
const HANDLE_PX = 24;

interface ICornerHandleProps {
	areaId: string;
	index: number;
	point: TVec2;
	y: number;
	selected: boolean;
}

/** A corner: click to select, drag to move, double-click to remove (an area keeps three). */
const CornerHandle = ({ areaId, index, point, y, selected }: ICornerHandleProps) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const handle = useScreenScale<THREE.Group>(HANDLE_PX, hovered || selected ? 1.2 : 1);
	const drag = useGroundDrag({
		planeY: y,
		onStart: () => {
			useEditor.getState().selectAreaPoint(areaId, index);
			return true;
		},
		onMove: (next, token) =>
			useEditor.getState().moveAreaPoint(areaId, index, next, { coalesce: token }),
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

/** Corner and insert handles for the selected area (edit mode only). */
export const AreaHandles = () => {
	const area = useEditor(selectSelectedArea);
	// Its points are edited on their own, not while it's one of several selected things.
	const several = useEditor(selectSeveral);
	const layer = useEditor((s) => s.scene.areas.findIndex((a) => a.id === s.selectedAreaId));
	const selectedPoint = useEditor((s) => s.selectedPointIndex);
	const mode = useEditor((s) => s.mode);
	const drawing = useEditor((s) => s.drawing !== null);
	const dragging = useEditor((s) => s.dragging);

	if (!area || several || mode !== "edit" || drawing || area.hidden || area.locked) {
		return null;
	}
	const y = areaBaseY(Math.max(0, layer)) + area.height;

	return (
		<group>
			{segmentMidpoints(area.points, true).map(({ index, point }) => (
				<InsertHandle
					key={`insert-${index}`}
					areaId={area.id}
					index={index}
					point={[point[0], point[1]]}
					y={y}
					visible={!dragging}
				/>
			))}

			{area.points.map((point, index) => (
				<CornerHandle
					// biome-ignore lint/suspicious/noArrayIndexKey: handles are positional; keeping the instance during a drag matters
					key={index}
					areaId={area.id}
					index={index}
					point={point}
					y={y}
					selected={selectedPoint === index}
				/>
			))}
		</group>
	);
};
