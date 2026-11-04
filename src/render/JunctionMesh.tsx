import { memo, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import {
	type IJunctionPad,
	type INetworkJunction,
	type IRoadNetwork,
	junctionPad,
	roadNetworkOf,
} from "#/scene/junctions";
import { DECK_THICKNESS, ELEVATED_MIN } from "#/scene/roads";
import type { TDataValue, TJunction, TRoad } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { roadBaseY, roadColor, roadsInUse, USED_ROAD_SNOW } from "./RoadMesh";

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
		return { surface, sides: null };
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
	return { surface, sides };
};

interface IJunctionBodyProps {
	network: IRoadNetwork;
	junction: INetworkJunction;
	/** The highest draw layer among its roads. */
	layer: number;
	palette: IScenePalette;
	data: readonly TDataValue[];
	/** Whether vehicles drive any of its roads: then it keeps clear of snow as they do. */
	used: boolean;
}

const JunctionBody = memo(
	({ network, junction, layer, palette, data, used }: IJunctionBodyProps) => {
		const pad = junctionPad(network, junction);
		const y = roadBaseY(layer) + PAD_LIFT;
		// Built again only when its shape does, not on every change to any road.
		const shape = pad ? `${y}|${pad.vertices.flat().join(",")}` : "";
		const geometry = useMemo(() => (pad ? padGeometry(pad, y) : null), [shape]);
		useLayoutEffect(
			() => () => {
				geometry?.surface.dispose();
				geometry?.sides?.dispose();
			},
			[geometry],
		);
		const snowFactor = useMemo(() => ({ value: 1 }), []);
		const snowShare = useMemo(() => ({ snowFactor }), [snowFactor]);
		useLayoutEffect(() => {
			snowFactor.value = used ? USED_ROAD_SNOW : 1;
		}, [used, snowFactor]);

		const colorRoad = pad ? network.roadById(pad.colorRoadId) : undefined;
		if (!geometry || !colorRoad) {
			return null;
		}

		return (
			<group>
				<mesh geometry={geometry.surface} receiveShadow castShadow>
					<meshStandardMaterial
						color={roadColor(colorRoad, palette, data)}
						roughness={0.95}
						userData={snowShare}
					/>
				</mesh>

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
	data: readonly TDataValue[];
}

/** Every junction's surface, from the world's roads and junctions. */
export const JunctionBodies = ({ roads, junctions, palette, data }: IJunctionBodiesProps) => {
	const network = roadNetworkOf(roads, junctions);
	const used = useEditor((s) => roadsInUse(s.scene.entities));
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
		/>
	));
};
