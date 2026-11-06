import { round } from "#/lib/math";
import type { TVec2 } from "#/scene/schema";

/**
 * Plain geometry for laying roads that sweep (the Interchange template's
 * ramps, loops and flyovers): lines and arcs as points every few units, an
 * altitude for each point eased along the way, and cutting a road where a slip
 * road leaves or joins it, so both ends meet at exactly the same point (a
 * junction's ends must, ADR-0136). No parts, no React: the template turns
 * paths into roads.
 */

/** A road point as the template writes it: [x, z, altitude]. */
export type TPathPoint = [number, number, number];

/** About how far apart the points of a curve are, in grid units. */
export const CURVE_STEP = 3;

const distance = (a: readonly number[], b: readonly number[]) =>
	Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Points from `a` to `b`, both in, about `step` apart. */
export const linePoints = (a: TVec2, b: TVec2, step = CURVE_STEP): TVec2[] => {
	const count = Math.max(1, Math.ceil(distance(a, b) / step));
	return Array.from(
		{ length: count + 1 },
		(_, i): TVec2 => [a[0] + ((b[0] - a[0]) * i) / count, a[1] + ((b[1] - a[1]) * i) / count],
	);
};

/**
 * Points along a circle's arc, both ends in, about `step` apart. Angles are in degrees measured
 * from +x towards +z (south, as the world's z runs), so 90 is the circle's southmost point.
 */
export const arcPoints = (
	centre: TVec2,
	radius: number,
	fromDegrees: number,
	toDegrees: number,
	step = CURVE_STEP,
): TVec2[] => {
	const sweep = ((toDegrees - fromDegrees) * Math.PI) / 180;
	const count = Math.max(2, Math.ceil(Math.abs(sweep * radius) / step));
	return Array.from({ length: count + 1 }, (_, i): TVec2 => {
		const angle = (fromDegrees * Math.PI) / 180 + (sweep * i) / count;
		return [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)];
	});
};

/** Pieces of a path joined into one, leaving out a point that repeats the one before it. */
export const joinPath = (...pieces: TVec2[][]): TVec2[] =>
	pieces.flat().filter((point, i, all) => i === 0 || distance(point, all[i - 1]) > 1e-6);

/** How far along a path each of its points is. */
export const stationsOf = (path: readonly (readonly number[])[]) => {
	const stations = [0];
	for (let i = 1; i < path.length; i++) {
		stations.push(stations[i - 1] + distance(path[i - 1], path[i]));
	}
	return stations;
};

/** A path's length on the ground. */
export const pathLength = (path: readonly (readonly number[])[]) => stationsOf(path).at(-1) ?? 0;

/** How far along a path the point nearest `point` is. */
export const distanceAlong = (path: readonly (readonly number[])[], point: TVec2) => {
	const stations = stationsOf(path);
	let best = { gap: Number.POSITIVE_INFINITY, along: 0 };
	for (let i = 0; i < path.length - 1; i++) {
		const [a, b] = [path[i], path[i + 1]];
		const length = distance(a, b);
		const t =
			length === 0
				? 0
				: Math.max(
						0,
						Math.min(
							1,
							((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) /
								(length * length),
						),
					);
		const gap = Math.hypot(
			a[0] + (b[0] - a[0]) * t - point[0],
			a[1] + (b[1] - a[1]) * t - point[1],
		);
		if (gap < best.gap) {
			best = { gap, along: stations[i] + length * t };
		}
	}
	return best.along;
};

/** As a key's distance in `withAltitudes`: the path's very end. */
export const AT_END = -Number.MIN_VALUE;

/** How long the vertical curve is where a road's grade changes, in grid units. */
const VERTICAL_CURVE = 10;

/**
 * An altitude for each point of a path, as a road's would be laid: straight grades between
 * keys given as [distance along the path, altitude] (before the first key and after the
 * last, theirs), each change of grade rounded over `VERTICAL_CURVE` (an average over that
 * length), so the steepest it gets is the steepest straight grade. A negative distance counts
 * back from the path's end. Its first and last points keep their keys' altitudes exactly.
 */
export const withAltitudes = (
	path: readonly TVec2[],
	keys: readonly (readonly [number, number])[],
): TPathPoint[] => {
	const stations = stationsOf(path);
	const total = stations.at(-1) ?? 0;
	const sorted = keys
		.map(([at, altitude]) => [at < 0 ? total + at : at, altitude] as const)
		.sort((a, b) => a[0] - b[0]);
	const straightAt = (along: number) => {
		if (along <= sorted[0][0]) {
			return sorted[0][1];
		}
		for (let k = 0; k < sorted.length - 1; k++) {
			const [[from, low], [to, high]] = [sorted[k], sorted[k + 1]];
			if (along <= to) {
				return low + ((high - low) * (along - from)) / Math.max(1e-9, to - from);
			}
		}
		return sorted.at(-1)?.[1] ?? 0;
	};
	const samples = 20;
	const roundedAt = (along: number) => {
		let sum = 0;
		for (let i = 0; i <= samples; i++) {
			sum += straightAt(along + VERTICAL_CURVE * (i / samples - 0.5));
		}
		return sum / (samples + 1);
	};
	// Rounding moves the ends a little where they slope: put them back, easing it in over a curve.
	const startFix = straightAt(0) - roundedAt(0);
	const endFix = straightAt(total) - roundedAt(total);
	const altitudeAt = (along: number) =>
		roundedAt(along) +
		startFix * Math.max(0, 1 - along / VERTICAL_CURVE) +
		endFix * Math.max(0, 1 - (total - along) / VERTICAL_CURVE);
	return path.map(([x, z], i) => [round(x, 2), round(z, 2), round(altitudeAt(stations[i]), 2)]);
};

/** How far a climb of `rise` takes at a grade (a share: 0.07 is 7%). */
export const climbLength = (rise: number, grade: number) => Math.abs(rise) / grade;

/** The point at a distance along a path, its altitude eased linearly between its points. */
export const pointAlong = (path: readonly TPathPoint[], along: number): TPathPoint => {
	const stations = stationsOf(path);
	for (let i = 0; i < path.length - 1; i++) {
		if (along <= stations[i + 1] || i === path.length - 2) {
			const span = stations[i + 1] - stations[i];
			const t = span === 0 ? 0 : Math.max(0, Math.min(1, (along - stations[i]) / span));
			const [a, b] = [path[i], path[i + 1]];
			return [
				round(a[0] + (b[0] - a[0]) * t, 2),
				round(a[1] + (b[1] - a[1]) * t, 2),
				round(a[2] + (b[2] - a[2]) * t, 2),
			];
		}
	}
	return path[0];
};

/**
 * A path cut into pieces at distances along it: each cut is a point of both the piece
 * before it and the piece after, exactly, so roads made of them meet end to end there.
 * Points closer than `gap` to a cut are left out, so no piece has a needlessly short stretch.
 */
export const cutPath = (
	path: readonly TPathPoint[],
	cuts: readonly number[],
	gap = 0.8,
): TPathPoint[][] => {
	const stations = stationsOf(path);
	const at = [...cuts].sort((a, b) => a - b);
	const bounds = [0, ...at, stations.at(-1) ?? 0];
	return bounds.slice(0, -1).map((from, k) => {
		const to = bounds[k + 1];
		const inside = path.filter(
			(_, i) =>
				stations[i] > from + (k === 0 ? -1 : gap) &&
				stations[i] < to - (k === at.length ? -1 : gap),
		);
		const start = k === 0 ? [] : [pointAlong(path, from)];
		const end = k === at.length ? [] : [pointAlong(path, to)];
		return [...start, ...inside, ...end];
	});
};

/**
 * A path cut at places on it (each the nearest point of the path), as `cutPath`, the cuts
 * at exactly those places on the ground, so slip roads laid to them meet the pieces' ends.
 */
export const cutPathAt = (path: readonly TPathPoint[], places: readonly TVec2[]) => {
	const pieces = cutPath(
		path,
		places.map((place) => distanceAlong(path, place)),
	);
	const sorted = [...places].sort((a, b) => distanceAlong(path, a) - distanceAlong(path, b));
	return pieces.map((piece, k) => {
		const out = piece.map((point): TPathPoint => [...point]);
		if (k > 0) {
			out[0] = [round(sorted[k - 1][0], 2), round(sorted[k - 1][1], 2), out[0][2]];
		}
		if (k < sorted.length) {
			const last = out.length - 1;
			out[last] = [round(sorted[k][0], 2), round(sorted[k][1], 2), out[last][2]];
		}
		return out;
	});
};

/** A point turned a quarter turn `quarters` times about the origin, as north turns to west: (u, v) → (v, −u). */
export const quarterTurned = ([u, v]: TVec2, quarters: number): TVec2 => {
	let point: TVec2 = [u, v];
	for (let i = 0; i < ((quarters % 4) + 4) % 4; i++) {
		point = [point[1], -point[0]];
	}
	return point;
};
