import type { TDrivingSide, TRoad, TRoadStyle, TVec2 } from "./schema";

/**
 * Road geometry, framework-free so it can be unit-tested and reused.
 * A road is a polyline of control points whose corners are rounded with
 * `cornerRadius`; everything else (ribbon mesh, markings, vehicle routes)
 * derives from that rounded centre line. See docs/adr/0017-drawable-roads.md.
 */

export const ROAD_STYLE_LABELS: Record<TRoadStyle, string> = {
	asphalt: "Road",
	dirt: "Dirt path",
	hidden: "Hidden route",
};

/** Default width per style when drawing a new road. */
export const ROAD_STYLE_WIDTH: Record<TRoadStyle, number> = {
	asphalt: 2.4,
	dirt: 1.4,
	hidden: 1.6,
};

/** How far from the centre line vehicles drive, as a fraction of the road width. */
const LANE_FRACTION = 0.22;
/** Segments per unit of corner radius when sampling curves (minimum 4). */
const CURVE_SAMPLES_PER_UNIT = 3;

const sub = (a: TVec2, b: TVec2): TVec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: TVec2, b: TVec2): TVec2 => [a[0] + b[0], a[1] + b[1]];
const scale = (a: TVec2, s: number): TVec2 => [a[0] * s, a[1] * s];
const length = (a: TVec2) => Math.hypot(a[0], a[1]);
const normalize = (a: TVec2): TVec2 => {
	const len = length(a);
	return len === 0 ? [0, 0] : [a[0] / len, a[1] / len];
};
/** Right-hand side of travel direction `f` on the ground plane (Y up, viewed from above). */
const rightOf = (f: TVec2): TVec2 => [-f[1], f[0]];

/** Drop consecutive duplicate points (and a closing duplicate of the first point). */
const dedupe = (points: TVec2[], closed: boolean) => {
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

/**
 * The road's centre line as a dense polyline. Each corner is replaced by a
 * quadratic curve that starts and ends `r` before/after the corner, where `r`
 * is `cornerRadius` limited to half of each adjacent segment so curves never
 * overlap. Closed roads round every corner and don't repeat the first point.
 */
export const roadCenterline = (points: TVec2[], closed: boolean, cornerRadius: number): TVec2[] => {
	const pts = dedupe(points, closed);
	const isClosed = closed && pts.length > 2;
	if (pts.length < 3 || cornerRadius <= 0) {
		return pts;
	}

	const out: TVec2[] = [];
	const n = pts.length;
	for (let i = 0; i < n; i++) {
		const isEnd = !isClosed && (i === 0 || i === n - 1);
		if (isEnd) {
			out.push(pts[i]);
			continue;
		}
		const p = pts[i];
		const prev = pts[(i - 1 + n) % n];
		const next = pts[(i + 1) % n];
		const toPrev = sub(prev, p);
		const toNext = sub(next, p);
		const r = Math.min(cornerRadius, length(toPrev) / 2, length(toNext) / 2);
		const d1 = normalize(toPrev);
		const d2 = normalize(toNext);
		// Nearly straight: no visible corner to round.
		if (r < 1e-3 || d1[0] * d2[0] + d1[1] * d2[1] < -0.9999) {
			out.push(p);
			continue;
		}
		const a = add(p, scale(d1, r));
		const b = add(p, scale(d2, r));
		const steps = Math.max(4, Math.ceil(r * CURVE_SAMPLES_PER_UNIT));
		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const u = 1 - t;
			// Quadratic Bézier a → p → b.
			out.push([
				u * u * a[0] + 2 * u * t * p[0] + t * t * b[0],
				u * u * a[1] + 2 * u * t * p[1] + t * t * b[1],
			]);
		}
	}
	return out;
};

export const roadCenterlineOf = (road: Pick<TRoad, "points" | "closed" | "cornerRadius">) =>
	roadCenterline(road.points, road.closed, road.cornerRadius);

/** Total length of a polyline, including the closing segment for closed loops. */
export const polylineLength = (points: TVec2[], closed: boolean) => {
	let total = 0;
	const count = closed && points.length > 2 ? points.length : points.length - 1;
	for (let i = 0; i < count; i++) {
		total += length(sub(points[(i + 1) % points.length], points[i]));
	}
	return total;
};

export interface IRibbon {
	/** Flat [x, z] vertex positions. */
	vertices: TVec2[];
	/** Triangle indices into `vertices`, wound to face up (+Y). */
	indices: number[];
}

/** Segments in each round join; enough to look round at road scale. */
const JOIN_SEGMENTS = 16;
/** Skip joins where the line barely bends (dense curve samples). Cosine of ~0.6°. */
const STRAIGHT_COS = 0.99995;

/**
 * Triangulate a flat band of `halfWidth` around a polyline, like a pen stroke
 * with round joins: one quad per segment plus a disc at every bend. Nothing
 * can stick out further than `halfWidth` from the line, however tight the
 * corner. (Mitred offset edges fold over and spike on hairpins.) Quads and
 * discs overlap, which is invisible because they're coplanar and one colour.
 */
export const buildRibbon = (center: TVec2[], halfWidth: number, closed: boolean): IRibbon => {
	const n = center.length;
	const isClosed = closed && n > 2;
	const vertices: TVec2[] = [];
	const indices: number[] = [];

	const pushUp = (i0: number, i1: number, i2: number) => {
		const [a, b, c] = [vertices[i0], vertices[i1], vertices[i2]];
		const facesUp = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0;
		indices.push(...(facesUp ? [i0, i1, i2] : [i0, i2, i1]));
	};

	const segments = isClosed ? n : n - 1;
	for (let i = 0; i < segments; i++) {
		const a = center[i];
		const b = center[(i + 1) % n];
		const dir = normalize(sub(b, a));
		if (dir[0] === 0 && dir[1] === 0) {
			continue;
		}
		const side = scale(rightOf(dir), halfWidth);
		const base = vertices.length;
		vertices.push(sub(a, side), add(a, side), sub(b, side), add(b, side));
		pushUp(base, base + 2, base + 1);
		pushUp(base + 1, base + 2, base + 3);
	}

	for (let i = 0; i < n; i++) {
		if (!isClosed && (i === 0 || i === n - 1)) {
			continue; // open ends stay square
		}
		const inDir = normalize(sub(center[i], center[(i - 1 + n) % n]));
		const outDir = normalize(sub(center[(i + 1) % n], center[i]));
		if (inDir[0] * outDir[0] + inDir[1] * outDir[1] > STRAIGHT_COS) {
			continue;
		}
		const hub = vertices.length;
		vertices.push(center[i]);
		for (let k = 0; k < JOIN_SEGMENTS; k++) {
			const angle = (k / JOIN_SEGMENTS) * Math.PI * 2;
			vertices.push([
				center[i][0] + Math.cos(angle) * halfWidth,
				center[i][1] + Math.sin(angle) * halfWidth,
			]);
		}
		for (let k = 0; k < JOIN_SEGMENTS; k++) {
			pushUp(hub, hub + 1 + k, hub + 1 + ((k + 1) % JOIN_SEGMENTS));
		}
	}

	return { vertices, indices };
};

/** Split a polyline into dashes of `dash` length separated by `gap`, measured along its length. */
export const dashPolyline = (
	center: TVec2[],
	closed: boolean,
	dash: number,
	gap: number,
): TVec2[][] => {
	const pts = closed && center.length > 2 ? [...center, center[0]] : center;
	if (pts.length < 2 || dash <= 0) {
		return [];
	}
	// Distance along the line at each point.
	const along = [0];
	for (let i = 1; i < pts.length; i++) {
		along.push(along[i - 1] + length(sub(pts[i], pts[i - 1])));
	}
	const total = along[along.length - 1];

	const pointAt = (distance: number): TVec2 => {
		let i = 1;
		while (i < along.length - 1 && along[i] < distance) {
			i++;
		}
		const span = along[i] - along[i - 1];
		const t = span === 0 ? 0 : (distance - along[i - 1]) / span;
		return add(pts[i - 1], scale(sub(pts[i], pts[i - 1]), t));
	};

	const dashes: TVec2[][] = [];
	// Step by whole periods (never by accumulated float steps), so this always terminates.
	const period = dash + Math.max(gap, 0);
	const count = Math.ceil(total / period);
	for (let k = 0; k < count; k++) {
		const start = gap / 2 + k * period;
		const end = Math.min(start + dash, total);
		if (end - start < 1e-6) {
			continue;
		}
		const inner = pts.filter((_, i) => along[i] > start && along[i] < end);
		dashes.push([pointAt(start), ...inner, pointAt(end)]);
	}
	return dashes;
};

/**
 * Signed sideways offset for vehicles: positive = right of travel direction.
 * Hidden routes have no lanes, so vehicles drive on the line itself.
 */
export const laneOffset = (road: Pick<TRoad, "width" | "style">, driving: TDrivingSide) => {
	if (road.style === "hidden") {
		return 0;
	}
	return road.width * LANE_FRACTION * (driving === "right" ? 1 : -1);
};

/** Shift a sampled position sideways, given the heading from the path sampler. */
export const applyLane = (position: TVec2, heading: number, offset: number): TVec2 => {
	if (offset === 0) {
		return position;
	}
	// heading is the Y rotation that points +X along travel; forward = (cos, -sin).
	const forward: TVec2 = [Math.cos(heading), -Math.sin(heading)];
	return add(position, scale(rightOf(forward), offset));
};

/** Midpoint of segment i → i+1 (wrapping for closed roads), for "insert point" handles. */
export const segmentMidpoints = (points: TVec2[], closed: boolean) => {
	const count = closed && points.length > 2 ? points.length : points.length - 1;
	return Array.from({ length: count }, (_, i) => {
		const a = points[i];
		const b = points[(i + 1) % points.length];
		return { index: i, point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as TVec2 };
	});
};
