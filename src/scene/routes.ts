import { createPathSampler, type IPathSample, type IPathSampler } from "./paths";
import { laneOffset, roadCenterlineOf } from "./roads";
import {
	FollowSchema,
	type TDrivingSide,
	type TFollow,
	type TRoad,
	type TRoadPoint,
	type TVec2,
} from "./schema";

/**
 * Roads as vehicle routes: where a vehicle on a road is (in either direction),
 * and where a point on the ground lies relative to a road. Framework-free.
 * See docs/adr/0017-drawable-roads.md and 0031-two-way-routes-and-road-drops.md.
 */

type TRouteRoad = Pick<
	TRoad,
	"points" | "loops" | "cornerRadius" | "width" | "kind" | "traffic" | "isOneWay"
>;

// Roads are immutable (immer), so each road object's centre line only needs computing once.
const centerlines = new WeakMap<object, TRoadPoint[]>();

/** A road's centre line (`roadCenterlineOf`), worked out once per road object. */
export const centerlineOf = (
	road: Pick<TRoad, "points" | "loops" | "cornerRadius" | "width"> &
		Partial<Pick<TRoad, "curveShape">>,
) => {
	let line = centerlines.get(road);
	if (!line) {
		line = roadCenterlineOf(road);
		centerlines.set(road, line);
	}
	return line;
};

/**
 * The same path driven the other way. A loop keeps its first point, so a
 * distance d along the reversed loop is `length - d` along the original.
 */
const reversed = <T>(points: readonly T[], closed: boolean): T[] =>
	closed && points.length > 2 ? [points[0], ...points.slice(1).reverse()] : [...points].reverse();

/**
 * Where a vehicle is in its road's traffic (ADR-0042). Vehicles in the same
 * stream drive in the same lane and direction around the same cycle, so they
 * can follow and pass each other.
 */
export interface ITrafficPlace {
	/** Loops have a forward and a reverse stream; open roads one, driven there and back. */
	stream: "forward" | "reverse" | "both";
	/** Length of the stream's cycle. */
	ring: number;
	/** Where the vehicle is around the cycle, 0 to `ring`. */
	position: number;
	/** Distance along the road's centre line from its first point. */
	centre: number;
	/** 1 = driving towards the road's last point, -1 = towards its first. */
	direction: 1 | -1;
	/** Turning around at an open road's end, or (on a network) going through a junction. */
	turning: boolean;
	/** On a one-way road (ADR-0148): nothing comes the other way, so it can't overtake into it. */
	isOneWay?: boolean;
	/**
	 * On a road network (ADR-0136): the road it's on now and its length, and where it goes on to:
	 * which road, which way, where along it it comes on, and how far it has to go until then.
	 */
	network?: {
		roadId: string;
		length: number;
		next: { roadId: string; direction: 1 | -1; along: number; distance: number };
		/**
		 * The junction it drives into next, where a road is one-way so vehicles give way to each other
		 * there (ADR-0148): which end it comes in by, and how far it is to its cut-back line (0 or less
		 * once inside it), and how far to where it leaves it.
		 */
		junctionAhead?: { id: string; from: string; entersIn: number; leavesIn: number };
		/** Such a junction it has just left, by how far it is past it, and which end it came in by. */
		junctionBehind?: { id: string; from: string; leftBy: number };
	};
}

const wrap = (value: number, period: number) => ((value % period) + period) % period;

export interface IRouteSampler {
	/** Length of the road's centre line (one way). */
	length: number;
	/**
	 * A vehicle that starts `offset` along the road (measured from the road's
	 * first point, whichever way it drives) after travelling `travelled`.
	 */
	at: (offset: number, travelled?: number) => IPathSample;
	/**
	 * Distance `d` from where travel begins: the road's first point, or its last when reversed. Past
	 * `length` on an open road it carries on round the cycle: U-turn, back, U-turn.
	 */
	travel: (d: number) => IPathSample;
	/** Distance after which travel repeats: the loop, or there, U-turn, back and U-turn. */
	period: number;
	/** Length of each U-turn at an open road's ends (0 on loops). */
	turn: number;
	/** Where a vehicle (as for `at`) is in the road's traffic. */
	place: (offset: number, travelled?: number) => ITrafficPlace;
	/**
	 * How big a vehicle (as for `at`) is drawn, 0 to 1: it shrinks out at a one-way road's end with
	 * no way on and grows in where it starts over (ADR-0148). Always 1 when not given.
	 */
	sizeAt?: (offset: number, travelled?: number) => number;
}

/** How far a vehicle grows in or shrinks out where it appears or vanishes, in grid units. */
export const GROWS_OVER = 1.5;

export interface IRouteOptions {
	/** Heading smoothing (see `turnSmoothing`). */
	smoothing?: number;
	/** Drive against the order of the road's points, in the other lane. */
	reverse?: boolean;
}

/**
 * An open one-way road as a route (ADR-0148): first to last, shrinking out at its end and growing
 * in again at its start, round and round, never back. Traffic sees one stream round that cycle.
 */
const oneWayRoute = (sampler: IPathSampler, start: (offset: number) => number): IRouteSampler => {
	const { length } = sampler;
	const along = (offset: number, travelled = 0) => wrap(start(offset) + travelled, length);
	return {
		length,
		period: length,
		turn: 0,
		at: (offset, travelled = 0) => sampler.at(along(offset, travelled)),
		travel: (d) => sampler.at(wrap(d, length)),
		place: (offset, travelled = 0) => {
			const position = along(offset, travelled);
			return {
				stream: "forward",
				ring: length,
				position,
				centre: position,
				direction: 1,
				turning: false,
				isOneWay: true,
			};
		},
		sizeAt: (offset, travelled = 0) => {
			const position = along(offset, travelled);
			return Math.max(0, Math.min(1, position / GROWS_OVER, (length - position) / GROWS_OVER));
		},
	};
};

/** A road as a route for vehicles, in its driving lane, either way round (one-way: its way). */
export const createRouteSampler = (
	road: TRouteRoad,
	driving: TDrivingSide,
	{ smoothing = 0, reverse: asked = false }: IRouteOptions = {},
): IRouteSampler => {
	// A one-way road is driven only in the order of its points (ADR-0148).
	const reverse = asked && !road.isOneWay;
	const line = centerlineOf(road);
	const sampler = createPathSampler(reverse ? reversed(line, road.loops) : line, road.loops, {
		lane: laneOffset(road, driving),
		smoothing,
	});
	const start = (offset: number) => (reverse ? sampler.length - offset : offset);
	if (road.isOneWay && !road.loops && sampler.length > 0) {
		return oneWayRoute(sampler, start);
	}
	const { length, period, turn } = sampler;
	const looped = period === length;

	const place = (offset: number, travelled = 0): ITrafficPlace => {
		const d = start(offset) + travelled;
		if (looped || length === 0) {
			// A loop: the reverse stream runs the reversed loop, which keeps the first point.
			const position = length > 0 ? wrap(d, length) : 0;
			return {
				stream: reverse ? "reverse" : "forward",
				ring: length,
				position,
				centre: reverse && position > 0 ? length - position : position,
				direction: reverse ? -1 : 1,
				turning: false,
			};
		}
		// An open road is one cycle: there, U-turn, back, U-turn. Driving it reversed is the same
		// cycle, starting on the way back.
		const position = wrap(reverse ? d + length + turn : d, period);
		const base = { stream: "both" as const, ring: period, position };
		if (position < length) {
			return { ...base, centre: position, direction: 1, turning: false };
		}
		if (position < length + turn) {
			return { ...base, centre: length, direction: -1, turning: true };
		}
		if (position < 2 * length + turn) {
			return { ...base, centre: 2 * length + turn - position, direction: -1, turning: false };
		}
		return { ...base, centre: 0, direction: 1, turning: true };
	};

	return {
		length,
		period,
		turn,
		at: (offset, travelled = 0) => sampler.at(start(offset) + travelled),
		travel: (d) => sampler.at(d),
		place,
	};
};

export interface IRoadProjection {
	/** Distance along the centre line (from the first point) of the nearest point. */
	offset: number;
	/** Ground distance from the point to the centre line. */
	gap: number;
	/** Which side of the centre line the point is on: > 0 right of the road's direction, < 0 left. */
	side: number;
	/** Heading of the road there, going from its first point towards its last (radians, like IPathSample). */
	heading: number;
	/** Height of the road surface there. */
	height: number;
	/** Half the road's width there. */
	halfWidth: number;
}

/** The point on a road's centre line nearest to `at` (on the ground), and where `at` lies relative to it. */
export const projectOntoRoad = (road: TRouteRoad, at: TVec2): IRoadProjection | null => {
	const line = centerlineOf(road);
	const n = line.length;
	const count = road.loops && n > 2 ? n : n - 1;
	let best: IRoadProjection | null = null;
	let along = 0;
	for (let i = 0; i < count; i++) {
		const a = line[i];
		const b = line[(i + 1) % n];
		const dx = b[0] - a[0];
		const dz = b[1] - a[1];
		const length = Math.hypot(dx, dz);
		if (length === 0) {
			continue;
		}
		const t = Math.min(1, Math.max(0, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dz) / length ** 2));
		const x = a[0] + dx * t;
		const z = a[1] + dz * t;
		const gap = Math.hypot(at[0] - x, at[1] - z);
		if (!best || gap < best.gap) {
			const widthA = a[3] ?? road.width;
			const widthB = b[3] ?? road.width;
			best = {
				offset: along + length * t,
				gap,
				// Right of travel along (dx, dz) is (-dz, dx).
				side: ((at[0] - x) * -dz + (at[1] - z) * dx) / length,
				heading: Math.atan2(-dz, dx),
				height: a[2] + (b[2] - a[2]) * t,
				halfWidth: (widthA + (widthB - widthA) * t) / 2,
			};
		}
		along += length;
	}
	return best;
};

/**
 * How far a vehicle leans in a turn right now, in degrees about its own length
 * (ADR-0082): positive to its right, so a left turn (the heading growing) leans
 * it left when it leans into turns. By the sideways pull, its speed² × how
 * sharply the route bends over its length round where it is, times how much
 * its kind leans per unit of that (negative leans out of the turn), at most
 * `maxDegrees` either way.
 */
export const turnLeanDegrees = (
	sampler: IRouteSampler,
	{
		offset,
		travelled,
		length,
		speed,
	}: { offset: number; travelled: number; length: number; speed: number },
	{ degreesPerAcceleration, maxDegrees }: { degreesPerAcceleration: number; maxDegrees: number },
) => {
	const reach = Math.max(0.5, length / 2);
	const ahead = sampler.at(offset, travelled + reach).heading;
	const behind = sampler.at(offset, travelled - reach).heading;
	const bend = Math.atan2(Math.sin(ahead - behind), Math.cos(ahead - behind)) / (2 * reach);
	const lean = -bend * speed * speed * degreesPerAcceleration;
	return Math.max(-maxDegrees, Math.min(maxDegrees, lean));
};

/**
 * A one-way stream along a road (ADR-0112): from its first point to its last
 * (or, `reverse`, from its last to its first), in the lane for that way, and
 * from the start again. Flows use it: their vehicles show which way things go.
 */
export const createOneWaySampler = (
	road: TRouteRoad,
	driving: TDrivingSide,
	{ smoothing = 0, reverse = false }: IRouteOptions = {},
) => {
	const line = centerlineOf(road);
	const sampler = createPathSampler(reverse ? reversed(line, road.loops) : line, road.loops, {
		lane: laneOffset(road, driving),
		smoothing,
	});
	return {
		length: sampler.length,
		/** Where a vehicle is that has come `distance` along the stream (round again past its end). */
		at: (distance: number) => sampler.at(sampler.length > 0 ? wrap(distance, sampler.length) : 0),
	};
};

/**
 * A vehicle's way of driving, along another road: how it drove kept (speed,
 * where it starts, its turns), or the defaults if it was parked.
 */
export const followAlong = (follow: TFollow | null, roadId: string): TFollow => ({
	...(follow ?? FollowSchema.parse({ roadId })),
	roadId,
});
