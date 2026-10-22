import { Line } from "@react-three/drei";
import { useMemo } from "react";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { createRouteSampler } from "#/scene/routes";

/** Distance between samples of the highlighted lane. */
const STEP = 0.25;
/** Distance between the arrows that show which way vehicles go. */
const ARROW_SPACING = 2.5;
/** How far above the road surface the highlight floats, so it isn't hidden in it. */
const LIFT = 0.12;

type TPoint = [number, number, number];

/**
 * Highlights the lane a vehicle would drive, with arrows for the direction:
 * while one is dragged over a road (`routePreview`) and while the editor asks
 * whether a dropped one should follow it (`followOffer`).
 */
export const RouteHighlight = () => {
	const route = useEditor((s) => s.routePreview ?? s.followOffer);
	const road = useEditor((s) =>
		route ? (s.scene.roads.find((r) => r.id === route.roadId) ?? null) : null,
	);
	const driving = useEditor((s) => s.scene.driving);
	const palette = usePalette();
	const reverse = route?.reverse ?? false;

	const geometry = useMemo(() => {
		if (!road) {
			return null;
		}
		const sampler = createRouteSampler(road, driving, { reverse });
		const lane: TPoint[] = [];
		const steps = Math.max(1, Math.ceil(sampler.length / STEP));
		for (let i = 0; i <= steps; i++) {
			const { position, height } = sampler.travel((sampler.length * i) / steps);
			lane.push([position[0], height + LIFT, position[1]]);
		}
		// Chevrons pointing the way of travel, as pairs of line segments.
		const arrows: TPoint[] = [];
		for (let d = ARROW_SPACING / 2; d < sampler.length; d += ARROW_SPACING) {
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

	if (!geometry || geometry.lane.length < 2) {
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
