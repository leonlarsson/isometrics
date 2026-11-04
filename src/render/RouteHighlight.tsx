import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";

import { drawnModeOf, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { keepOnHotReload } from "#/lib/hot";
import { roadNetworkOf } from "#/scene/junctions";
import { drivesAcrossNetwork, pathAhead } from "#/scene/network";
import type { IPathSample } from "#/scene/paths";
import { createRouteSampler } from "#/scene/routes";
import type { TRoad } from "#/scene/schema";

import { drivingVehicles } from "./traffic";

/** Distance between samples of the highlighted lane. */
const STEP = 0.25;
/** Distance between the arrows that show which way vehicles go. */
const ARROW_SPACING = 4;
/** How far from a leg's start and end its first and last arrows sit. */
const ARROW_MARGIN = 0.8;
/** How far above the road surface the highlight floats, so it isn't hidden in it. */
const LIFT = 0.12;
/** How far ahead the way of a vehicle on a road network is shown (ADR-0136). */
const AHEAD = 60;
/** It's worked out again once the vehicle has driven this far since. */
const AHEAD_REFRESH = 2;
/** The way ahead fades out in this many pieces, each fainter than the one before. */
const FADE_PIECES = 5;
/** Heading smoothing the way ahead is drawn with (a car's, about). */
const AHEAD_SMOOTHING = 0.6;

type TPoint = [number, number, number];

/**
 * The roads each shown way ahead goes along, by vehicle id, nearest first: what the highlight
 * shows, for the end-to-end tests (render/PointerSpot's `routesShown`, development only).
 */
export const routesShown = keepOnHotReload("routesShown", () => new Map<string, string[]>());

/** A chevron pointing the way of travel at a place on a route, as two line segments. */
const chevronAt = ({ position, height, heading }: IPathSample): TPoint[] => {
	const forward = [Math.cos(heading), -Math.sin(heading)];
	const right = [Math.sin(heading), Math.cos(heading)];
	const at = (along: number, across: number): TPoint => [
		position[0] + forward[0] * along + right[0] * across,
		height + LIFT,
		position[1] + forward[1] * along + right[1] * across,
	];
	const tip = at(0.25, 0);
	return [at(-0.2, -0.35), tip, tip, at(-0.2, 0.35)];
};

/** A lane, dashed, and its chevrons: how every route is marked. */
const RouteMarks = ({
	lane,
	arrows,
	opacity = 1,
}: {
	lane: TPoint[];
	arrows: TPoint[];
	opacity?: number;
}) => {
	const palette = usePalette();
	if (lane.length < 2) {
		return null;
	}
	const fades = opacity < 1;
	return (
		<group renderOrder={2}>
			<Line
				points={lane}
				color={palette.selection}
				lineWidth={2}
				dashed
				dashSize={0.4}
				gapSize={0.25}
				transparent={fades}
				opacity={opacity}
			/>

			{arrows.length > 0 && (
				<Line
					points={arrows}
					segments
					color={palette.selection}
					lineWidth={2.5}
					transparent={fades}
					opacity={opacity}
				/>
			)}
		</group>
	);
};

/**
 * The lane of one route, dashed, with chevrons pointing the way vehicles go: once round a loop, or
 * on an open road the whole trip, there, U-turn, back and U-turn.
 */
const RouteLine = ({ road, reverse }: { road: TRoad; reverse: boolean }) => {
	const driving = useEditor((s) => s.scene.traffic.drivingSide);

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
		const arrows = spots.flatMap((d) => chevronAt(sampler.travel(d)));
		return { lane, arrows };
	}, [road, driving, reverse]);

	return <RouteMarks lane={geometry.lane} arrows={geometry.arrows} />;
};

/** A vehicle's way across a road network: where it starts and what seeds its choices. */
interface IWayAcross {
	roadId: string;
	startDistance: number;
	drivesTheOtherWay: boolean;
	/** The vehicle's id: its choices at junctions are seeded by it. */
	seed: string;
	/** A vehicle driving now: shown from how far it has driven, else from where it would start. */
	isDriving: boolean;
	/** Its own setting for driving through junctions (null: its road's, else the world's). */
	drivesThroughJunctions: boolean | null;
}

/**
 * The way a vehicle on a road network goes from where it is, `AHEAD` of it,
 * through its junctions as its trip will take it (`pathAhead`), fading out
 * towards the end (ADR-0136). For a driving vehicle it follows it along, worked
 * out again every couple of units; paused, it shows the way from where it stopped.
 */
const WayAhead = ({ way }: { way: IWayAcross }) => {
	const roads = useEditor((s) => s.scene.roads);
	const junctions = useEditor((s) => s.scene.junctions);
	const driving = useEditor((s) => s.scene.traffic.drivingSide);
	const drivenNow = () => (way.isDriving ? (drivingVehicles.get(way.seed)?.travelled ?? 0) : 0);
	const [from, setFrom] = useState(drivenNow);
	useFrame(() => {
		const driven = drivenNow();
		if (Math.abs(driven - from) >= AHEAD_REFRESH) {
			setFrom(driven);
		}
	});

	const ahead = useMemo(() => {
		const { samples, roads: along } = pathAhead(
			roadNetworkOf(roads, junctions),
			way.roadId,
			{
				driving,
				smoothing: AHEAD_SMOOTHING,
				startDistance: way.startDistance,
				reverse: way.drivesTheOtherWay,
				seed: way.seed,
			},
			from,
			AHEAD,
			STEP,
		);
		const lane = samples.map(
			({ position, height }): TPoint => [position[0], height + LIFT, position[1]],
		);
		// Chevrons every few units from just ahead of the vehicle, each in the piece it falls in.
		const perPiece = Math.ceil(lane.length / FADE_PIECES);
		const everyArrow = Math.round(ARROW_SPACING / STEP);
		const firstArrow = Math.round(ARROW_MARGIN / STEP);
		const pieces = Array.from({ length: FADE_PIECES }, (_, piece) => {
			const start = piece * perPiece;
			const end = Math.min(lane.length - 1, start + perPiece);
			const arrows: TPoint[] = [];
			for (let i = start; i < end; i++) {
				if (i % everyArrow === firstArrow) {
					arrows.push(...chevronAt(samples[i]));
				}
			}
			return { lane: lane.slice(start, end + 1), arrows, opacity: 1 - piece / FADE_PIECES };
		});
		return { pieces, along };
	}, [roads, junctions, driving, way, from]);
	const { pieces, along } = ahead;
	useEffect(() => {
		routesShown.set(way.seed, along);
		return () => {
			routesShown.delete(way.seed);
		};
	}, [way.seed, along]);

	return (
		<>
			{pieces.map((piece, index) => (
				<RouteMarks
					// biome-ignore lint/suspicious/noArrayIndexKey: the pieces are positional, nearest first
					key={index}
					lane={piece.lane}
					arrows={piece.arrows}
					opacity={piece.opacity}
				/>
			))}
		</>
	);
};

/**
 * Highlights the lane a vehicle drives, with arrows for the direction: while
 * one is dragged over a road (`routePreview`), while the editor asks whether a
 * dropped one should follow it (`followOffer`), and otherwise for every
 * selected vehicle that drives a road, in Edit mode, so hidden routes show
 * where they go (once per road and direction). On a road with a junction
 * (ADR-0136) it shows the way ahead instead (`WayAhead`): from the vehicle, or
 * from where it's dropped, through the junctions as it will go. A vehicle's
 * saved `follow` is only where it starts.
 */
export const RouteHighlight = () => {
	const offered = useEditor((s) => s.routePreview ?? s.followOffer);
	const editing = useEditor((s) => drawnModeOf(s) === "edit");
	const selectedItems = useEditor((s) => s.selectedItems);
	const entities = useEditor((s) => s.scene.entities);
	const roads = useEditor((s) => s.scene.roads);
	const junctions = useEditor((s) => s.scene.junctions);
	const traffic = useEditor((s) => s.scene.traffic);

	const routes = useMemo(() => {
		const network = roadNetworkOf(roads, junctions);
		const wanted: IWayAcross[] = offered
			? [
					{
						roadId: offered.roadId,
						startDistance: offered.startDistance,
						drivesTheOtherWay: offered.drivesTheOtherWay,
						seed: offered.entityId,
						isDriving: false,
						// The vehicle's own setting, if it has one already (one driving, dragged elsewhere).
						drivesThroughJunctions:
							entities.find((e) => e.id === offered.entityId)?.follow?.drivesThroughJunctions ??
							null,
					},
				]
			: editing
				? selectedItems.flatMap((item) => {
						const entity = item.kind === "entity" ? entities.find((e) => e.id === item.id) : null;
						return entity?.follow
							? [
									{
										roadId: entity.follow.roadId,
										startDistance: entity.follow.startDistance,
										drivesTheOtherWay: entity.follow.drivesTheOtherWay,
										seed: entity.id,
										isDriving: true,
										drivesThroughJunctions: entity.follow.drivesThroughJunctions,
									},
								]
							: [];
					})
				: [];
		const seen = new Set<string>();
		return wanted.flatMap((way) => {
			const road = roads.find((r) => r.id === way.roadId);
			if (!road) {
				return [];
			}
			if (drivesAcrossNetwork(network, road, traffic, way)) {
				return [{ key: `ahead:${way.seed}`, road, way, ahead: true }];
			}
			// Without junctions: the road's lane, once per road and direction, as always.
			const key = `${road.id}:${way.drivesTheOtherWay}`;
			if (seen.has(key)) {
				return [];
			}
			seen.add(key);
			return [{ key, road, way, ahead: false }];
		});
	}, [offered, editing, selectedItems, entities, roads, junctions, traffic]);

	return (
		<>
			{routes.map(({ key, road, way, ahead }) =>
				ahead ? (
					<WayAhead key={key} way={way} />
				) : (
					<RouteLine key={key} road={road} reverse={way.drivesTheOtherWay} />
				),
			)}
		</>
	);
};
