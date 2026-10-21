import type { TVec2 } from "./schema";

export interface IPathSample {
	position: TVec2;
	/** Rotation around Y (radians) that points a +X-forward model along the path. */
	heading: number;
}

export interface IPathSampler {
	length: number;
	at(distance: number): IPathSample;
}

interface ISegment {
	start: number;
	length: number;
	from: TVec2;
	to: TVec2;
}

const headingOf = (from: TVec2, to: TVec2) => Math.atan2(-(to[1] - from[1]), to[0] - from[0]);

/**
 * Sample positions along a polyline by distance. Closed paths loop; open
 * paths ping-pong so vehicles drive back and forth.
 */
export const createPathSampler = (points: TVec2[], closed: boolean): IPathSampler => {
	const pts = closed && points.length > 2 ? [...points, points[0]] : points;
	const segments: ISegment[] = [];
	let total = 0;
	for (let i = 0; i < pts.length - 1; i++) {
		const from = pts[i];
		const to = pts[i + 1];
		const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
		if (length === 0) {
			continue;
		}
		segments.push({ start: total, length, from, to });
		total += length;
	}

	const pingPong = !(closed && points.length > 2);

	return {
		length: total,
		at(distance) {
			if (segments.length === 0) {
				return { position: pts[0] ?? [0, 0], heading: 0 };
			}
			let d: number;
			let reversed = false;
			if (pingPong) {
				const period = total * 2;
				const m = ((distance % period) + period) % period;
				reversed = m > total;
				d = reversed ? period - m : m;
			} else {
				d = ((distance % total) + total) % total;
			}

			let segment = segments[segments.length - 1];
			for (const s of segments) {
				if (d <= s.start + s.length) {
					segment = s;
					break;
				}
			}
			const t = segment.length === 0 ? 0 : (d - segment.start) / segment.length;
			const position: TVec2 = [
				segment.from[0] + (segment.to[0] - segment.from[0]) * t,
				segment.from[1] + (segment.to[1] - segment.from[1]) * t,
			];
			const heading = headingOf(segment.from, segment.to) + (reversed ? Math.PI : 0);
			return { position, heading };
		},
	};
};
