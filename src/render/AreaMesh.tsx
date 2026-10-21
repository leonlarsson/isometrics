import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { areaColor } from "#/scene/areas";
import type { TArea } from "#/scene/schema";

/** Flat areas sit just above the ground and below roads (roads start at 0.012). */
const BASE_Y = 0.004;
const LAYER_STEP = 0.0008;

export const areaBaseY = (layer: number) => BASE_Y + layer * LAYER_STEP;

/**
 * The outline as a three.js Shape. Shapes live in the XY plane; we use
 * (x, -z) so that rotating -90° about X lays it on the ground at (x, z).
 */
const outlineShape = (points: TArea["points"]) => {
	const shape = new THREE.Shape();
	points.forEach(([x, z], i) => {
		if (i === 0) {
			shape.moveTo(x, -z);
		} else {
			shape.lineTo(x, -z);
		}
	});
	shape.closePath();
	return shape;
};

interface IAreaMeshProps {
	area: TArea;
	/** Draw order among areas; later areas sit on top where they overlap. */
	layer: number;
}

/** A free-form area: a flat coloured polygon, or raised land with cliff sides. */
export const AreaMesh = memo(({ area, layer }: IAreaMeshProps) => {
	const palette = usePalette();
	const mode = useEditor((s) => s.mode);
	const selected = useEditor((s) => s.selectedAreaId === area.id);
	const drawing = useEditor((s) => s.drawing !== null);
	const selectArea = useEditor((s) => s.selectArea);

	const y = areaBaseY(layer);
	const raised = area.height > 0;
	const geometry = useMemo(() => {
		const shape = outlineShape(area.points);
		const geo = raised
			? new THREE.ExtrudeGeometry(shape, { depth: area.height, bevelEnabled: false })
			: new THREE.ShapeGeometry(shape);
		geo.rotateX(-Math.PI / 2);
		return geo;
	}, [area.points, area.height, raised]);
	useLayoutEffect(() => () => geometry.dispose(), [geometry]);

	const outline = useMemo(() => {
		const top = y + area.height + 0.03;
		return [...area.points, area.points[0]].map(
			([x, z]) => [x, top, z] as [number, number, number],
		);
	}, [area.points, area.height, y]);

	const color = areaColor(area, palette);
	const editable = mode === "edit" && !drawing;
	const handlers = editable
		? {
				onPointerDown: (e: ThreeEvent<PointerEvent>) => {
					if (e.nativeEvent.button !== 0) {
						return;
					}
					e.stopPropagation();
					selectArea(area.id);
				},
				// Stop clicks reaching the ground, which would deselect.
				onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
			}
		: {};

	return (
		<group>
			<mesh
				geometry={geometry}
				position={[0, y, 0]}
				receiveShadow
				castShadow={raised}
				{...handlers}
			>
				{raised ? (
					// ExtrudeGeometry has two material groups: the caps (top/bottom) and the sides.
					<>
						<meshStandardMaterial attach="material-0" color={color} roughness={0.95} />

						<meshStandardMaterial attach="material-1" color={palette.cliff} roughness={1} />
					</>
				) : (
					<meshStandardMaterial
						color={color}
						roughness={area.type === "water" ? 0.4 : 0.95}
						polygonOffset
						polygonOffsetFactor={-1}
					/>
				)}
			</mesh>

			{selected && mode === "edit" && (
				<Line points={outline} color={palette.selection} lineWidth={3} />
			)}
		</group>
	);
});
