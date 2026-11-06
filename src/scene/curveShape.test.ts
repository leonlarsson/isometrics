import { describe, expect, it } from "vitest";

import { TEMPLATES } from "#/templates";

import { roadCenterline, roadCenterlineOf } from "./roads";
import { RoadSchema, type TRoadPoint, type TVec2 } from "./schema";

/**
 * A road's curve shape (ADR-0148): rounded corners exactly as before, and a smooth curve through
 * every point.
 */

// The rounded corners' centre line as it was before curve shapes, kept here to compare with.
type TPointInput = TVec2 | TRoadPoint;
const pointWidth = (p: readonly number[]): number | undefined => (p.length > 3 ? p[3] : undefined);
const withHeight = (p: TPointInput): TRoadPoint => {
	const width = pointWidth(p);
	return width === undefined ? [p[0], p[1], p[2] ?? 0] : [p[0], p[1], p[2] ?? 0, width];
};
const sub = (a: TVec2, b: TVec2): TVec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: TVec2, b: TVec2): TVec2 => [a[0] + b[0], a[1] + b[1]];
const scale = (a: TVec2, s: number): TVec2 => [a[0] * s, a[1] * s];
const length = (a: TVec2) => Math.hypot(a[0], a[1]);
const xz = (p: readonly number[]): TVec2 => [p[0], p[1]];
const normalize = (a: TVec2): TVec2 => {
	const len = length(a);
	return len === 0 ? [0, 0] : [a[0] / len, a[1] / len];
};
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const dedupe = (points: TRoadPoint[], closed: boolean) => {
	const out = points.filter(
		(p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1],
	);
	if (closed && out.length > 2) {
		const first = out[0];
		const last = out[out.length - 1];
		if (first[0] === last[0] && first[1] === last[1]) {
			out.pop();
		}
	}
	return out;
};
const CURVE_SAMPLES_PER_UNIT = 3;
const RAMP_STEP = 0.5;

const oldCenterline = (
	input: TPointInput[],
	closed: boolean,
	cornerRadius: number,
	width?: number,
): TRoadPoint[] => {
	const pts = dedupe(input.map(withHeight), closed);
	const n = pts.length;
	const isClosed = closed && n > 2;
	if (n < 2) {
		return pts;
	}
	const segCount = isClosed ? n : n - 1;
	const at = (i: number) => pts[((i % n) + n) % n];
	const fallbackWidth = width ?? pts.map(pointWidth).find((w) => w !== undefined);
	const widthOf = (p: TRoadPoint) => pointWidth(p) ?? fallbackWidth ?? 0;
	const segLength = (k: number) => length(sub(xz(at(k + 1)), xz(at(k))));
	const pointOn = (k: number, f: number): TVec2 =>
		add(xz(at(k)), scale(sub(xz(at(k + 1)), xz(at(k))), f));

	// Fillet radius at each vertex (0 = no curve: open ends, straight runs, or no rounding).
	const radius = pts.map((p, i) => {
		if (cornerRadius <= 0 || (!isClosed && (i === 0 || i === n - 1))) {
			return 0;
		}
		const d1 = normalize(sub(xz(at(i - 1)), xz(p)));
		const d2 = normalize(sub(xz(at(i + 1)), xz(p)));
		if (d1[0] * d2[0] + d1[1] * d2[1] < -0.9999) {
			return 0;
		}
		const r = Math.min(cornerRadius, segLength(i - 1) / 2, segLength(i) / 2);
		return r < 1e-3 ? 0 : r;
	});

	// 1. Shape: dense 2D positions, remembering where each control point lands.
	const positions: TVec2[] = [];
	const stationIndex: number[] = new Array(n).fill(-1);
	const emit = (p: TVec2) => {
		const last = positions[positions.length - 1];
		if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) {
			positions.push(p);
		}
		return positions.length - 1;
	};
	const emitFillet = (i: number) => {
		const r = radius[i];
		const p = xz(at(i));
		const a = pointOn(i - 1, 1 - r / segLength(i - 1));
		const b = pointOn(i, r / segLength(i));
		const steps = 2 * Math.max(2, Math.ceil((r * CURVE_SAMPLES_PER_UNIT) / 2)); // even: has a middle
		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const u = 1 - t;
			// Quadratic Bézier a → corner → b.
			const index = emit([
				u * u * a[0] + 2 * u * t * p[0] + t * t * b[0],
				u * u * a[1] + 2 * u * t * p[1] + t * t * b[1],
			]);
			if (s === steps / 2) {
				stationIndex[i] = index;
			}
		}
	};

	for (let k = 0; k < segCount; k++) {
		const len = segLength(k);
		const start = len === 0 ? 0 : radius[k] / len;
		const end = len === 0 ? 1 : 1 - radius[(k + 1) % n] / len;
		if (k === 0 && isClosed && radius[0] > 0) {
			emitFillet(0);
		}
		const ramps = Math.abs(at(k)[2] - at(k + 1)[2]) > 1e-9 || widthOf(at(k)) !== widthOf(at(k + 1));
		const steps = ramps ? Math.max(1, Math.ceil(((end - start) * len) / RAMP_STEP)) : 1;
		for (let s = 0; s <= steps; s++) {
			const index = emit(pointOn(k, start + ((end - start) * s) / steps));
			if (s === 0 && radius[k] === 0 && stationIndex[k] < 0) {
				stationIndex[k] = index;
			}
			if (s === steps && radius[(k + 1) % n] === 0 && stationIndex[(k + 1) % n] < 0) {
				stationIndex[(k + 1) % n] = index;
			}
		}
		const next = (k + 1) % n;
		if (radius[next] > 0 && !(isClosed && next === 0)) {
			emitFillet(next);
		}
	}
	if (isClosed && positions.length > 2) {
		const first = positions[0];
		const last = positions[positions.length - 1];
		if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) {
			positions.pop();
			// A control point recorded at the dropped duplicate lives at index 0.
			for (let i = 0; i < n; i++) {
				if (stationIndex[i] === positions.length) {
					stationIndex[i] = 0;
				}
			}
		}
	}

	// 2. Height: ease between control stations by distance along the line.
	const along = [0];
	for (let j = 1; j < positions.length; j++) {
		along.push(along[j - 1] + length(sub(positions[j], positions[j - 1])));
	}
	const total = isClosed
		? along[along.length - 1] + length(sub(positions[0], positions[positions.length - 1]))
		: along[along.length - 1];
	const station = stationIndex.map((index) => along[Math.max(0, index)]);

	/** A control-point value (height or width) eased between stations at `distance` along the line. */
	const easedAt = (distance: number, value: (p: TRoadPoint) => number) => {
		// Find the control span [k, k + 1] containing `distance`.
		for (let k = 0; k < segCount; k++) {
			const from = station[k];
			let to = station[(k + 1) % n];
			let d = distance;
			if (isClosed && to <= from) {
				to += total; // the span that wraps past the loop's start
				if (d < from) {
					d += total;
				}
			}
			if (d >= from - 1e-9 && d <= to + 1e-9) {
				const f = to - from < 1e-9 ? 0 : (d - from) / (to - from);
				const [startValue, endValue] = [value(at(k)), value(at(k + 1))];
				return startValue + (endValue - startValue) * smoothstep(Math.min(1, Math.max(0, f)));
			}
		}
		// Before the first station on a loop, which wrapped above; otherwise clamp to the ends.
		return distance <= station[0] ? value(pts[0]) : value(pts[n - 1]);
	};

	return positions.map((p, j): TRoadPoint => {
		const height = easedAt(along[j], (q) => q[2]);
		return fallbackWidth === undefined
			? [p[0], p[1], height]
			: [p[0], p[1], height, easedAt(along[j], widthOf)];
	});
};

const headingOf = (a: readonly number[], b: readonly number[]) =>
	Math.atan2(b[1] - a[1], b[0] - a[0]);
const turnBetween = (a: number, b: number) =>
	Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));

/** The largest change of heading from one stretch of a line to the next. */
const sharpestBend = (line: readonly TRoadPoint[], closed: boolean) => {
	const pts = closed ? [...line, line[0], line[1]] : line;
	let most = 0;
	for (let i = 2; i < pts.length; i++) {
		most = Math.max(
			most,
			turnBetween(headingOf(pts[i - 2], pts[i - 1]), headingOf(pts[i - 1], pts[i])),
		);
	}
	return most;
};

/** A spiral ramp: 4 points a turn, climbing 1 a point. */
const spiral: TRoadPoint[] = Array.from({ length: 13 }, (_, i) => {
	const angle = (i * Math.PI) / 2;
	return [Math.cos(angle) * 6, Math.sin(angle) * 6, i];
});

describe("rounded corners (ADR-0148)", () => {
	it("draw every template road with rounded corners exactly as before curve shapes", () => {
		let compared = 0;
		for (const template of TEMPLATES) {
			for (const road of template.create().roads) {
				// Only rounded corners promise the old line; a smooth road (a ramp in a new template) is new.
				if (road.curveShape !== "roundedCorners") {
					continue;
				}
				expect(roadCenterlineOf(road)).toEqual(
					oldCenterline(road.points, road.loops, road.cornerRadius, road.width),
				);
				compared += 1;
			}
		}
		expect(compared).toBeGreaterThan(20);
	});

	it("are what a road has when it doesn't say", () => {
		expect(
			RoadSchema.parse({
				id: "r",
				points: [
					[0, 0],
					[1, 0],
				],
			}).curveShape,
		).toBe("roundedCorners");
	});
});

describe("a smooth curve through the points (ADR-0148)", () => {
	const smooth = (points: TRoadPoint[], loops = false) =>
		roadCenterline(points, loops, 3, 2.4, "throughPoints");

	it("passes through every point, at its altitude", () => {
		const line = smooth(spiral);
		for (const point of spiral) {
			const nearest = line.reduce((best, p) =>
				Math.hypot(p[0] - point[0], p[1] - point[1]) <
				Math.hypot(best[0] - point[0], best[1] - point[1])
					? p
					: best,
			);
			expect(Math.hypot(nearest[0] - point[0], nearest[1] - point[1])).toBeLessThan(1e-9);
			expect(nearest[2]).toBeCloseTo(point[2], 9);
		}
		expect(line[0].slice(0, 3)).toEqual(spiral[0]);
		expect(line.at(-1)?.slice(0, 3)).toEqual(spiral.at(-1));
	});

	it("has no kinks: the heading turns a little from each sample to the next", () => {
		expect(sharpestBend(smooth(spiral), false)).toBeLessThan(0.07);
		// The same spiral with rounded corners elbows at every point.
		expect(sharpestBend(roadCenterline(spiral, false, 3, 2.4), false)).toBeGreaterThan(0.1);
	});

	it("climbs a spiral evenly, without levelling off at every point", () => {
		const line = smooth(spiral);
		let along = 0;
		const grades: number[] = [];
		for (let i = 1; i < line.length; i++) {
			const run = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
			along += run;
			// Away from the ends, which level off.
			if (along > 12 && along < 75 - 12 && run > 0) {
				grades.push((line[i][2] - line[i - 1][2]) / run);
			}
		}
		expect(Math.min(...grades)).toBeGreaterThan(0.1);
	});

	it("closes a loop smoothly, with no seam at its first point", () => {
		const square: TRoadPoint[] = [
			[0, 0, 0],
			[10, 0, 0],
			[10, 10, 0],
			[0, 10, 0],
		];
		const line = smooth(square, true);
		expect(sharpestBend(line, true)).toBeLessThan(0.07);
		expect(line[0].slice(0, 3)).toEqual(square[0]);
	});

	it("keeps a straight road straight, and widths eased through their points", () => {
		const line = smooth([
			[0, 0, 0],
			[10, 0, 0, 4],
			[20, 0, 0],
		]);
		expect(line.every((p) => Math.abs(p[1]) < 1e-9)).toBe(true);
		const widest = line.reduce((most, p) => Math.max(most, p[3] ?? 0), 0);
		expect(widest).toBeCloseTo(4, 6);
		expect(line.every((p) => (p[3] ?? 0) >= 2.4 - 1e-9 && (p[3] ?? 0) <= 4 + 1e-9)).toBe(true);
	});
});
