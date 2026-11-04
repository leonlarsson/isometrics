import { cutLine, type IRoadNetwork, pointAlongLine } from "./junctions";
import { createPathSampler, type IPathSample, type IPathSampler, uTurnLength } from "./paths";
import { laneOffset, polylineLength, resolveDrivesThroughJunctions, type TRoadEnd } from "./roads";
import { centerlineOf, type IRouteSampler, type ITrafficPlace } from "./routes";
import type { TDrivingSide, TFollow, TRoad, TRoadPoint, TScene } from "./schema";

/**
 * A vehicle driving a road network (ADR-0136): from where it starts on its
 * road, on at each junction along a way it picks at random (never back the
 * way it came, unless there's no other), turning round only at dead ends.
 * Framework-free and a function of the distance driven, like a route sampler,
 * so the same vehicle takes the same way every time.
 */

/** How far back and ahead of a road's own stretch its piece reaches, for smooth turns. */
const REACH = 4;
/** Pieces further back than this behind the furthest distance asked for are let go. */
const HISTORY = 40;
/** Steps in each curve through a junction. */
const CURVE_STEPS = 10;
/** The cycle traffic sees a network vehicle in: longer than anything, so it never wraps. */
export const NETWORK_RING = 1e7;

/**
 * Whether a vehicle starting on `road` drives a trip across the network: the road has a junction
 * at an end, and the settings (`resolveDrivesThroughJunctions`: the vehicle's, else the road's,
 * else the world's) let it drive through. Otherwise it keeps to its road, as before junctions.
 * The one test for it: vehicles, the route highlight and the drop preview all ask this.
 */
export const drivesAcrossNetwork = (
	network: IRoadNetwork,
	road: Pick<TRoad, "id" | "traffic">,
	traffic: Pick<TScene["traffic"], "drivesThroughJunctions">,
	follow: Pick<TFollow, "drivesThroughJunctions"> | null | undefined,
) =>
	network.connects(road.id) &&
	resolveDrivesThroughJunctions(
		traffic.drivesThroughJunctions,
		road.traffic.drivesThroughJunctions,
		follow?.drivesThroughJunctions,
	);

/** A way out of a junction: a road end, driven away from the junction. */
export interface IWayOut {
	roadId: string;
	end: TRoadEnd;
}

/**
 * Which way out a vehicle takes, given a number from 0 to 1: one of them,
 * evenly. (Data could weight the ways later; this is the one place to.)
 */
export const pickWayOut = (ways: readonly IWayOut[], chance: number) =>
	ways[Math.min(ways.length - 1, Math.floor(chance * ways.length))];

/** A number from 0 to 1 for a vehicle's `n`th choice: always the same for the same vehicle and n. */
export const chanceOf = (seed: string, n: number) => {
	let hash = 2166136261 ^ n;
	for (let i = 0; i < seed.length; i++) {
		hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
	}
	hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
	hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
	return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
};

/** One road driven one way, between where the vehicle comes onto it and where it leaves. */
interface ILeg {
	/** Its place in the trip: 0 for the road it starts on. */
	index: number;
	roadId: string;
	/** 1 = towards the road's last point, -1 = towards its first. */
	direction: 1 | -1;
	/** The road's centre line in the way it's driven, its length and its lane. */
	line: TRoadPoint[];
	length: number;
	lane: number;
	/** Where (along `line`) the vehicle comes onto it, and where its drawn stretch begins and ends. */
	from: number;
	bodyFrom: number;
	bodyTo: number;
	/** How it leaves: through a junction, along a curve onto another road, or by turning round. */
	exit:
		| { kind: "junction"; way: IWayOut; curve: TRoadPoint[]; curveLength: number }
		| { kind: "turn"; turnLength: number };
	/** Distance driven when it comes onto this road, and how much of the trip it is. */
	startsAt: number;
	ownLength: number;
	previous: ILeg | null;
	/** The path it's sampled on, made when first asked for. */
	piece?: { sampler: IPathSampler; offset: number; total: number };
}

export interface INetworkTripOptions {
	driving: TDrivingSide;
	/** Heading smoothing (see `turnSmoothing`). */
	smoothing?: number;
	/** Where it starts along its road, from its first point (a follow's `startDistance`). */
	startDistance: number;
	/** Drives the road it starts on against the order of its points. */
	reverse?: boolean;
	/** Seeds its choices: the vehicle's id. */
	seed: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const same = (a: readonly number[], b: readonly number[]) =>
	Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

/** A trip across the network as a route sampler, from a road that has a junction at an end. */
export const createNetworkTrip = (
	network: IRoadNetwork,
	roadId: string,
	{ driving, smoothing = 0, startDistance, reverse = false, seed }: INetworkTripOptions,
): IRouteSampler => {
	const roadInfo = (id: string) => {
		const road = network.roadById(id);
		if (!road) {
			return null;
		}
		const line = centerlineOf(road);
		return { road, line, length: polylineLength(line, false), lane: laneOffset(road, driving) };
	};
	const oriented = (line: TRoadPoint[], direction: 1 | -1) =>
		direction > 0 ? line : [...line].reverse();

	/** A road driven one way from `from`, entered at `bodyFrom` (its cut, when from a junction). */
	const makeLeg = (
		id: string,
		direction: 1 | -1,
		from: number,
		bodyFrom: number,
		previous: ILeg | null,
		index: number,
		startsAt: number,
	): ILeg | null => {
		const info = roadInfo(id);
		if (!info || info.length === 0) {
			return null;
		}
		const line = oriented(info.line, direction);
		const exitEnd: TRoadEnd = direction > 0 ? "end" : "start";
		const junction = network.junctionAt(id, exitEnd);
		const ways = (junction?.ends ?? []).filter(
			(e) => !(e.roadId === id && e.end === exitEnd) && (roadInfo(e.roadId)?.length ?? 0) > 0,
		);
		const start = Math.min(Math.max(from, 0), info.length);
		const base = { index, roadId: id, direction, line, length: info.length, lane: info.lane };
		if (!junction || ways.length === 0) {
			const turnLength = uTurnLength(info.lane, smoothing);
			return {
				...base,
				from: start,
				bodyFrom,
				bodyTo: info.length,
				exit: { kind: "turn", turnLength },
				startsAt,
				ownLength: Math.max(1e-6, info.length + turnLength - start),
				previous,
			};
		}
		const way = pickWayOut(ways, chanceOf(seed, index));
		const exitTrim = network.endAt(id, exitEnd)?.routeTrim ?? 0;
		const bodyTo = Math.max(bodyFrom, info.length - exitTrim);
		// The curve through the junction, on the centre line: from where this road's cut is, by the
		// junction, to where the next one's is.
		const next = roadInfo(way.roadId);
		const nextLine = next ? oriented(next.line, way.end === "start" ? 1 : -1) : line;
		const nextTrim = network.endAt(way.roadId, way.end)?.routeTrim ?? 0;
		const a = pointAlongLine(line, bodyTo);
		const b = pointAlongLine(nextLine, nextTrim);
		const via = junction.place;
		const curve: TRoadPoint[] = [];
		let curveLength = 0;
		if (!same(a, b)) {
			let last = a;
			for (let step = 1; step <= CURVE_STEPS; step++) {
				const t = step / CURVE_STEPS;
				const u = 1 - t;
				const point: TRoadPoint = [
					u * u * a[0] + 2 * u * t * via[0] + t * t * b[0],
					u * u * a[1] + 2 * u * t * via[1] + t * t * b[1],
					lerp(a[2], b[2], t),
				];
				curveLength += Math.hypot(point[0] - last[0], point[1] - last[1]);
				curve.push(point);
				last = point;
			}
		}
		return {
			...base,
			from: start,
			bodyFrom,
			bodyTo,
			exit: { kind: "junction", way, curve, curveLength },
			startsAt,
			ownLength: Math.max(1e-6, bodyTo + curveLength - start),
			previous,
		};
	};

	const legAfter = (leg: ILeg): ILeg | null => {
		const startsAt = leg.startsAt + leg.ownLength;
		if (leg.exit.kind === "turn") {
			return makeLeg(leg.roadId, leg.direction > 0 ? -1 : 1, 0, 0, null, leg.index + 1, startsAt);
		}
		const { way } = leg.exit;
		const trim = network.endAt(way.roadId, way.end)?.routeTrim ?? 0;
		const direction = way.end === "start" ? 1 : -1;
		return makeLeg(way.roadId, direction, trim, trim, leg, leg.index + 1, startsAt);
	};

	const startInfo = roadInfo(roadId);
	const startDirection: 1 | -1 = reverse ? -1 : 1;
	const startAlong = startInfo
		? Math.min(
				Math.max(0, reverse ? startInfo.length - startDistance : startDistance),
				startInfo.length,
			)
		: 0;
	const firstLeg = () => makeLeg(roadId, startDirection, startAlong, 0, null, 0, 0);

	/** The path a leg is sampled on: the end of the road before and its curve, the road, the next curve and road's start. */
	const pieceOf = (leg: ILeg) => {
		if (leg.piece) {
			return leg.piece;
		}
		const points: TRoadPoint[] = [];
		/** Where lanes change along the path: [distance, lane] marks, eased between neighbours. */
		const marks: [number, number, boolean][] = [];
		let length = 0;
		const add = (list: readonly TRoadPoint[], lane: number, easesIn: boolean) => {
			for (const p of list) {
				const last = points[points.length - 1];
				if (last) {
					if (same(last, p)) {
						continue;
					}
					length += Math.hypot(p[0] - last[0], p[1] - last[1]);
				}
				points.push([p[0], p[1], p[2]]);
			}
			marks.push([length, lane, easesIn]);
		};
		const previous = leg.previous;
		if (previous && previous.exit.kind === "junction") {
			add(
				cutLine(
					previous.line,
					Math.max(previous.bodyFrom, previous.bodyTo - REACH),
					previous.length - previous.bodyTo,
				),
				previous.lane,
				false,
			);
			add(previous.exit.curve, leg.lane, true);
		}
		const before = length;
		add(cutLine(leg.line, leg.bodyFrom, leg.length - leg.bodyTo), leg.lane, false);
		if (leg.exit.kind === "junction") {
			const { way, curve } = leg.exit;
			const next = roadInfo(way.roadId);
			add(curve, next?.lane ?? leg.lane, true);
			if (next) {
				const line = oriented(next.line, way.end === "start" ? 1 : -1);
				const trim = network.endAt(way.roadId, way.end)?.routeTrim ?? 0;
				add(cutLine(line, trim, Math.max(0, next.length - trim - REACH)), next.lane, false);
			}
		}
		// The lane at a distance: each stretch's own, easing over a curve from the one before.
		const laneAt = (d: number) => {
			let start = 0;
			let lane = marks[0]?.[1] ?? leg.lane;
			for (const [end, value, easesIn] of marks) {
				if (d <= end) {
					return easesIn && end > start
						? lerp(lane, value, ease((d - start) / (end - start)))
						: value;
				}
				start = end;
				lane = value;
			}
			return lane;
		};
		const sampler = createPathSampler(points, false, { lane: leg.lane, smoothing, laneAt });
		leg.piece = { sampler, offset: before - leg.bodyFrom, total: sampler.length };
		return leg.piece;
	};

	let legs: ILeg[] = [];
	let furthest = 0;
	const reset = () => {
		const first = firstLeg();
		legs = first ? [first] : [];
		furthest = 0;
	};
	reset();

	/** The leg a distance driven falls in, adding legs as it gets further. */
	const legAt = (travelled: number): ILeg | null => {
		if (legs.length === 0) {
			return null;
		}
		if (travelled < legs[0].startsAt) {
			if (travelled < furthest - 2 * HISTORY) {
				reset(); // driving began again: the same way from the start
			} else {
				return legs[0];
			}
		}
		furthest = Math.max(furthest, travelled);
		let last = legs[legs.length - 1];
		while (travelled >= last.startsAt + last.ownLength) {
			const next = legAfter(last);
			if (!next) {
				return last;
			}
			legs.push(next);
			last = next;
		}
		// Let go of what's far behind, keeping the piece before for looking back.
		while (legs.length > 2 && legs[1].startsAt + legs[1].ownLength < furthest - HISTORY) {
			legs.shift();
			legs[0].previous = null;
		}
		for (let i = legs.length - 1; i >= 0; i--) {
			if (travelled >= legs[i].startsAt) {
				return legs[i];
			}
		}
		return legs[0];
	};

	const still: IPathSample = { position: [0, 0], height: 0, heading: 0, pitch: 0 };

	const at = (_offset: number, travelled = 0): IPathSample => {
		const leg = legAt(travelled);
		if (!leg) {
			return still;
		}
		const piece = pieceOf(leg);
		const along = leg.from + Math.max(0, travelled - leg.startsAt);
		const most = piece.total + (leg.exit.kind === "turn" ? leg.exit.turnLength : 0);
		return piece.sampler.at(Math.min(Math.max(0, piece.offset + along), most));
	};

	const place = (_offset: number, travelled = 0): ITrafficPlace => {
		const leg = legAt(travelled);
		if (!leg) {
			return {
				stream: "forward",
				ring: NETWORK_RING,
				position: 0,
				centre: 0,
				direction: 1,
				turning: false,
			};
		}
		const along = leg.from + Math.max(0, travelled - leg.startsAt);
		const end = leg.startsAt + leg.ownLength;
		const next =
			leg.exit.kind === "junction"
				? {
						roadId: leg.exit.way.roadId,
						direction: (leg.exit.way.end === "start" ? 1 : -1) as 1 | -1,
						along: network.endAt(leg.exit.way.roadId, leg.exit.way.end)?.routeTrim ?? 0,
						distance: end - travelled,
					}
				: {
						roadId: leg.roadId,
						direction: (leg.direction > 0 ? -1 : 1) as 1 | -1,
						along: 0,
						distance: end - travelled,
					};
		return {
			stream: leg.direction > 0 ? "forward" : "reverse",
			ring: NETWORK_RING,
			position: along,
			centre: Math.min(leg.length, Math.max(0, leg.direction > 0 ? along : leg.length - along)),
			direction: leg.direction,
			turning: along > leg.bodyTo + 1e-6,
			network: { roadId: leg.roadId, length: leg.length, next },
		};
	};

	return {
		length: startInfo?.length ?? 0,
		period: Number.POSITIVE_INFINITY,
		turn: 0,
		at,
		travel: (d) => at(0, d),
		place,
	};
};

/** The roads a trip drives, in order, over its first `distance` (for tests and checks). */
export const roadsDriven = (trip: IRouteSampler, distance: number, step = 0.25) => {
	const roads: string[] = [];
	for (let d = 0; d <= distance; d += step) {
		const roadId = trip.place(0, d).network?.roadId;
		if (roadId && roads[roads.length - 1] !== roadId) {
			roads.push(roadId);
		}
	}
	return roads;
};

/** The way a vehicle will drive from somewhere on its trip: where it'll be, and the roads it takes. */
export interface IPathAhead {
	/** Where it will be every `step`, in its lane, from where it is now. */
	samples: IPathSample[];
	/** The roads it drives along the way, in order, the one it's on first. */
	roads: string[];
}

/**
 * The way ahead of a vehicle on a road network (ADR-0136), `distance` of it
 * from `from` driven: exactly as its trip will drive it, since its choices at
 * junctions are seeded by its id. What the route highlight shows for a
 * selected vehicle (from how far it has driven) and while one is dropped onto
 * a road (from 0). It works on a trip of its own, so the vehicle's isn't moved.
 */
export const pathAhead = (
	network: IRoadNetwork,
	roadId: string,
	options: INetworkTripOptions,
	from: number,
	distance: number,
	step = 0.25,
): IPathAhead => {
	const trip = createNetworkTrip(network, roadId, options);
	const samples: IPathSample[] = [];
	const roads: string[] = [];
	const count = Math.max(1, Math.ceil(distance / step));
	for (let i = 0; i <= count; i++) {
		const d = from + (distance * i) / count;
		samples.push(trip.at(0, d));
		const on = trip.place(0, d).network?.roadId;
		if (on && roads[roads.length - 1] !== on) {
			roads.push(on);
		}
	}
	return { samples, roads };
};
