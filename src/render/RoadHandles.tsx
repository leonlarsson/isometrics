import type { ThreeEvent } from "@react-three/fiber";
import { useState } from "react";

import { selectSelectedRoad, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { segmentMidpoints } from "#/scene/roads";
import type { TVec2 } from "#/scene/schema";

import { useGroundDrag } from "./useGroundDrag";

const HANDLE_Y = 0.12;

interface IPointHandleProps {
	roadId: string;
	index: number;
	point: TVec2;
	canRemove: boolean;
}

/** Draggable control point. Double-click removes it (a road keeps at least two). */
const PointHandle = ({ roadId, index, point, canRemove }: IPointHandleProps) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const drag = useGroundDrag({
		onMove: (next, token) =>
			useEditor.getState().moveRoadPoint(roadId, index, next, { coalesce: token }),
	});

	return (
		<group
			position={[point[0], HANDLE_Y, point[1]]}
			scale={hovered ? 1.2 : 1}
			{...drag}
			onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				if (canRemove) {
					useEditor.getState().removeRoadPoint(roadId, index);
				}
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

				<meshBasicMaterial color="#ffffff" />
			</mesh>
		</group>
	);
};

interface IInsertHandleProps {
	roadId: string;
	/** Index of the segment's first point; the new point goes after it. */
	index: number;
	point: TVec2;
}

/** Small handle halfway along a segment: drag it to add a point there. */
const InsertHandle = ({ roadId, index, point }: IInsertHandleProps) => {
	const palette = usePalette();
	const [hovered, setHovered] = useState(false);
	const drag = useGroundDrag({
		onStart: (token) => {
			useEditor.getState().insertRoadPoint(roadId, index + 1, point, { coalesce: token });
			return true;
		},
		onMove: (next, token) =>
			useEditor.getState().moveRoadPoint(roadId, index + 1, next, { coalesce: token }),
	});

	return (
		<mesh
			position={[point[0], HANDLE_Y, point[1]]}
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

/** Point and insert handles for the selected road (edit mode only). */
export const RoadHandles = () => {
	const road = useEditor(selectSelectedRoad);
	const mode = useEditor((s) => s.mode);
	const drawing = useEditor((s) => s.drawing !== null);

	if (!road || mode !== "edit" || drawing) {
		return null;
	}

	return (
		<group>
			{segmentMidpoints(road.points, road.closed).map(({ index, point }) => (
				<InsertHandle key={`insert-${index}`} roadId={road.id} index={index} point={point} />
			))}

			{road.points.map((point, index) => (
				<PointHandle
					// biome-ignore lint/suspicious/noArrayIndexKey: handles are positional; keeping the instance during a drag matters
					key={index}
					roadId={road.id}
					index={index}
					point={point}
					canRemove={road.points.length > 2}
				/>
			))}
		</group>
	);
};
