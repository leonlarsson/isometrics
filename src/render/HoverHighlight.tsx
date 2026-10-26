import { Line } from "@react-three/drei";
import { useMemo } from "react";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { roadCenterlineOf } from "#/scene/roads";
import type { TArea, TRoad } from "#/scene/schema";

import { areaBaseY } from "./AreaMesh";
import { roadBaseY } from "./RoadMesh";

type TPoint = [number, number, number];

/** How far above the surface the outline floats, so it isn't hidden in it. */
const LIFT = 0.1;

/**
 * The outline of a road's surface: both edges, joined at the ends of an open
 * road. A loop gets its two edges as separate closed lines.
 */
const roadOutline = (road: TRoad, baseY: number): TPoint[][] => {
	const line = roadCenterlineOf(road);
	const n = line.length;
	const loop = road.loops && n > 2;
	const left: TPoint[] = [];
	const right: TPoint[] = [];
	for (let i = 0; i < n; i++) {
		const before = line[loop ? (i - 1 + n) % n : Math.max(0, i - 1)];
		const after = line[loop ? (i + 1) % n : Math.min(n - 1, i + 1)];
		const dx = after[0] - before[0];
		const dz = after[1] - before[1];
		const length = Math.hypot(dx, dz) || 1;
		const half = (line[i][3] ?? road.width) / 2;
		// Left of the direction (dx, dz) is (dz, -dx).
		const [ox, oz] = [(dz / length) * half, (-dx / length) * half];
		const y = baseY + line[i][2] + LIFT;
		left.push([line[i][0] + ox, y, line[i][1] + oz]);
		right.push([line[i][0] - ox, y, line[i][1] - oz]);
	}
	if (loop) {
		return [
			[...left, left[0]],
			[...right, right[0]],
		];
	}
	return [[...left, ...right.reverse(), left[0]]];
};

const areaOutline = (area: TArea, baseY: number): TPoint[][] => {
	const y = baseY + area.height + LIFT;
	const corners = area.points.map(([x, z]): TPoint => [x, y, z]);
	return [[...corners, corners[0]]];
};

/**
 * Outlines the road or area hovered in a list (the outliner or the Scene
 * tab), so you can see which one a row is, and the roads and areas inside a
 * selection box being drawn (ADR-0064). Objects show their own frames
 * (EntityNode).
 */
export const HoverHighlight = () => {
	const hovered = useEditor((s) => s.hovered);
	const boxed = useEditor((s) => s.boxDrag?.items);
	const roads = useEditor((s) => s.scene.roads);
	const areas = useEditor((s) => s.scene.areas);
	const mode = useEditor((s) => s.mode);
	const palette = usePalette();

	const lines = useMemo(() => {
		const items = [...(hovered ? [hovered] : []), ...(boxed ?? [])];
		return items.flatMap((item) => {
			if (item.kind === "road") {
				const layer = roads.findIndex((r) => r.id === item.id);
				const road = roads[layer];
				return road && !road.hidden ? roadOutline(road, roadBaseY(layer)) : [];
			}
			if (item.kind === "area") {
				const layer = areas.findIndex((a) => a.id === item.id);
				const area = areas[layer];
				return area && !area.hidden ? areaOutline(area, areaBaseY(layer)) : [];
			}
			return [];
		});
	}, [hovered, boxed, roads, areas]);

	if (mode !== "edit" || lines.length === 0) {
		return null;
	}
	return (
		<group renderOrder={2}>
			{lines.map((points, index) => (
				<Line
					// biome-ignore lint/suspicious/noArrayIndexKey: outlines in a fixed order while it lasts
					key={index}
					points={points}
					color={palette.selection}
					lineWidth={2}
					dashed
					dashSize={0.3}
					gapSize={0.2}
				/>
			))}
		</group>
	);
};
