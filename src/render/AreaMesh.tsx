import { Line } from "@react-three/drei";
import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { isItemBoxed, isItemSelected, isToggleClick, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { isClick } from "#/lib/pointer";
import { AREA_TYPES, areaColor } from "#/scene/areas";
import type { TArea } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { openContextMenuOnClick } from "./contextMenu";

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

type TAreaHandlers = Pick<ThreeElements["mesh"], "onClick" | "onContextMenu">;

interface IAreaBodyProps {
	area: TArea;
	/** Draw order among areas; later areas sit on top where they overlap. */
	layer: number;
	palette: IScenePalette;
	/** Outlined as the selection. */
	selected: boolean;
	handlers?: TAreaHandlers;
}

/**
 * How an area looks, from its props alone: a flat coloured polygon, or raised
 * land with cliff sides. The editor's AreaMesh adds the selection and clicks,
 * and world pictures (scenePictures) use it as is.
 */
export const AreaBody = ({ area, layer, palette, selected, handlers = {} }: IAreaBodyProps) => {
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
						roughness={AREA_TYPES[area.type].roughness}
						polygonOffset
						polygonOffsetFactor={-1}
					/>
				)}
			</mesh>

			{selected && <Line points={outline} color={palette.selection} lineWidth={3} />}
		</group>
	);
};

interface IAreaMeshProps {
	area: TArea;
	/** Draw order among areas; later areas sit on top where they overlap. */
	layer: number;
}

/** An area in the editor: selectable while editing. */
export const AreaMesh = memo(({ area, layer }: IAreaMeshProps) => {
	const palette = usePalette();
	const mode = useEditor((s) => s.mode);
	// A box being drawn that would take it out of the selection shows it dashed instead (HoverHighlight).
	const selected = useEditor(
		(s) =>
			isItemSelected(s, "area", area.id) &&
			!(s.boxDrag?.removing && isItemBoxed(s, "area", area.id)),
	);
	const drawing = useEditor((s) => s.drawing !== null);
	const selectArea = useEditor((s) => s.selectArea);

	const editable = mode === "edit" && !drawing;
	const handlers: TAreaHandlers = editable
		? {
				onClick: (e: ThreeEvent<MouseEvent>) => {
					// Stop here so the ground behind doesn't deselect, even after a camera drag.
					e.stopPropagation();
					if (!isClick(e)) {
						return;
					}
					if (isToggleClick(e.nativeEvent)) {
						useEditor.getState().toggleSelected({ kind: "area", id: area.id });
					} else {
						selectArea(area.id);
					}
				},
				onContextMenu: openContextMenuOnClick({ kind: "area", id: area.id }),
			}
		: {};

	return (
		<AreaBody
			area={area}
			layer={layer}
			palette={palette}
			selected={selected && mode === "edit"}
			handlers={handlers}
		/>
	);
});
