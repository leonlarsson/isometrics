import { Line } from "@react-three/drei";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { isClick } from "#/lib/pointer";
import { groundHeightAt, worldExtentOf } from "#/scene/grounds";
import { roadAnchorAt, type TRoadAnchor } from "#/scene/junctions";
import type { TVec2 } from "#/scene/schema";

import { groundPointFrom, surfacePointFrom } from "./useGroundDrag";

const PREVIEW_Y = 0.15;
/** Clicking within this distance of the first point closes the loop. */
const CLOSE_DISTANCE = 0.8;

const toV3 = (p: readonly number[]): [number, number, number] => [
	p[0],
	PREVIEW_Y + (p[2] ?? 0),
	p[1],
];

/**
 * Active while a road is being drawn: an invisible plane over the ground
 * catches clicks (each adds a point), with a live preview to the cursor.
 * Enter/Escape/Backspace are handled by ui/DrawingBar. A new road's points
 * snap onto other roads' ends and onto other roads (a ring shows where; Alt
 * doesn't snap): its first point starts there, and a later one ends the road
 * there, connected at a junction (ADR-0136).
 */
export const RoadDrawTool = () => {
	const drawing = useEditor((s) => s.drawing);
	const ground = useEditor((s) => worldExtentOf(s.scene.grounds));
	const areas = useEditor((s) => s.scene.areas);
	const grounds = useEditor((s) => s.scene.grounds);
	const roads = useEditor((s) => s.scene.roads);
	const palette = usePalette();
	const canvas = useThree((s) => s.gl.domElement);
	const [cursor, setCursor] = useState<TVec2 | null>(null);
	const [anchor, setAnchor] = useState<TRoadAnchor | null>(null);

	const active = drawing !== null;
	useEffect(() => {
		canvas.style.cursor = active ? "crosshair" : "";
		return () => {
			canvas.style.cursor = "";
		};
	}, [active, canvas]);

	if (!drawing) {
		return null;
	}

	const { points } = drawing;
	const first = points[0];
	// New points continue at the last point's height, so the cursor works on that plane.
	const drawHeight = points.at(-1)?.[2] ?? 0;
	const isFence = drawing.target === "fence";
	// A new road (not one being continued) connects where it starts and ends on another road.
	const connects = drawing.target === "road" && !drawing.roadId;
	// Roads and fences are kept on a ground; an area, which draws its own ground, within the world.
	const pointAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
		isFence
			? surfacePointFrom(e, drawHeight)
			: groundPointFrom(e, drawHeight, drawing.target === "area" ? "world" : "land");
	const anchorAt = (e: ThreeEvent<PointerEvent | MouseEvent>, point: TVec2 | null) =>
		connects && point && !e.nativeEvent.altKey
			? roadAnchorAt(roads, point, { endReach: CLOSE_DISTANCE, onRoad: true })
			: null;
	// A fence's points stand on the ground (ADR-0103): picked and drawn on the ground under them.
	const at = (p: readonly number[]) =>
		isFence
			? toV3([p[0], p[1], groundHeightAt({ areas, grounds }, [p[0], p[1]]) + (p[2] ?? 0)])
			: toV3(p);
	const cursorPoint: readonly number[] | null = cursor ? [cursor[0], cursor[1], drawHeight] : null;
	const nearFirst =
		cursor !== null &&
		points.length > 2 &&
		Math.hypot(cursor[0] - first[0], cursor[1] - first[1]) < CLOSE_DISTANCE;
	const snapped = !nearFirst && anchor ? anchor.point : null;
	const open: (readonly number[])[] =
		cursorPoint && points.length > 0 ? [...points, nearFirst ? first : cursorPoint] : points;
	// Areas are always closed shapes, so preview the edge back to the first point too.
	const preview =
		drawing.target === "area" && open.length > 2 && !nearFirst ? [...open, first] : open;

	return (
		<group>
			<mesh
				rotation={[-Math.PI / 2, 0, 0]}
				position={[0, 0.001, 0]}
				onPointerMove={(e: ThreeEvent<PointerEvent>) => {
					const point = pointAt(e);
					const onto = anchorAt(e, point);
					setAnchor(onto);
					setCursor(onto ? [onto.point[0], onto.point[1]] : point);
				}}
				onPointerOut={() => {
					setCursor(null);
					setAnchor(null);
				}}
				onClick={(e: ThreeEvent<MouseEvent>) => {
					// A drag is a camera orbit, not a click.
					if (!isClick(e)) {
						return;
					}
					e.stopPropagation();
					if (nearFirst) {
						useEditor.getState().finishDrawing({ loops: true });
						return;
					}
					const point = pointAt(e);
					const onto = anchorAt(e, point);
					if (onto) {
						// Onto another road: start there, or end there, connected.
						const store = useEditor.getState();
						store.addDrawingPoint([onto.point[0], onto.point[1]]);
						if (points.length > 0) {
							store.finishDrawing();
						}
						setAnchor(null);
					} else if (point) {
						useEditor.getState().addDrawingPoint(point);
					}
				}}
				onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
					e.stopPropagation();
					useEditor.getState().finishDrawing();
				}}
			>
				<planeGeometry args={[ground.width, ground.depth]} />

				<meshBasicMaterial transparent opacity={0} depthWrite={false} />
			</mesh>

			{preview.length > 1 && (
				<Line
					points={preview.map(at)}
					color={palette.selection}
					lineWidth={3}
					dashed
					dashSize={0.4}
					gapSize={0.2}
				/>
			)}

			{points.map((point, i) => (
				<mesh
					// biome-ignore lint/suspicious/noArrayIndexKey: drawn points are positional
					key={i}
					position={at(point)}
					scale={i === 0 && nearFirst ? 1.6 : 1}
				>
					<cylinderGeometry args={[0.22, 0.22, 0.05, 20]} />

					<meshBasicMaterial color={i === 0 ? palette.selection : "#ffffff"} />
				</mesh>
			))}

			{cursorPoint && !nearFirst && !snapped && (
				<mesh position={at(cursorPoint)}>
					<cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />

					<meshBasicMaterial color={palette.selection} transparent opacity={0.6} />
				</mesh>
			)}

			{/* Where it would connect to another road (ADR-0136). */}
			{snapped && (
				<mesh position={toV3(snapped)} rotation={[-Math.PI / 2, 0, 0]}>
					<ringGeometry args={[0.45, 0.65, 32]} />

					<meshBasicMaterial color={palette.selection} />
				</mesh>
			)}
		</group>
	);
};
