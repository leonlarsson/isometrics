import { Line } from "@react-three/drei";
import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { isClick } from "#/lib/pointer";
import {
	buildElevatedSides,
	buildRibbon,
	DECK_THICKNESS,
	dashPolyline,
	type IWall,
	pillarPositions,
	roadCenterlineOf,
} from "#/scene/roads";
import type { TRoad, TRoadPoint } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { openContextMenuOnClick } from "./contextMenu";

/** Each road sits slightly above the previous one so overlapping junctions don't flicker. */
const BASE_Y = 0.012;
const LAYER_STEP = 0.003;
const MARKING_DASH = 0.6;
const MARKING_GAP = 0.6;
const MARKING_HALF_WIDTH = 0.05;
const PILLAR_SIZE = 0.45;

/** Build one BufferGeometry from several ribbons; each vertex sits at `y` plus its height. */
const ribbonGeometry = (
	ribbons: { center: TRoadPoint[]; halfWidth: number; closed: boolean }[],
	y: number,
) => {
	const positions: number[] = [];
	const normals: number[] = [];
	const indices: number[] = [];
	for (const { center, halfWidth, closed } of ribbons) {
		const ribbon = buildRibbon(center, halfWidth, closed);
		const base = positions.length / 3;
		ribbon.vertices.forEach(([x, z, h], i) => {
			positions.push(x, y + h, z);
			normals.push(...ribbon.normals[i]);
		});
		for (const index of ribbon.indices) {
			indices.push(base + index);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
	geometry.setIndex(indices);
	return geometry;
};

/** Two triangles per quad (top-a, top-b, bottom-a, bottom-b), shifted up by `y`. */
const wallGeometry = (wall: IWall, y: number) => {
	const positions: number[] = [];
	for (const [ta, tb, ba, bb] of wall.quads) {
		for (const [px, py, pz] of [ta, tb, ba, ba, tb, bb]) {
			positions.push(px, py + y, pz);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	geometry.computeVertexNormals();
	return geometry;
};

const useDisposable = (geometry: THREE.BufferGeometry) => {
	useLayoutEffect(() => () => geometry.dispose(), [geometry]);
	return geometry;
};

export const roadColor = (road: TRoad, palette: IScenePalette) =>
	road.color ?? (road.style === "dirt" ? palette.dirt : palette.road);

/** Height of the road surface above the ground plane for a given layer. */
export const roadBaseY = (layer: number) => BASE_Y + layer * LAYER_STEP;

type TRoadHandlers = Pick<
	ThreeElements["mesh"],
	"onClick" | "onPointerOver" | "onPointerOut" | "onContextMenu"
>;

interface IRoadBodyProps {
	road: TRoad;
	/** Draw order among roads; later roads sit on top at junctions. */
	layer: number;
	palette: IScenePalette;
	ground: { width: number; depth: number };
	/** Hidden routes show as a dashed line while editing; otherwise they draw nothing. */
	editing: boolean;
	/** Outlined as the selection. */
	selected: boolean;
	handlers?: TRoadHandlers;
}

/**
 * How a road looks, from its props alone: the editor's RoadMesh adds the
 * selection and clicks, and world pictures (scenePictures) use it as is.
 */
export const RoadBody = ({
	road,
	layer,
	palette,
	ground,
	editing,
	selected,
	handlers = {},
}: IRoadBodyProps) => {
	const groundWidth = ground.width;
	const groundDepth = ground.depth;
	const hidden = road.style === "hidden";
	const y = roadBaseY(layer);
	const center = useMemo(() => roadCenterlineOf(road), [road]);

	const surface = useDisposable(
		useMemo(
			() => ribbonGeometry([{ center, halfWidth: road.width / 2, closed: road.closed }], y),
			[center, road.width, road.closed, y],
		),
	);
	const markings = useDisposable(
		useMemo(
			() =>
				ribbonGeometry(
					dashPolyline(center, road.closed, MARKING_DASH, MARKING_GAP).map((dash) => ({
						center: dash,
						halfWidth: MARKING_HALF_WIDTH,
						closed: false,
					})),
					y + 0.002,
				),
			[center, road.closed, y],
		),
	);
	const sides = useMemo(
		() =>
			buildElevatedSides(center, road.closed, road.width / 2, {
				railings: road.railings && !hidden,
				embankment: road.supports === "embankment" && !hidden,
				embankmentAngle: road.embankmentAngle,
				embankmentWidth: road.embankmentWidth,
				bounds: [groundWidth / 2, groundDepth / 2],
			}),
		[
			center,
			road.closed,
			road.width,
			road.railings,
			road.supports,
			road.embankmentAngle,
			road.embankmentWidth,
			hidden,
			groundWidth,
			groundDepth,
		],
	);
	const deck = useDisposable(useMemo(() => wallGeometry(sides.deck, y), [sides, y]));
	const railings = useDisposable(useMemo(() => wallGeometry(sides.railings, y), [sides, y]));
	const embankment = useDisposable(useMemo(() => wallGeometry(sides.embankment, y), [sides, y]));
	const pillars = useMemo(
		() =>
			road.supports === "pillars" && !hidden
				? pillarPositions(center, road.closed, road.pillarSpacing)
				: [],
		[center, road.closed, road.supports, road.pillarSpacing, hidden],
	);

	const outline = useMemo(() => {
		const pts = center.map(([x, z, h]) => [x, y + h + 0.03, z] as [number, number, number]);
		if (road.closed && pts.length > 2) {
			pts.push(pts[0]);
		}
		return pts;
	}, [center, road.closed, y]);

	if (hidden && !editing) {
		return null;
	}

	return (
		<group>
			<mesh geometry={surface} receiveShadow castShadow={!hidden} {...handlers}>
				{hidden ? (
					// Invisible but still clickable, so hidden routes can be selected while editing.
					<meshBasicMaterial transparent opacity={0} depthWrite={false} />
				) : (
					<meshStandardMaterial color={roadColor(road, palette)} roughness={0.95} />
				)}
			</mesh>

			{road.style === "asphalt" && road.markings && (
				<mesh geometry={markings} receiveShadow>
					<meshStandardMaterial color={palette.roadMark} roughness={0.9} />
				</mesh>
			)}

			{!hidden && sides.deck.quads.length > 0 && (
				<mesh geometry={deck} castShadow receiveShadow {...handlers}>
					<meshStandardMaterial color={palette.deck} roughness={0.9} side={THREE.DoubleSide} />
				</mesh>
			)}

			{sides.railings.quads.length > 0 && (
				<mesh geometry={railings} castShadow>
					<meshStandardMaterial color={palette.railing} roughness={0.8} side={THREE.DoubleSide} />
				</mesh>
			)}

			{sides.embankment.quads.length > 0 && (
				<mesh geometry={embankment} castShadow receiveShadow {...handlers}>
					<meshStandardMaterial
						color={road.embankmentColor ?? palette.embankment}
						roughness={1}
						side={THREE.DoubleSide}
					/>
				</mesh>
			)}

			{pillars.map(([x, z, h]) => {
				const pillarHeight = Math.max(0.1, h - DECK_THICKNESS);
				return (
					<mesh key={`${x}:${z}`} position={[x, y + pillarHeight / 2, z]} castShadow receiveShadow>
						<boxGeometry args={[PILLAR_SIZE, pillarHeight, PILLAR_SIZE]} />

						<meshStandardMaterial color={palette.deck} roughness={0.9} />
					</mesh>
				);
			})}

			{hidden && (
				<Line
					points={outline}
					color={road.color ?? palette.selection}
					lineWidth={2}
					dashed
					dashSize={0.35}
					gapSize={0.25}
				/>
			)}

			{selected && <Line points={outline} color={palette.selection} lineWidth={3} />}
		</group>
	);
};

interface IRoadMeshProps {
	road: TRoad;
	/** Draw order among roads; later roads sit on top at junctions. */
	layer: number;
}

export const RoadMesh = memo(({ road, layer }: IRoadMeshProps) => {
	const palette = usePalette();
	const mode = useEditor((s) => s.mode);
	const selected = useEditor((s) => s.selectedRoadId === road.id);
	const drawing = useEditor((s) => s.drawing !== null);
	const selectRoad = useEditor((s) => s.selectRoad);
	const ground = useEditor((s) => s.scene.ground);

	const editable = mode === "edit" && !drawing;
	const handlers: TRoadHandlers = editable
		? {
				onClick: (e: ThreeEvent<MouseEvent>) => {
					// Stop here so the ground behind doesn't deselect, even after a camera drag.
					e.stopPropagation();
					if (isClick(e)) {
						selectRoad(road.id);
					}
				},
				onPointerOver: (e: ThreeEvent<PointerEvent>) => {
					e.stopPropagation();
					document.body.style.cursor = "pointer";
				},
				onPointerOut: () => {
					document.body.style.cursor = "";
				},
				onContextMenu: openContextMenuOnClick({ kind: "road", id: road.id }),
			}
		: {};

	return (
		<RoadBody
			road={road}
			layer={layer}
			palette={palette}
			ground={ground}
			editing={mode === "edit"}
			selected={selected && mode === "edit"}
			handlers={handlers}
		/>
	);
});
