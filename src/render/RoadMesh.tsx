import { Line } from "@react-three/drei";
import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { roadAsDrawn, valuesOfRoad } from "#/editor/roadFlows";
import { drawnModeOf, isItemBoxed, isItemSelected, isToggleClick, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { useWorldData } from "#/editor/worldData";
import { isClick } from "#/lib/pointer";
import { colorOf } from "#/parts/colorModel";
import { cutLine } from "#/scene/junctions";
import { type IPillarWorld, placePillars } from "#/scene/pillars";
import {
	buildElevatedSides,
	buildRibbon,
	dashPolyline,
	edgeLinesOf,
	type IWall,
	isHiddenRoute,
	ROAD_KINDS,
	roadCenterlineOf,
	showsEdgeLinesOf,
} from "#/scene/roads";
import type { TDataValue, TEntity, TRoad, TRoadPoint } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { openContextMenuOnClick } from "./contextMenu";
import { pillarGeometry } from "./pillarGeometry";
import { arrowColorOn, OneWayArrows, RoadFlow } from "./RoadFlow";
import { setViewCursor } from "./viewCursor";

/** Each road sits slightly above the previous one so overlapping junctions don't flicker. */
const BASE_Y = 0.012;
const LAYER_STEP = 0.003;
const MARKING_DASH = 0.6;
const MARKING_GAP = 0.6;
const MARKING_HALF_WIDTH = 0.05;

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
const wallGeometry = (wall: IWall, y: number, isSmooth = false) => {
	const positions: number[] = [];
	for (const [ta, tb, ba, bb] of wall.quads) {
		for (const [px, py, pz] of [ta, tb, ba, ba, tb, bb]) {
			positions.push(px, py + y, pz);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	// A railing or deck edge is smooth round a bend (ADR-0148): its quads share their corners, so
	// its shading bends with it instead of showing a facet a quad.
	if (isSmooth) {
		const shared = mergeVertices(geometry);
		shared.computeVertexNormals();
		geometry.dispose();
		return shared;
	}
	geometry.computeVertexNormals();
	return geometry;
};

const useDisposable = <T extends THREE.BufferGeometry | null>(geometry: T) => {
	useLayoutEffect(() => () => geometry?.dispose(), [geometry]);
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
	/**
	 * How far its surface is cut back at each end, where it meets other roads at a junction
	 * (ADR-0136): the junction's own surface is drawn there instead. Default: not at all.
	 */
	trimStart?: number;
	trimEnd?: number;
	/** What its pillars keep clear of (ADR-0148). Default: nothing. */
	pillarWorld?: IPillarWorld | null;
	/** No pillars of its own beside a junction at its first or last point that has its own (ADR-0148). */
	bareStart?: boolean;
	bareEnd?: boolean;
}

/**
 * The roads something visible drives along, once per objects list (lists are
 * replaced, never changed): every road asks on every change, drags included.
 */
const roadsUsed = new WeakMap<readonly TEntity[], ReadonlySet<string>>();
export const roadsInUse = (entities: readonly TEntity[]) => {
	let ids = roadsUsed.get(entities);
	if (!ids) {
		ids = new Set(
			entities.flatMap((entity) =>
				entity.follow && !entity.isHidden ? [entity.follow.roadId] : [],
			),
		);
		roadsUsed.set(entities, ids);
	}
	return ids;
};

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
	trimStart = 0,
	pillarWorld = null,
	bareStart = false,
	bareEnd = false,
	trimEnd = 0,
}: IRoadBodyProps) => {
	const groundWidth = ground.width;
	const groundDepth = ground.depth;
	const hidden = isHiddenRoute(road.kind);
	const y = roadBaseY(layer);
	const fullCenter = useMemo(() => roadCenterlineOf(road), [road]);
	// What's drawn: cut back where it meets other roads at a junction, so the markings stop there.
	const center = useMemo(
		() => cutLine(fullCenter, trimStart, trimEnd),
		[fullCenter, trimStart, trimEnd],
	);

	const surface = useDisposable(
		useMemo(
			() => ribbonGeometry([{ center, halfWidth: road.width / 2, closed: road.loops }], y),
			[center, road.width, road.loops, y],
		),
	);
	// Its markings: a dashed centre line (a two-way road has one; a one-way road, with nothing
	// coming the other way, doesn't), and a solid line along each edge (ADR-0148).
	const showsCentre = ROAD_KINDS[road.kind].centreLine && road.showsCentreLine && !road.isOneWay;
	const showsEdges = showsEdgeLinesOf(road);
	const markings = useDisposable(
		useMemo(
			() =>
				showsCentre || showsEdges
					? ribbonGeometry(
							[
								...(showsCentre ? dashPolyline(center, road.loops, MARKING_DASH, MARKING_GAP) : []),
								...(showsEdges ? edgeLinesOf(center, road.loops, road.width / 2) : []),
							].map((line) => ({ center: line, halfWidth: MARKING_HALF_WIDTH, closed: false })),
							y + 0.002,
						)
					: null,
			[center, road.loops, road.width, y, showsCentre, showsEdges],
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
	const deck = useDisposable(useMemo(() => wallGeometry(sides.deck, y, true), [sides, y]));
	const underside = useDisposable(useMemo(() => wallGeometry(sides.underside, y), [sides, y]));
	const railings = useDisposable(useMemo(() => wallGeometry(sides.railings, y, true), [sides, y]));
	const embankment = useDisposable(useMemo(() => wallGeometry(sides.embankment, y), [sides, y]));
	// Its pillars (ADR-0148): spaced, as chosen at its points, and clear of what's below when it
	// keeps them so; one geometry for all of them.
	const pillars = useMemo(
		() =>
			road.heldUpBy === "pillars" && !hidden
				? placePillars(road, center, { world: pillarWorld, bareStart, bareEnd })
				: [],
		[road, center, hidden, pillarWorld, bareStart, bareEnd],
	);
	const pillarMesh = useDisposable(
		useMemo(() => pillarGeometry(pillars, road.pillarKind, y), [pillars, road.pillarKind, y]),
	);

	// A road with traffic keeps clearer of snow (ADR-0102): its share, a uniform the shading reads.
	const used = useEditor((s) => roadsInUse(s.scene.entities).has(road.id));
	const snowFactor = useMemo(() => ({ value: 1 }), []);
	const snowShare = useMemo(() => ({ snowFactor }), [snowFactor]);
	useLayoutEffect(() => {
		snowFactor.value = used ? USED_ROAD_SNOW : 1;
	}, [used, snowFactor]);

	const outline = useMemo(() => {
		const pts = fullCenter.map(([x, z, h]) => [x, y + h + 0.03, z] as [number, number, number]);
		if (road.loops && pts.length > 2) {
			pts.push(pts[0]);
		}
		return pts;
	}, [fullCenter, road.loops, y]);

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

			{/* Its markings: none where it has none to show (ADR-0148). */}
			{markings && (
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

			{pillars.length > 0 && (
				<mesh geometry={pillarMesh} castShadow receiveShadow>
					<meshStandardMaterial color={palette.deck} roughness={0.9} />
				</mesh>
			)}

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

			{/* Which way a one-way road goes, while editing (ADR-0148). */}
			{editing && road.isOneWay && (
				<OneWayArrows
					road={road}
					color={hidden ? palette.selection : arrowColorOn(roadColor(road, palette, data))}
					y={y + 0.006}
				/>
			)}
		</group>
	);
};

interface IRoadMeshProps {
	road: TRoad;
	/** Draw order among roads; later roads sit on top where they overlap. */
	layer: number;
	/** How far it's cut back at each end for a junction (ADR-0136). */
	trimStart: number;
	trimEnd: number;
	/** A junction at its first or last point stands on its own pillars, so it has none beside it. */
	bareStart?: boolean;
	bareEnd?: boolean;
}

/** How much of the snow settles on a road vehicles drive: barely any, they keep it clear (ADR-0102). */
export const USED_ROAD_SNOW = 0.08;

export const RoadMesh = memo(
	({ road: stored, layer, trimStart, trimEnd, bareStart, bareEnd }: IRoadMeshProps) => {
		// What it reads: the world's values and its row's columns (ADR-0108); drawn with its width and
		// flow as data sets them (ADR-0112).
		const data = valuesOfRoad(stored, useWorldData());
		const road = roadAsDrawn(stored, data);
		const palette = usePalette();
		const mode = useEditor(drawnModeOf);
		const usesData = useEditor((s) => s.scene.data.enabled);
		// A box being drawn that would take it out of the selection shows it dashed instead (HoverHighlight).
		const selected = useEditor(
			(s) =>
				isItemSelected(s, "road", road.id) &&
				!(s.boxDrag?.removing && isItemBoxed(s, "road", road.id)),
		);
		const drawing = useEditor((s) => s.drawing !== null);
		const selectRoad = useEditor((s) => s.selectRoad);
		const ground = useEditor((s) => s.scene.ground);
		// What its pillars keep clear of (ADR-0148): only a raised road on pillars follows the other
		// roads and junctions, so roads on the ground don't draw again for every change.
		const standsOnPillars =
			stored.heldUpBy === "pillars" && stored.points.some((point) => point[2] > 0);
		const roads = useEditor((s) => (standsOnPillars ? s.scene.roads : null));
		const junctions = useEditor((s) => (standsOnPillars ? s.scene.junctions : null));
		const pillarWorld = useMemo(
			() => (roads && junctions ? { roads, junctions } : null),
			[roads, junctions],
		);

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
				mode === "view" && usesData && (road.dataRow !== null || Object.keys(road.data).length > 0)
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
					trimStart={trimStart}
					trimEnd={trimEnd}
					pillarWorld={pillarWorld}
					bareStart={bareStart}
					bareEnd={bareEnd}
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
	},
);
