import { createPathSampler, type IPathSample } from "./paths";
import { laneOffset, roadCenterlineOf } from "./roads";
import type { TDrivingSide, TRoad, TRoadPoint, TVec2 } from "./schema";

/**
 * Roads as vehicle routes: where a vehicle on a road is (in either direction),
 * and where a point on the ground lies relative to a road. Framework-free.
 * See docs/adr/0017-drawable-roads.md and 0031-two-way-routes-and-road-drops.md.
 */

type TRouteRoad = Pick<
	TRoad,
	"points" | "closed" | "cornerRadius" | "width" | "style" | "lane" | "turns"
>;

// Roads are immutable (immer), so each road object's centre line only needs computing once.
const centerlines = new WeakMap<object, TRoadPoint[]>();

const centerlineOf = (road: TRouteRoad) => {
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

export interface IRouteSampler {
	/** Length of the road's centre line (one way). */
	length: number;
	/**
	 * A vehicle that starts `offset` along the road (measured from the road's
	 * first point, whichever way it drives) after travelling `travelled`.
	 */
	at: (offset: number, travelled?: number) => IPathSample;
	/** Distance `d` from where travel begins: the road's first point, or its last when reversed. */
	travel: (d: number) => IPathSample;
}

export interface IRouteOptions {
	/** Heading smoothing (see `turnSmoothing`). */
	smoothing?: number;
	/** Drive against the order of the road's points, in the other lane. */
	reverse?: boolean;
}

/** A road as a route for vehicles, in its driving lane, either way round. */
export const createRouteSampler = (
	road: TRouteRoad,
	driving: TDrivingSide,
	{ smoothing = 0, reverse = false }: IRouteOptions = {},
): IRouteSampler => {
	const line = centerlineOf(road);
	const sampler = createPathSampler(reverse ? reversed(line, road.closed) : line, road.closed, {
		lane: laneOffset(road, driving),
		smoothing,
	});
	const start = (offset: number) => (reverse ? sampler.length - offset : offset);
	return {
		length: sampler.length,
		at: (offset, travelled = 0) => sampler.at(start(offset) + travelled),
		travel: (d) => sampler.at(d),
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
	const count = road.closed && n > 2 ? n : n - 1;
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
