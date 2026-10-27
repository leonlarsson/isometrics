import { Line } from "@react-three/drei";
import { useMemo } from "react";

import { drawnModeOf, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { createRouteSampler } from "#/scene/routes";
import type { TRoad } from "#/scene/schema";

/** Distance between samples of the highlighted lane. */
const STEP = 0.25;
/** Distance between the arrows that show which way vehicles go. */
const ARROW_SPACING = 4;
/** How far from a leg's start and end its first and last arrows sit. */
const ARROW_MARGIN = 0.8;
/** How far above the road surface the highlight floats, so it isn't hidden in it. */
const LIFT = 0.12;

type TPoint = [number, number, number];

/**
 * The lane of one route, dashed, with chevrons pointing the way vehicles go: once round a loop, or
 * on an open road the whole trip, there, U-turn, back and U-turn.
 */
const RouteLine = ({ road, reverse }: { road: TRoad; reverse: boolean }) => {
	const driving = useEditor((s) => s.scene.drivingSide);
	const palette = usePalette();

	const geometry = useMemo(() => {
		const sampler = createRouteSampler(road, driving, { reverse });
		const { length, period, turn } = sampler;
		// A loop goes round once; an open road is driven there and back, with a U-turn at each end.
		const looped = period === length;
		const lane: TPoint[] = [];
		const steps = Math.max(1, Math.ceil(period / STEP));
		for (let i = 0; i <= steps; i++) {
			const { position, height } = sampler.travel((period * i) / steps);
			lane.push([position[0], height + LIFT, position[1]]);
		}
		// Where the chevrons go: spread evenly round a loop; on each leg of an open road, one near
		// its start, one near its end and the rest between, so either end shows the way.
		const spots: number[] = [];
		if (looped) {
			const count = Math.max(1, Math.round(length / ARROW_SPACING));
			for (let i = 0; i < count; i++) {
				spots.push(((i + 0.5) * length) / count);
			}
		} else {
			const margin = Math.min(ARROW_MARGIN, length / 4);
			const span = length - 2 * margin;
			const count = span > 0 ? Math.max(2, Math.round(span / ARROW_SPACING) + 1) : 1;
			for (const from of [0, length + turn]) {
				for (let i = 0; i < count; i++) {
					spots.push(from + (count === 1 ? length / 2 : margin + (span * i) / (count - 1)));
				}
			}
		}
		// Chevrons pointing the way of travel, as pairs of line segments.
		const arrows: TPoint[] = [];
		for (const d of spots) {
			const { position, height, heading } = sampler.travel(d);
			const forward = [Math.cos(heading), -Math.sin(heading)];
			const right = [Math.sin(heading), Math.cos(heading)];
			const at = (along: number, across: number): TPoint => [
				position[0] + forward[0] * along + right[0] * across,
				height + LIFT,
				position[1] + forward[1] * along + right[1] * across,
			];
			const tip = at(0.25, 0);
			arrows.push(at(-0.2, -0.35), tip, tip, at(-0.2, 0.35));
		}
		return { lane, arrows };
	}, [road, driving, reverse]);

	if (geometry.lane.length < 2) {
		return null;
	}
	return (
		<group renderOrder={2}>
			<Line
				points={geometry.lane}
				color={palette.selection}
				lineWidth={2}
				dashed
				dashSize={0.4}
				gapSize={0.25}
			/>

			{geometry.arrows.length > 0 && (
				<Line points={geometry.arrows} segments color={palette.selection} lineWidth={2.5} />
			)}
		</group>
	);
};

/**
 * Highlights the lane a vehicle drives, with arrows for the direction: while
 * one is dragged over a road (`routePreview`), while the editor asks whether a
 * dropped one should follow it (`followOffer`), and otherwise for every
 * selected vehicle that drives a road, in Edit mode, so hidden routes show
 * where they go (once per road and direction).
 */
export const RouteHighlight = () => {
	const offered = useEditor((s) => s.routePreview ?? s.followOffer);
	const editing = useEditor((s) => drawnModeOf(s) === "edit");
	const selectedItems = useEditor((s) => s.selectedItems);
	const entities = useEditor((s) => s.scene.entities);
	const roads = useEditor((s) => s.scene.roads);

	const routes = useMemo(() => {
		const wanted = offered
			? [offered]
			: editing
				? selectedItems.flatMap((item) => {
						const follow =
							item.kind === "entity" ? entities.find((e) => e.id === item.id)?.follow : null;
						return follow ? [follow] : [];
					})
				: [];
		const seen = new Set<string>();
		return wanted.flatMap(({ roadId, reverse }) => {
			const key = `${roadId}:${reverse}`;
			const road = roads.find((r) => r.id === roadId);
			if (!road || seen.has(key)) {
				return [];
			}
			seen.add(key);
			return [{ key, road, reverse }];
		});
	}, [offered, editing, selectedItems, entities, roads]);

	return (
		<>
			{routes.map(({ key, road, reverse }) => (
				<RouteLine key={key} road={road} reverse={reverse} />
			))}
		</>
	);
};
