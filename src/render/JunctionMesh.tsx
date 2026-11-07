import { memo, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { valuesOfRoad } from "#/editor/roadFlows";
import { useEditor } from "#/editor/store";
import {
	type IJunctionPad,
	type INetworkJunction,
	type IRoadNetwork,
	junctionPad,
	roadNetworkOf,
} from "#/scene/junctions";
import { type IPillarWorld, junctionPillars } from "#/scene/pillars";
import { DECK_THICKNESS, dashPolyline, ELEVATED_MIN, railingHeightAt } from "#/scene/roads";
import type { TJunction, TRoad, TWorldData } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { pillarGeometry } from "./pillarGeometry";
import {
	MARKING_DASH,
	MARKING_GAP,
	MARKING_HALF_WIDTH,
	ribbonGeometry,
	roadBaseY,
	roadColor,
	roadsInUse,
	USED_ROAD_SNOW,
} from "./RoadMesh";

/**
 * Where roads meet (ADR-0136): the junction's own surface, between its roads'
 * cut ends, just above the highest of them, and for a raised junction its
 * deck's edge and underside. The roads draw themselves cut back (RoadBody).
 */

/** Above its roads' surfaces, under nothing they draw on top (their markings stop before it). */
const PAD_LIFT = 0.0025;

/** The fan, its edge down to the deck's thickness and the underside, for a raised junction. */
const padGeometry = (pad: IJunctionPad, y: number) => {
	const positions: number[] = [];
	for (const [x, z, h] of pad.vertices) {
		positions.push(x, y + h, z);
	}
	const surface = new THREE.BufferGeometry();
	surface.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	surface.setAttribute(
		"normal",
		new THREE.Float32BufferAttribute(
			pad.vertices.flatMap(() => [0, 1, 0]),
			3,
		),
	);
	surface.setIndex(pad.indices);

	const raised = pad.vertices[0][2] > ELEVATED_MIN;
	if (!raised) {
		return { surface, sides: null, railings: null };
	}
	// Its edge between the roads, down to the deck's thickness, and the underside under it all.
	const sidePositions: number[] = [];
	for (const edge of pad.edges) {
		for (let i = 0; i < edge.length - 1; i++) {
			const [a, b] = [edge[i], edge[i + 1]];
			const [ta, tb] = [y + a[2], y + b[2]];
			const [ba, bb] = [
				y + Math.max(0, a[2] - DECK_THICKNESS),
				y + Math.max(0, b[2] - DECK_THICKNESS),
			];
			sidePositions.push(
				a[0],
				ta,
				a[1],
				b[0],
				tb,
				b[1],
				a[0],
				ba,
				a[1],
				a[0],
				ba,
				a[1],
				b[0],
				tb,
				b[1],
				b[0],
				bb,
				b[1],
			);
		}
	}
	for (let i = 0; i < pad.indices.length; i += 3) {
		for (const index of [pad.indices[i], pad.indices[i + 2], pad.indices[i + 1]]) {
			const [x, z, h] = pad.vertices[index];
			sidePositions.push(x, y + Math.max(0, h - DECK_THICKNESS), z);
		}
	}
	const sides = new THREE.BufferGeometry();
	sides.setAttribute("position", new THREE.Float32BufferAttribute(sidePositions, 3));
	sides.computeVertexNormals();
	// A gore's outer edge has a railing, growing in with the deck's height as a road's (ADR-0148).
	// Its normals are smooth round the kerb's curve (each point's across its edge, on the side the
	// faces show), so the rail reads as one bent rail, not facets, and matches the roads' straight one.
	const railingPositions: number[] = [];
	const railingNormals: number[] = [];
	for (const edge of pad.railingEdges ?? []) {
		const across = edge.map((_, i) => {
			const [a, b] = [edge[Math.max(0, i - 1)], edge[Math.min(edge.length - 1, i + 1)]];
			const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
			const len = Math.hypot(dx, dz) || 1;
			return [-dz / len, 0, dx / len] as const;
		});
		for (let i = 0; i < edge.length - 1; i++) {
			const [a, b] = [edge[i], edge[i + 1]];
			const [ta, tb] = [a[2] + railingHeightAt(a[2]), b[2] + railingHeightAt(b[2])];
			if (ta - a[2] < 1e-3 && tb - b[2] < 1e-3) {
				continue;
			}
			railingPositions.push(
				...[a[0], y + ta, a[1], b[0], y + tb, b[1], a[0], y + a[2], a[1]],
				...[a[0], y + a[2], a[1], b[0], y + tb, b[1], b[0], y + b[2], b[1]],
			);
			// The faces' own side, (b - a) × (down): the normals point the way the faces do.
			const [fx, fz] = [b[1] - a[1], -(b[0] - a[0])];
			const sign = fx * across[i][0] + fz * across[i][2] >= 0 ? 1 : -1;
			for (const k of [i, i + 1, i, i, i + 1, i + 1]) {
				railingNormals.push(across[k][0] * sign, 0, across[k][2] * sign);
			}
		}
	}
	const railings = railingPositions.length > 0 ? new THREE.BufferGeometry() : null;
	if (railings) {
		railings.setAttribute("position", new THREE.Float32BufferAttribute(railingPositions, 3));
		railings.setAttribute("normal", new THREE.Float32BufferAttribute(railingNormals, 3));
	}
	return { surface, sides, railings };
};

interface IJunctionBodyProps {
	network: IRoadNetwork;
	junction: INetworkJunction;
	/** The highest draw layer among its roads. */
	layer: number;
	palette: IScenePalette;
	/** The world's data: the colour follows its road's, row and all (ADR-0108). */
	data: TWorldData;
	/** What its pillars keep clear of (ADR-0148); none drawn without it. */
	world: IPillarWorld | null;
	/** Whether vehicles drive any of its roads: then it keeps clear of snow as they do. */
	used: boolean;
}

const JunctionBody = memo(
	({ network, junction, layer, palette, data, used, world }: IJunctionBodyProps) => {
		const pad = junctionPad(network, junction);
		const y = roadBaseY(layer) + PAD_LIFT;
		// Built again only when its shape does, not on every change to any road.
		const shape = pad ? `${y}|${pad.vertices.flat().join(",")}` : "";
		const geometry = useMemo(() => (pad ? padGeometry(pad, y) : null), [shape]);
		useLayoutEffect(
			() => () => {
				geometry?.surface.dispose();
				geometry?.sides?.dispose();
				geometry?.railings?.dispose();
			},
			[geometry],
		);
		const snowFactor = useMemo(() => ({ value: 1 }), []);
		const snowShare = useMemo(() => ({ snowFactor }), [snowFactor]);
		useLayoutEffect(() => {
			snowFactor.value = used ? USED_ROAD_SNOW : 1;
		}, [used, snowFactor]);

		// The pillars it stands on, raised (ADR-0148).
		const standsOn = useMemo(
			() => (world ? junctionPillars(network, junction, world) : null),
			[network, junction, world],
		);
		// Its markings (a gore's, ADR-0148): lane lines dashed like the roads' markings, and the
		// gore's edges solid and its chevrons solid and bolder, so they read from afar.
		const laneLines = useMemo(() => {
			const dashed = (pad?.laneLines ?? []).flatMap((line) =>
				dashPolyline(line, false, MARKING_DASH, MARKING_GAP),
			);
			const lines = [
				...[...dashed, ...(pad?.paintedLines ?? [])].map((center) => ({
					center,
					halfWidth: MARKING_HALF_WIDTH,
					closed: false,
				})),
				...(pad?.chevrons ?? []).map((center) => ({
					center,
					halfWidth: MARKING_HALF_WIDTH * 2,
					closed: false,
				})),
			].filter((line) => line.center.length > 1);
			return lines.length > 0 ? ribbonGeometry(lines, y + 0.002) : null;
		}, [shape]);
		useLayoutEffect(() => () => laneLines?.dispose(), [laneLines]);
		const pillarMesh = useMemo(
			() => (standsOn ? pillarGeometry(standsOn.pillars, standsOn.kind, roadBaseY(layer)) : null),
			[standsOn, layer],
		);
		useLayoutEffect(() => () => pillarMesh?.dispose(), [pillarMesh]);

		const colorRoad = pad ? network.roadById(pad.colorRoadId) : undefined;
		if (!geometry || !colorRoad) {
			return null;
		}

		return (
			<group>
				<mesh geometry={geometry.surface} receiveShadow castShadow>
					<meshStandardMaterial
						color={roadColor(colorRoad, palette, valuesOfRoad(colorRoad, data))}
						roughness={0.95}
						userData={snowShare}
					/>
				</mesh>

				{laneLines && (
					<mesh geometry={laneLines} receiveShadow>
						<meshStandardMaterial color={palette.roadMark} roughness={0.9} />
					</mesh>
				)}

				{pillarMesh && (
					<mesh geometry={pillarMesh} castShadow receiveShadow>
						<meshStandardMaterial color={palette.deck} roughness={0.9} />
					</mesh>
				)}

				{geometry.railings && (
					<mesh geometry={geometry.railings} castShadow>
						<meshStandardMaterial color={palette.railing} roughness={0.8} side={THREE.DoubleSide} />
					</mesh>
				)}

				{geometry.sides && (
					<mesh geometry={geometry.sides} castShadow receiveShadow>
						<meshStandardMaterial color={palette.deck} roughness={0.9} side={THREE.DoubleSide} />
					</mesh>
				)}
			</group>
		);
	},
);

interface IJunctionBodiesProps {
	roads: readonly TRoad[];
	junctions: readonly TJunction[];
	palette: IScenePalette;
	data: TWorldData;
}

/** Every junction's surface, from the world's roads and junctions. */
export const JunctionBodies = ({ roads, junctions, palette, data }: IJunctionBodiesProps) => {
	const network = roadNetworkOf(roads, junctions);
	const used = useEditor((s) => roadsInUse(s.scene.entities));
	const areas = useEditor((s) => s.scene.areas);
	const world = useMemo(() => ({ roads, junctions, areas }), [roads, junctions, areas]);
	if (network.junctions.length === 0) {
		return null;
	}
	const layerOf = new Map(roads.map((road, index) => [road.id, index]));

	return network.junctions.map((junction) => (
		<JunctionBody
			key={junction.id}
			network={network}
			junction={junction}
			layer={Math.max(0, ...junction.ends.map((end) => layerOf.get(end.roadId) ?? 0))}
			palette={palette}
			data={data}
			used={junction.ends.some((end) => used.has(end.roadId))}
			world={world}
		/>
	));
};
