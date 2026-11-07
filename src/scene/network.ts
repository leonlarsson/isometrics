import {
	cutLine,
	type INetworkEnd,
	type INetworkJunction,
	type IRoadNetwork,
	pointAlongLine,
} from "./junctions";
import { createPathSampler, type IPathSample, type IPathSampler, uTurnLength } from "./paths";
import {
	isHiddenRoute,
	laneOffset,
	polylineLength,
	resolveDrivesThroughJunctions,
	type TRoadEnd,
} from "./roads";
import { centerlineOf, GROWS_OVER, type IRouteSampler, type ITrafficPlace } from "./routes";
import type { TDrivingSide, TFollow, TRoad, TRoadPoint, TScene, TVec2 } from "./schema";

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
 * Which way out a vehicle takes, given a number from 0 to 1: one of them, evenly, or by their
 * `weights` where it has them (ADR-0148). Evenly, the same chance always picks the same way as
 * before weights. (Data could weight the ways later; this is the one place to.)
 */
export const pickWayOut = <W extends IWayOut>(
	ways: readonly W[],
	chance: number,
	weights?: readonly number[] | null,
) => {
	if (!weights) {
		return ways[Math.min(ways.length - 1, Math.floor(chance * ways.length))];
	}
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	let left = chance * total;
	for (let i = 0; i < ways.length; i++) {
		left -= weights[i];
		if (left < 0) {
			return ways[i];
		}
	}
	return ways[ways.length - 1];
};

/** A way out turning back further than this from the way a vehicle arrived (150°) is a U-turn. */
const TURNS_BACK = Math.cos((150 * Math.PI) / 180);

/**
 * How much a way out is taken at an interchange's junction (ADR-0148), by the cosine of its turn
 * from the way the vehicle arrived: straight on most, a right angle a quarter as much, a sharp turn
 * hardly ever.
 */
export const straightOnWeight = (cosine: number) => (1 + cosine) ** 2 + 0.05;

/**
 * The ways a vehicle arriving at a junction by `arriving` (its road's end there) may leave by, from
 * `candidates` (every other end it could drive), and how much each is taken (ADR-0148): never onto
 * a one-way road against its way; only those its end `leadsTo` when that's set; and at a junction
 * where a road is one-way, no turning back through it unless there's no other way, mostly straight
 * on (`weights`). Elsewhere every way alike (`weights` null), as before.
 */
export const waysOut = (
	junction: INetworkJunction,
	arriving: INetworkEnd | null,
	candidates: readonly INetworkEnd[],
): { ways: INetworkEnd[]; weights: number[] | null } => {
	let ways = candidates.filter((way) => !(way.isOneWay && way.end === "end"));
	const allowed = arriving?.leadsTo;
	if (allowed) {
		ways = ways.filter((way) =>
			allowed.some((to) => to.roadId === way.roadId && to.end === way.end),
		);
	}
	if (!junction.hasOneWayRoad || !arriving || ways.length === 0) {
		return { ways, weights: null };
	}
	// The way it arrived: towards the junction, against its road's direction away from it.
	const inward: TVec2 = [-arriving.direction[0], -arriving.direction[1]];
	const cosineOf = (way: INetworkEnd) =>
		inward[0] * way.direction[0] + inward[1] * way.direction[1];
	const onward = ways.filter((way) => cosineOf(way) > TURNS_BACK);
	if (onward.length > 0) {
		ways = onward;
	}
	return { ways, weights: ways.map((way) => straightOnWeight(cosineOf(way))) };
};

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
	/**
	 * How it leaves: through a junction, along a curve onto another road, by turning round, or (at
	 * the end of a one-way road with no way on, ADR-0148) by vanishing to start over where it began.
	 */
	exit:
		| {
				kind: "junction";
				way: IWayOut;
				curve: TRoadPoint[];
				curveLength: number;
				/** The junction, and whether its vehicles give way to each other (a road there is one-way). */
				junctionId: string;
				givesWay: boolean;
		  }
		| { kind: "turn"; turnLength: number }
		| { kind: "startOver" };
	/** It has just started over (ADR-0148): it grows in from where it comes onto the road. */
	growsIn: boolean;
	/** Its road is one-way. */
	isOneWay: boolean;
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
	/**
	 * Where it starts over at a one-way road's dead end (ADR-0148): where it started (a vehicle
	 * object), or with this its road's start (a flow's vehicles, spread along it, so one doesn't
	 * appear in the middle of the traffic behind it).
	 */
	startsOverAtRoadStart?: boolean;
	/**
	 * The ground, so it starts over by preference at an entry by its edge (ADR-0148): traffic
	 * driving in from off the map.
	 */
	ground?: { width: number; depth: number };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const same = (a: readonly number[], b: readonly number[]) =>
	Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

/** A road end that traffic drives into the network by (ADR-0148): one at no junction. */
export interface INetworkEntry {
	roadId: string;
	/** The way in along the road: 1 from its first point, -1 from its last. */
	direction: 1 | -1;
	/** Where it is: [x, z, altitude]. */
	point: TRoadPoint;
	/** How far it is to drive from there to the road asked about, its way. */
	distance: number;
}

const entriesOf = new WeakMap<IRoadNetwork, Map<string, INetworkEntry[]>>();

/**
 * Where traffic can drive into the network and on to a road, driven its way (ADR-0148): every open
 * road end (at no junction) of a drawn road that vehicles may drive in at, the first point of a
 * one-way road or either open end of a two-way one, from which the road can be reached, driving
 * as vehicles may (never against a one-way road, turning round only at a two-way dead end, within
 * a junction end's `leadsTo`), with how far that drive is. Worked out once per network and road.
 */
export const networkEntries = (
	network: IRoadNetwork,
	roadId: string,
	direction: 1 | -1 = 1,
): INetworkEntry[] => {
	let byRoad = entriesOf.get(network);
	if (!byRoad) {
		byRoad = new Map();
		entriesOf.set(network, byRoad);
	}
	const key = `${roadId}:${direction}`;
	const known = byRoad.get(key);
	if (known) {
		return known;
	}
	const roads = new Map<string, TRoad>();
	for (const junction of network.junctions) {
		for (const end of junction.ends) {
			const road = network.roadById(end.roadId);
			if (road) {
				roads.set(road.id, road);
			}
		}
	}
	const own = network.roadById(roadId);
	if (own) {
		roads.set(own.id, own);
	}
	const lengthOf = new Map(
		[...roads.values()].map((road) => [road.id, polylineLength(centerlineOf(road), false)]),
	);
	/** Where a vehicle driving a road one way can go on to, and how far it drives to get there. */
	const nextOf = (id: string, way: 1 | -1): { id: string; way: 1 | -1; cost: number }[] => {
		const road = roads.get(id);
		if (!road) {
			return [];
		}
		const cost = lengthOf.get(id) ?? 0;
		const exitEnd: TRoadEnd = way > 0 ? "end" : "start";
		const junction = network.junctionAt(id, exitEnd);
		if (!junction) {
			return road.isOneWay ? [] : [{ id, way: way > 0 ? -1 : 1, cost }];
		}
		const leadsTo = network.endAt(id, exitEnd)?.leadsTo ?? null;
		return junction.ends
			.filter(
				(end) =>
					!(end.roadId === id && end.end === exitEnd) &&
					!(roads.get(end.roadId)?.isOneWay && end.end === "end") &&
					(leadsTo === null ||
						leadsTo.some((to) => to.roadId === end.roadId && to.end === end.end)),
			)
			.map((end) => ({ id: end.roadId, way: end.end === "start" ? 1 : -1, cost }));
	};
	/** How far it is to drive from a road driven one way to the road asked about, if it can. */
	const distanceTo = (fromId: string, fromWay: 1 | -1) => {
		const best = new Map<string, number>([[`${fromId}:${fromWay}`, 0]]);
		const queue: { id: string; way: 1 | -1; at: number }[] = [{ id: fromId, way: fromWay, at: 0 }];
		while (queue.length > 0) {
			queue.sort((a, b) => a.at - b.at);
			const here = queue.shift() as { id: string; way: 1 | -1; at: number };
			if (here.id === roadId && here.way === direction) {
				return here.at;
			}
			for (const next of nextOf(here.id, here.way)) {
				const at = here.at + next.cost;
				const nextKey = `${next.id}:${next.way}`;
				if (at < (best.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
					best.set(nextKey, at);
					queue.push({ id: next.id, way: next.way, at });
				}
			}
		}
		return null;
	};
	const entries: INetworkEntry[] = [];
	for (const road of roads.values()) {
		if (isHiddenRoute(road.kind) || road.points.length < 2 || road.loops) {
			continue;
		}
		const ways: (1 | -1)[] = road.isOneWay ? [1] : [1, -1];
		for (const way of ways) {
			if (network.junctionAt(road.id, way > 0 ? "start" : "end")) {
				continue;
			}
			const distance = distanceTo(road.id, way);
			if (distance !== null) {
				const point = way > 0 ? road.points[0] : road.points[road.points.length - 1];
				entries.push({
					roadId: road.id,
					direction: way,
					point: [point[0], point[1], point[2]],
					distance,
				});
			}
		}
	}
	entries.sort((a, b) => a.distance - b.distance || a.roadId.localeCompare(b.roadId));
	byRoad.set(key, entries);
	return entries;
};

/** An entry this near the ground's edge is where traffic drives in from off the map. */
const AT_THE_EDGE = 2;

/**
 * The entry a vehicle starts over at (ADR-0148), the `round`th time: one by the ground's edge if
 * the network has any (traffic coming in from off the map), else any; of those, the nearer drives
 * to its road (within half as far again as the nearest, and 20), picked by its seed. Null where
 * nothing drives into the network: it starts over where it began.
 */
export const entryToStartOverAt = (
	network: IRoadNetwork,
	roadId: string,
	direction: 1 | -1,
	seed: string,
	round: number,
	ground?: { width: number; depth: number },
): INetworkEntry | null => {
	const entries = networkEntries(network, roadId, direction);
	if (entries.length === 0) {
		return null;
	}
	const atEdge = ground
		? entries.filter(
				({ point }) =>
					Math.abs(point[0]) >= ground.width / 2 - AT_THE_EDGE ||
					Math.abs(point[1]) >= ground.depth / 2 - AT_THE_EDGE,
			)
		: [];
	const pool = atEdge.length > 0 ? atEdge : entries;
	const nearest = pool[0].distance;
	const near = pool.filter((entry) => entry.distance <= Math.max(nearest * 1.5, nearest + 20));
	return near[Math.min(near.length - 1, Math.floor(chanceOf(seed, -100 - round) * near.length))];
};

/** A trip across the network as a route sampler, from a road that has a junction at an end. */
export const createNetworkTrip = (
	network: IRoadNetwork,
	roadId: string,
	{
		driving,
		smoothing = 0,
		startDistance,
		reverse = false,
		seed,
		startsOverAtRoadStart = false,
		ground,
	}: INetworkTripOptions,
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
		growsIn = false,
	): ILeg | null => {
		const info = roadInfo(id);
		if (!info || info.length === 0) {
			return null;
		}
		const line = oriented(info.line, direction);
		const exitEnd: TRoadEnd = direction > 0 ? "end" : "start";
		const junction = network.junctionAt(id, exitEnd);
		const { ways, weights } = junction
			? waysOut(
					junction,
					network.endAt(id, exitEnd),
					junction.ends.filter(
						(e) => !(e.roadId === id && e.end === exitEnd) && (roadInfo(e.roadId)?.length ?? 0) > 0,
					),
				)
			: { ways: [], weights: null };
		const start = Math.min(Math.max(from, 0), info.length);
		const isOneWay = info.road.isOneWay ?? false;
		const base = {
			index,
			roadId: id,
			direction,
			line,
			length: info.length,
			lane: info.lane,
			growsIn,
			isOneWay,
		};
		if ((!junction || ways.length === 0) && isOneWay) {
			// Nowhere on and it can't turn round: it vanishes at the end and starts over (ADR-0148).
			return {
				...base,
				from: start,
				bodyFrom,
				bodyTo: info.length,
				exit: { kind: "startOver" },
				startsAt,
				ownLength: Math.max(1e-6, info.length - start),
				previous,
			};
		}
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
		const way = pickWayOut(ways, chanceOf(seed, index), weights);
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
			exit: {
				kind: "junction",
				way,
				curve,
				curveLength,
				junctionId: junction.id,
				givesWay: junction.hasOneWayRoad,
			},
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
		if (leg.exit.kind === "startOver") {
			const entry = entryAfter(leg.index);
			return entry
				? makeLeg(entry.roadId, entry.direction, 0, 0, null, leg.index + 1, startsAt, true)
				: makeLeg(roadId, startDirection, restartAlong, 0, null, leg.index + 1, startsAt, true);
		}
		const { way } = leg.exit;
		const trim = network.endAt(way.roadId, way.end)?.routeTrim ?? 0;
		const direction = way.end === "start" ? 1 : -1;
		return makeLeg(way.roadId, direction, trim, trim, leg, leg.index + 1, startsAt);
	};

	const startInfo = roadInfo(roadId);
	// A one-way road is driven its way, whatever the vehicle's setting says (ADR-0148).
	const backwards = reverse && !startInfo?.road.isOneWay;
	const startDirection: 1 | -1 = backwards ? -1 : 1;
	const startAlong = startInfo
		? Math.min(
				Math.max(0, backwards ? startInfo.length - startDistance : startDistance),
				startInfo.length,
			)
		: 0;
	const firstLeg = () => makeLeg(roadId, startDirection, startAlong, 0, null, 0, 0);
	/**
	 * Where it starts over after a one-way dead end (ADR-0148): at an entry to the network, an open
	 * road end traffic drives in by, so it comes into view as traffic does; only where nothing drives
	 * into the network, where it began (a flow's vehicles at their road's start).
	 */
	const entryAfter = (index: number) =>
		entryToStartOverAt(network, roadId, startDirection, seed, index, ground);
	const restartAlong = startsOverAtRoadStart
		? (network.endAt(roadId, "start")?.routeTrim ?? 0)
		: startAlong;

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

	/** How far past a junction a vehicle still counts as in it: its rear may still be there. */
	const STILL_IN = 3;
	/** The junctions where vehicles give way that a vehicle `along` its leg is coming to or leaving. */
	const junctionsAround = (leg: ILeg, along: number) => {
		const exitEnd = leg.direction > 0 ? "end" : "start";
		const ahead =
			leg.exit.kind === "junction" && leg.exit.givesWay
				? {
						junctionAhead: {
							id: leg.exit.junctionId,
							from: `${leg.roadId}:${exitEnd}`,
							entersIn: leg.bodyTo - along,
							leavesIn: leg.bodyTo + leg.exit.curveLength - along,
						},
					}
				: {};
		const previous = leg.previous;
		const behind =
			previous?.exit.kind === "junction" &&
			previous.exit.givesWay &&
			along - leg.bodyFrom < STILL_IN
				? {
						junctionBehind: {
							id: previous.exit.junctionId,
							from: `${previous.roadId}:${previous.direction > 0 ? "end" : "start"}`,
							leftBy: along - leg.bodyFrom,
						},
					}
				: {};
		return { ...ahead, ...behind };
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
				: leg.exit.kind === "startOver"
					? // It comes back where it starts over: it keeps its distance to what's there.
						(() => {
							const entry = entryAfter(leg.index);
							return entry
								? {
										roadId: entry.roadId,
										direction: entry.direction,
										along: 0,
										distance: end - travelled,
									}
								: {
										roadId,
										direction: startDirection,
										along: restartAlong,
										distance: end - travelled,
									};
						})()
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
			...(leg.isOneWay ? { isOneWay: true } : {}),
			network: {
				roadId: leg.roadId,
				length: leg.length,
				next,
				...junctionsAround(leg, along),
			},
		};
	};

	/** Shrinking out before it starts over, growing in after (ADR-0148); whole otherwise. */
	const sizeAt = (_offset: number, travelled = 0) => {
		const leg = legAt(travelled);
		if (!leg) {
			return 1;
		}
		const along = leg.from + Math.max(0, travelled - leg.startsAt);
		let size = 1;
		if (leg.exit.kind === "startOver") {
			size = Math.min(size, (leg.bodyTo - along) / GROWS_OVER);
		}
		if (leg.growsIn) {
			size = Math.min(size, (along - leg.from) / GROWS_OVER);
		}
		return Math.max(0, Math.min(1, size));
	};

	return {
		length: startInfo?.length ?? 0,
		period: Number.POSITIVE_INFINITY,
		turn: 0,
		at,
		travel: (d) => at(0, d),
		place,
		sizeAt,
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
