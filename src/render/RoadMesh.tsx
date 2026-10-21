import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { buildRibbon, dashPolyline, roadCenterlineOf } from "#/scene/roads";
import type { TRoad, TVec2 } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

/** Each road sits slightly above the previous one so overlapping junctions don't flicker. */
const BASE_Y = 0.012;
const LAYER_STEP = 0.003;
const MARKING_DASH = 0.6;
const MARKING_GAP = 0.6;
const MARKING_HALF_WIDTH = 0.05;

/** Build one BufferGeometry from several ribbons, flat on the ground at height `y`. */
const ribbonGeometry = (
	ribbons: { center: TVec2[]; halfWidth: number; closed: boolean }[],
	y: number,
) => {
	const positions: number[] = [];
	const indices: number[] = [];
	for (const { center, halfWidth, closed } of ribbons) {
		const ribbon = buildRibbon(center, halfWidth, closed);
		const base = positions.length / 3;
		for (const [x, z] of ribbon.vertices) {
			positions.push(x, y, z);
		}
		for (const index of ribbon.indices) {
			indices.push(base + index);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	// Flat on the ground: every normal points straight up.
	const normals = new Float32Array(positions.length);
	for (let i = 1; i < normals.length; i += 3) {
		normals[i] = 1;
	}
	geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
	geometry.setIndex(indices);
	return geometry;
};

const useDisposable = (geometry: THREE.BufferGeometry) => {
	useLayoutEffect(() => () => geometry.dispose(), [geometry]);
	return geometry;
};

export const roadColor = (road: TRoad, palette: IScenePalette) =>
	road.color ?? (road.style === "dirt" ? palette.dirt : palette.road);

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

	const y = BASE_Y + layer * LAYER_STEP;
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
	const outline = useMemo(() => {
		const pts = center.map(([x, z]) => [x, y + 0.03, z] as [number, number, number]);
		if (road.closed && pts.length > 2) {
			pts.push(pts[0]);
		}
		return pts;
	}, [center, road.closed, y]);

	const hidden = road.style === "hidden";
	if (hidden && mode !== "edit") {
		return null;
	}

	const editable = mode === "edit" && !drawing;
	const handlers = editable
		? {
				onPointerDown: (e: ThreeEvent<PointerEvent>) => {
					if (e.nativeEvent.button !== 0) {
						return;
					}
					e.stopPropagation();
					selectRoad(road.id);
				},
				// Stop clicks reaching the ground, which would deselect.
				onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
				onPointerOver: (e: ThreeEvent<PointerEvent>) => {
					e.stopPropagation();
					document.body.style.cursor = "pointer";
				},
				onPointerOut: () => {
					document.body.style.cursor = "";
				},
			}
		: {};

	return (
		<group>
			<mesh geometry={surface} receiveShadow {...handlers}>
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

			{selected && mode === "edit" && (
				<Line points={outline} color={palette.selection} lineWidth={3} />
			)}
		</group>
	);
});
