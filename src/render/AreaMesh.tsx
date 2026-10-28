import { Line } from "@react-three/drei";
import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useGraphics } from "#/editor/graphics";
import { drawnModeOf, isItemBoxed, isItemSelected, isToggleClick, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { isClick } from "#/lib/pointer";
import {
	AREA_TYPES,
	areaColor,
	cornerTop,
	isRaised,
	type TAreaShape,
	topSurface,
	triangulateOutline,
	waterSeams,
} from "#/scene/areas";
import type { TArea, TWater } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { openAreaMenuOnClick } from "./contextMenu";
import { ReflectiveWaterMaterial } from "./Water";

const NO_SEAMS: [number, number, number, number][] = [];
/** Materials that the weather's snow and wetness leave alone (render/Weather). */
const NO_WEATHER = { noWeather: true };

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

/**
 * A raised area as a solid (ADR-0096): its top cut into triangles between its
 * corners, each corner at its own height, flat-shaded; its sides down to the
 * ground (gone where both corners of a side are on the ground, so a corner at
 * 0 makes a ramp); and a bottom, which shadows need. Two material groups like
 * an extrusion's: the top, then the sides and bottom. Without its top for
 * raised water, whose mirroring surface is drawn on its own.
 */
const solidGeometry = (area: TAreaShape, withTop = true) => {
	const { points } = area;
	const tops = points.map((point) => cornerTop(area, point));
	// The top over its corners and its peaks inside (ADR-0101).
	const surface = topSurface(area);
	const top: number[] = [];
	const rest: number[] = [];
	const triangle = (list: number[], a: number[], b: number[], c: number[], up: boolean) => {
		// Wound so its face looks the way it should (up for the top, down for the bottom).
		const normalY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
		list.push(...(normalY > 0 === up ? [...a, ...b, ...c] : [...a, ...c, ...b]));
	};
	const corner = (i: number, y: number) => [points[i][0], y, points[i][1]];
	const onTop = (i: number) => [surface.points[i][0], surface.tops[i], surface.points[i][1]];
	if (withTop) {
		for (const [a, b, c] of surface.triangles) {
			triangle(top, onTop(a), onTop(b), onTop(c), true);
		}
	}
	for (const [a, b, c] of triangulateOutline(points)) {
		triangle(rest, corner(a, 0), corner(b, 0), corner(c, 0), false);
	}
	// Sides face out, whichever way the outline turns.
	let turning = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, z1] = points[i];
		const [x2, z2] = points[(i + 1) % points.length];
		turning += x1 * z2 - x2 * z1;
	}
	for (let i = 0; i < points.length; i++) {
		const j = (i + 1) % points.length;
		if (tops[i] === 0 && tops[j] === 0) {
			continue;
		}
		const [a, b, c, d] = [corner(i, 0), corner(j, 0), corner(j, tops[j]), corner(i, tops[i])];
		const quad = turning > 0 ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
		rest.push(...quad.flat());
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute([...top, ...rest], 3));
	geometry.addGroup(0, top.length / 3, 0);
	geometry.addGroup(top.length / 3, rest.length / 3, 1);
	geometry.computeVertexNormals();
	return geometry;
};

type TAreaHandlers = Pick<ThreeElements["mesh"], "onClick" | "onContextMenu" | "onDoubleClick">;

interface IAreaBodyProps {
	area: TArea;
	/** Draw order among areas; later areas sit on top where they overlap. */
	layer: number;
	palette: IScenePalette;
	/** Outlined as the selection. */
	selected: boolean;
	handlers?: TAreaHandlers;
	/** Water mirrors the world (Graphics: Water reflections); only in the editor's view. */
	reflective?: boolean;
	/** The world's water, for a water area that doesn't set its own ripples and reflections. */
	worldWater?: TWater;
	/** Where a water area meets other water (scene/areas: waterSeams). */
	waterSeams?: [number, number, number, number][];
}

/**
 * How an area looks, from its props alone: a flat coloured polygon, or raised
 * land with cliff sides. The editor's AreaMesh adds the selection and clicks,
 * and world pictures (scenePictures) use it as is.
 */
export const AreaBody = ({
	area,
	layer,
	palette,
	selected,
	handlers = {},
	reflective = false,
	worldWater = { rippleStrength: 0.5, reflectionStrength: 0.5 },
	waterSeams = NO_SEAMS,
}: IAreaBodyProps) => {
	const y = areaBaseY(layer);
	const raised = isRaised(area);
	// Water stays level (ADR-0096), so it mirrors raised too: its surface on top of cliff sides.
	const mirrors = reflective && area.type === "water_01";
	const geometry = useMemo(() => {
		if (raised && !mirrors) {
			return solidGeometry(area);
		}
		const geo = new THREE.ShapeGeometry(outlineShape(area.points));
		// A reflector finds its mirror's plane from its mesh's turn, so a mirroring one is turned there.
		if (!mirrors) {
			geo.rotateX(-Math.PI / 2);
		}
		return geo;
	}, [area.points, area.peaks, area.height, area.type, raised, mirrors]);
	useLayoutEffect(() => () => geometry.dispose(), [geometry]);
	const sides = useMemo(
		() => (raised && mirrors ? solidGeometry(area, false) : null),
		[area.points, area.height, area.type, raised, mirrors],
	);
	useLayoutEffect(() => () => sides?.dispose(), [sides]);

	const outline = useMemo(
		() =>
			[...area.points, area.points[0]].map(
				(point) =>
					[point[0], y + cornerTop(area, point) + 0.03, point[1]] as [number, number, number],
			),
		[area.points, area.height, y],
	);

	const color = areaColor(area, palette);

	return (
		<group>
			<mesh
				// A new mesh when it turns solid or flat: swapping one material for a top and sides on the
				// same mesh leaves its list of materials half-filled, which breaks drawing and clicks.
				key={mirrors ? "mirror" : raised ? "solid" : "flat"}
				geometry={geometry}
				position={[0, y + (mirrors && raised ? area.height : 0), 0]}
				// Set both ways: a prop that goes back to undefined keeps its last value in R3F.
				rotation={mirrors ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}
				receiveShadow
				castShadow={raised && !mirrors}
				{...handlers}
			>
				{raised && !mirrors ? (
					// Two material groups: the top, then the sides and bottom (solidGeometry).
					<>
						<meshStandardMaterial attach="material-0" color={color} roughness={0.95} flatShading />

						<meshStandardMaterial
							attach="material-1"
							color={palette.cliff}
							roughness={1}
							flatShading
						/>
					</>
				) : mirrors ? (
					<ReflectiveWaterMaterial
						color={color}
						roughness={AREA_TYPES[area.type].roughness}
						world={worldWater}
						seams={waterSeams}
						rippleStrength={area.rippleStrength ?? worldWater.rippleStrength}
						reflectionStrength={area.reflectionStrength ?? worldWater.reflectionStrength}
					/>
				) : (
					<meshStandardMaterial
						color={color}
						roughness={AREA_TYPES[area.type].roughness}
						polygonOffset
						polygonOffsetFactor={-1}
						// Water takes no snow or wetness (ADR-0102).
						userData={area.type === "water_01" ? NO_WEATHER : undefined}
					/>
				)}
			</mesh>

			{/* Raised water that mirrors: its cliff sides, under its surface. */}
			{sides && (
				<mesh geometry={sides} position={[0, y, 0]} receiveShadow castShadow {...handlers}>
					<meshStandardMaterial attach="material-0" color={color} />

					<meshStandardMaterial
						attach="material-1"
						color={palette.cliff}
						roughness={1}
						flatShading
					/>
				</mesh>
			)}

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
	const reflective = useGraphics().showWaterReflections;
	const worldWater = useEditor((s) => s.scene.water);
	const areas = useEditor((s) => s.scene.areas);
	const seams = useMemo(
		() => (reflective && area.type === "water_01" ? waterSeams(area, areas) : NO_SEAMS),
		[reflective, area, areas],
	);
	const palette = usePalette();
	const mode = useEditor(drawnModeOf);
	// A box being drawn that would take it out of the selection shows it dashed instead (HoverHighlight).
	const selected = useEditor(
		(s) =>
			isItemSelected(s, "area", area.id) &&
			!(s.boxDrag?.removing && isItemBoxed(s, "area", area.id)),
	);
	const drawing = useEditor((s) => s.drawing !== null);
	const selectArea = useEditor((s) => s.selectArea);

	const editable = mode === "edit" && !drawing;
	// Whether it was the one selected thing at each of the last two clicks: a double-click adds a peak
	// only to an area already selected before it, not to one the double-click itself selects.
	const clicks = useRef({ previous: false, last: false });
	const handlers: TAreaHandlers = editable
		? {
				onClick: (e: ThreeEvent<MouseEvent>) => {
					// Stop here so the ground behind doesn't deselect, even after a camera drag.
					e.stopPropagation();
					if (!isClick(e)) {
						return;
					}
					const state = useEditor.getState();
					clicks.current = {
						previous: clicks.current.last,
						last: state.selectedAreaId === area.id && state.selectedItems.length === 1,
					};
					if (isToggleClick(e.nativeEvent)) {
						useEditor.getState().toggleSelected({ kind: "area", id: area.id });
					} else {
						selectArea(area.id);
					}
				},
				onContextMenu: openAreaMenuOnClick(area.id),
				// Double-click the selected area: a peak there (ADR-0101).
				onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
					e.stopPropagation();
					if (clicks.current.previous && !area.locked) {
						useEditor.getState().addAreaPeak(area.id, [e.point.x, e.point.z]);
					}
				},
			}
		: {};

	return (
		<AreaBody
			area={area}
			layer={layer}
			palette={palette}
			selected={selected && mode === "edit"}
			handlers={handlers}
			reflective={reflective}
			worldWater={worldWater}
			waterSeams={seams}
		/>
	);
});
