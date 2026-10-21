import { Line } from "@react-three/drei";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import type { TVec2 } from "#/scene/schema";

import { groundPointFrom } from "./useGroundDrag";

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
 * Enter/Escape/Backspace are handled by ui/DrawingBar.
 */
export const RoadDrawTool = () => {
	const drawing = useEditor((s) => s.drawing);
	const ground = useEditor((s) => s.scene.ground);
	const palette = usePalette();
	const canvas = useThree((s) => s.gl.domElement);
	const [cursor, setCursor] = useState<TVec2 | null>(null);

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
	const cursorPoint: readonly number[] | null = cursor ? [cursor[0], cursor[1], drawHeight] : null;
	const nearFirst =
		cursor !== null &&
		points.length > 2 &&
		Math.hypot(cursor[0] - first[0], cursor[1] - first[1]) < CLOSE_DISTANCE;
	const preview: (readonly number[])[] =
		cursorPoint && points.length > 0 ? [...points, nearFirst ? first : cursorPoint] : points;

	return (
		<group>
			<mesh
				rotation={[-Math.PI / 2, 0, 0]}
				position={[0, 0.001, 0]}
				onPointerMove={(e: ThreeEvent<PointerEvent>) => setCursor(groundPointFrom(e, drawHeight))}
				onPointerOut={() => setCursor(null)}
				onClick={(e: ThreeEvent<MouseEvent>) => {
					// A drag is a camera orbit, not a click.
					if (e.delta > 5) {
						return;
					}
					e.stopPropagation();
					if (nearFirst) {
						useEditor.getState().finishDrawing({ closed: true });
						return;
					}
					const point = groundPointFrom(e, drawHeight);
					if (point) {
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
					points={preview.map(toV3)}
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
					position={toV3(point)}
					scale={i === 0 && nearFirst ? 1.6 : 1}
				>
					<cylinderGeometry args={[0.22, 0.22, 0.05, 20]} />

					<meshBasicMaterial color={i === 0 ? palette.selection : "#ffffff"} />
				</mesh>
			))}

			{cursorPoint && !nearFirst && (
				<mesh position={toV3(cursorPoint)}>
					<cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />

					<meshBasicMaterial color={palette.selection} transparent opacity={0.6} />
				</mesh>
			)}
		</group>
	);
};
