import { Line } from "@react-three/drei";
import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { roadAsDrawn, valuesOfRoad } from "#/editor/roadFlows";
import { drawnModeOf, isItemBoxed, isItemSelected, isToggleClick, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { useWorldData } from "#/editor/worldData";
import { isClick } from "#/lib/pointer";
import { colorOf } from "#/parts/colorModel";
import {
	buildElevatedSides,
	buildRibbon,
	DECK_THICKNESS,
	dashPolyline,
	type IWall,
	isHiddenRoute,
	pillarPositions,
	ROAD_KINDS,
	roadCenterlineOf,
} from "#/scene/roads";
import type { TDataValue, TRoad, TRoadPoint } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { openContextMenuOnClick } from "./contextMenu";
import { RoadFlow } from "./RoadFlow";
import { setViewCursor } from "./viewCursor";

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

/** A road's surface colour as drawn now: from data, else as set, else its kind's (ADR-0104). */
export const roadColor = (road: TRoad, palette: IScenePalette, data?: readonly TDataValue[]) =>
	colorOf(ROAD_KINDS[road.kind], road, "surface", palette, data, palette.road);

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
	/** The world's data, for colours that follow it. */
	data: readonly TDataValue[];
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
	data,
	ground,
	editing,
	selected,
	handlers = {},
}: IRoadBodyProps) => {
	const groundWidth = ground.width;
	const groundDepth = ground.depth;
	const hidden = isHiddenRoute(road.kind);
	const y = roadBaseY(layer);
	const center = useMemo(() => roadCenterlineOf(road), [road]);

	const surface = useDisposable(
		useMemo(
			() => ribbonGeometry([{ center, halfWidth: road.width / 2, closed: road.loops }], y),
			[center, road.width, road.loops, y],
		),
	);
	const markings = useDisposable(
		useMemo(
			() =>
				ribbonGeometry(
					dashPolyline(center, road.loops, MARKING_DASH, MARKING_GAP).map((dash) => ({
						center: dash,
						halfWidth: MARKING_HALF_WIDTH,
						closed: false,
					})),
					y + 0.002,
				),
			[center, road.loops, y],
		),
	);
	const sides = useMemo(
		() =>
			buildElevatedSides(center, road.loops, road.width / 2, {
				railings: road.showsRailings && !hidden,
				embankment: road.heldUpBy === "embankment" && !hidden,
				embankmentAngle: road.embankmentAngle,
				embankmentWidth: road.embankmentWidth,
				bounds: [groundWidth / 2, groundDepth / 2],
			}),
		[
			center,
			road.loops,
			road.width,
			road.showsRailings,
			road.heldUpBy,
			road.embankmentAngle,
			road.embankmentWidth,
			hidden,
			groundWidth,
			groundDepth,
		],
	);
	const deck = useDisposable(useMemo(() => wallGeometry(sides.deck, y), [sides, y]));
	const underside = useDisposable(useMemo(() => wallGeometry(sides.underside, y), [sides, y]));
	const railings = useDisposable(useMemo(() => wallGeometry(sides.railings, y), [sides, y]));
	const embankment = useDisposable(useMemo(() => wallGeometry(sides.embankment, y), [sides, y]));
	const pillars = useMemo(
		() =>
			road.heldUpBy === "pillars" && !hidden
				? pillarPositions(center, road.loops, road.pillarSpacing)
				: [],
		[center, road.loops, road.heldUpBy, road.pillarSpacing, hidden],
	);

	// A road with traffic keeps clearer of snow (ADR-0102): its share, a uniform the shading reads.
	const used = useEditor((s) =>
		s.scene.entities.some((entity) => entity.follow?.roadId === road.id && !entity.isHidden),
	);
	const snowFactor = useMemo(() => ({ value: 1 }), []);
	const snowShare = useMemo(() => ({ snowFactor }), [snowFactor]);
	useLayoutEffect(() => {
		snowFactor.value = used ? USED_ROAD_SNOW : 1;
	}, [used, snowFactor]);

	const outline = useMemo(() => {
		const pts = center.map(([x, z, h]) => [x, y + h + 0.03, z] as [number, number, number]);
		if (road.loops && pts.length > 2) {
			pts.push(pts[0]);
		}
		return pts;
	}, [center, road.loops, y]);

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
					<meshStandardMaterial
						color={roadColor(road, palette, data)}
						roughness={0.95}
						userData={snowShare}
					/>
				)}
			</mesh>

			{ROAD_KINDS[road.kind].centreLine && road.showsCentreLine && (
				<mesh geometry={markings} receiveShadow>
					<meshStandardMaterial color={palette.roadMark} roughness={0.9} userData={snowShare} />
				</mesh>
			)}

			{/* Closes the deck from below: a bridge looks solid and casts a shadow. */}
			{!hidden && sides.underside.quads.length > 0 && (
				<mesh geometry={underside} castShadow receiveShadow {...handlers}>
					<meshStandardMaterial color={palette.deck} roughness={0.9} side={THREE.DoubleSide} />
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
						color={colorOf(
							ROAD_KINDS[road.kind],
							road,
							"embankment",
							palette,
							data,
							palette.embankment,
						)}
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
					color={road.colors.surface?.color ?? palette.selection}
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

/** How much of the snow settles on a road vehicles drive: barely any, they keep it clear (ADR-0102). */
const USED_ROAD_SNOW = 0.08;

export const RoadMesh = memo(({ road: stored, layer }: IRoadMeshProps) => {
	// What it reads: the world's values and its row's columns (ADR-0108); drawn with its width and
	// flow as data sets them (ADR-0112).
	const data = valuesOfRoad(stored, useWorldData());
	const road = roadAsDrawn(stored, data);
	const palette = usePalette();
	const mode = useEditor(drawnModeOf);
	// A box being drawn that would take it out of the selection shows it dashed instead (HoverHighlight).
	const selected = useEditor(
		(s) =>
			isItemSelected(s, "road", road.id) &&
			!(s.boxDrag?.removing && isItemBoxed(s, "road", road.id)),
	);
	const drawing = useEditor((s) => s.drawing !== null);
	const selectRoad = useEditor((s) => s.selectRoad);
	const ground = useEditor((s) => s.scene.ground);

	const editable = mode === "edit" && !drawing;
	const handlers: TRoadHandlers = editable
		? {
				onClick: (e: ThreeEvent<MouseEvent>) => {
					// Stop here so the ground behind doesn't deselect, even after a camera drag.
					e.stopPropagation();
					if (!isClick(e)) {
						return;
					}
					if (isToggleClick(e.nativeEvent)) {
						useEditor.getState().toggleSelected({ kind: "road", id: road.id });
					} else {
						selectRoad(road.id);
					}
				},
				onPointerOver: (e: ThreeEvent<PointerEvent>) => {
					e.stopPropagation();
					setViewCursor("pointer");
				},
				onPointerOut: () => {
					setViewCursor("");
				},
				onContextMenu: openContextMenuOnClick({ kind: "road", id: road.id }),
			}
		: // In View mode a road that shows data opens its details, its flow in data terms (ADR-0112).
			mode === "view" && (road.dataRow !== null || Object.keys(road.data).length > 0)
			? {
					onClick: (e: ThreeEvent<MouseEvent>) => {
						e.stopPropagation();
						if (isClick(e)) {
							selectRoad(road.id);
						}
					},
					onPointerOver: (e: ThreeEvent<PointerEvent>) => {
						e.stopPropagation();
						setViewCursor("pointer");
					},
					onPointerOut: () => {
						setViewCursor("");
					},
				}
			: {};

	return (
		<>
			<RoadBody
				road={road}
				layer={layer}
				palette={palette}
				data={data}
				ground={ground}
				editing={mode === "edit"}
				selected={selected && mode === "edit"}
				handlers={handlers}
			/>

			<RoadFlow
				road={road}
				palette={palette}
				data={data}
				surfaceY={roadBaseY(layer)}
				surfaceColor={roadColor(road, palette, data)}
			/>
		</>
	);
});
