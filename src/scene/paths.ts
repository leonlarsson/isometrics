import type { TVec2 } from "./schema";

export interface IPathSample {
	position: TVec2;
	/** Height above ground at this point (0 for flat paths). */
	height: number;
	/** Rotation around Y (radians) that points a +X-forward model along the path. */
	heading: number;
	/** Nose-up tilt (radians) on slopes, in the direction of travel. */
	pitch: number;
}

export interface IPathSampler {
	/** Length of the path itself (one way for open paths, U-turns not included). */
	length: number;
	/** Distance after which the motion repeats: the loop, or there, U-turn, back and U-turn. */
	period: number;
	/** Length of each U-turn at an open path's ends (0 on loops). */
	turn: number;
	at(distance: number): IPathSample;
}

export interface IPathSamplerOptions {
	/**
	 * Sideways offset from the centre line, positive = to the right of the
	 * direction of travel (a driving lane). Applied by the sampler so it follows
	 * the smoothed heading through corners and U-turns.
	 */
	lane?: number;
	/**
	 * How far behind and ahead (grid units) the heading looks, so vehicles turn
	 * gradually instead of snapping at every corner; about half a vehicle's
	 * length. 0 = the exact heading of the current segment.
	 */
	smoothing?: number;
}

interface ISegment {
	start: number;
	length: number;
	from: TVec2;
	to: TVec2;
	fromHeight: number;
	toHeight: number;
}

/** [x, z], [x, z, height], or a road point with its width (ignored here). */
type TPathPoint =
	| TVec2
	| readonly [number, number, number]
	| readonly [number, number, number, number];

/** A vehicle with no lane turns on the spot over this distance at the end of an open path. */
const PIVOT_DISTANCE = 1.2;

const headingOf = (from: TVec2, to: TVec2) => Math.atan2(-(to[1] - from[1]), to[0] - from[0]);

/** Unit vector along a heading, and the one to its right (right of +X is +Z). */
const forwardOf = (heading: number): TVec2 => [Math.cos(heading), -Math.sin(heading)];
const rightOf = (heading: number): TVec2 => [Math.sin(heading), Math.cos(heading)];

const offset = (position: TVec2, direction: TVec2, by: number): TVec2 => [
	position[0] + direction[0] * by,
	position[1] + direction[1] * by,
];

/**
 * Sample positions along a polyline by distance travelled. Closed paths loop;
 * open paths go back and forth, turning around at each end: vehicles in a
 * lane drive a half circle into the opposite lane, vehicles without one turn
 * on the spot. With `smoothing`, headings and slopes change gradually.
 */
export const createPathSampler = (
	points: readonly TPathPoint[],
	closed: boolean,
	{ lane = 0, smoothing = 0 }: IPathSamplerOptions = {},
): IPathSampler => {
	const looped = closed && points.length > 2;
	const pts = looped ? [...points, points[0]] : points;
	const segments: ISegment[] = [];
	let total = 0;
	for (let i = 0; i < pts.length - 1; i++) {
		const from = pts[i];
		const to = pts[i + 1];
		const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
		if (length === 0) {
			continue;
		}
		segments.push({
			start: total,
			length,
			from: [from[0], from[1]],
			to: [to[0], to[1]],
			fromHeight: from[2] ?? 0,
			toHeight: to[2] ?? 0,
		});
		total += length;
	}

	if (segments.length === 0) {
		const p = pts[0];
		const still: IPathSample = {
			position: p ? [p[0], p[1]] : [0, 0],
			height: p?.[2] ?? 0,
			heading: 0,
			pitch: 0,
		};
		return { length: 0, period: 0, turn: 0, at: () => still };
	}

	/** Distance along the path: wrapped on loops, clamped to the ends otherwise. */
	const along = (d: number) =>
		looped ? ((d % total) + total) % total : Math.min(Math.max(d, 0), total);

	const segmentAt = (d: number) => {
		for (const s of segments) {
			if (d <= s.start + s.length) {
				return s;
			}
		}
		return segments[segments.length - 1];
	};

	/** The point on the centre line at distance d, with the segment it lies on. */
	const centre = (d: number) => {
		const at = along(d);
		const segment = segmentAt(at);
		const t = (at - segment.start) / segment.length;
		const position: TVec2 = [
			segment.from[0] + (segment.to[0] - segment.from[0]) * t,
			segment.from[1] + (segment.to[1] - segment.from[1]) * t,
		];
		const height = segment.fromHeight + (segment.toHeight - segment.fromHeight) * t;
		return { position, height, segment };
	};

	/** Heading and pitch going forward along the path at distance d. */
	const direction = (d: number) => {
		if (smoothing > 0) {
			const behind = centre(d - smoothing);
			const ahead = centre(d + smoothing);
			const run = Math.hypot(
				ahead.position[0] - behind.position[0],
				ahead.position[1] - behind.position[1],
			);
			if (run > 1e-6) {
				return {
					heading: headingOf(behind.position, ahead.position),
					pitch: Math.atan2(ahead.height - behind.height, run),
				};
			}
		}
		const { segment } = centre(d);
		return {
			heading: headingOf(segment.from, segment.to),
			pitch: Math.atan2(segment.toHeight - segment.fromHeight, segment.length),
		};
	};

	/** A vehicle on the path at distance d, travelling forward or back, shifted into its lane. */
	const onPath = (d: number, reversed: boolean): IPathSample => {
		const { position, height } = centre(d);
		const forward = direction(d);
		const heading = forward.heading + (reversed ? Math.PI : 0);
		return {
			position: lane === 0 ? position : offset(position, rightOf(heading), lane),
			height,
			heading,
			pitch: reversed ? -forward.pitch : forward.pitch,
		};
	};

	if (looped) {
		return { length: total, period: total, turn: 0, at: (distance) => onPath(distance, false) };
	}

	// Open path: forward, U-turn at the end, back, U-turn at the start.
	const radius = Math.abs(lane);
	const turn = radius > 0 ? Math.PI * radius : smoothing > 0 ? PIVOT_DISTANCE : 0;
	const period = 2 * total + 2 * turn;

	/** Turning around at `d` (an end) after arriving with `arrival` heading; progress 0…1. */
	const uTurn = (d: number, arrival: number, progress: number): IPathSample => {
		const { position, height } = centre(d);
		const angle = progress * Math.PI;
		if (radius === 0) {
			return { position, height, heading: arrival + angle, pitch: 0 };
		}
		// A half circle from this lane, through the point beyond the end, into the opposite lane.
		const forward = forwardOf(arrival);
		const right = rightOf(arrival);
		const along = radius * Math.sin(angle);
		const across = lane * Math.cos(angle);
		const tangent: TVec2 = [
			forward[0] * radius * Math.cos(angle) - right[0] * lane * Math.sin(angle),
			forward[1] * radius * Math.cos(angle) - right[1] * lane * Math.sin(angle),
		];
		return {
			position: offset(offset(position, forward, along), right, across),
			height,
			heading: Math.atan2(-tangent[1], tangent[0]),
			pitch: 0,
		};
	};

	return {
		length: total,
		period,
		turn,
		at(distance) {
			const s = ((distance % period) + period) % period;
			if (s < total) {
				return onPath(s, false);
			}
			if (s < total + turn) {
				return uTurn(total, direction(total).heading, (s - total) / turn);
			}
			if (s < 2 * total + turn) {
				return onPath(total - (s - total - turn), true);
			}
			return uTurn(0, direction(0).heading + Math.PI, (s - 2 * total - turn) / turn);
		},
	};
};
