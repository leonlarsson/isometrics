import type { TDrivingSide, TRoad, TRoadPoint, TRoadStyle, TTurnStyle, TVec2 } from "./schema";
import { variantName } from "./variants";

/**
 * Road geometry, framework-free so it can be unit-tested and reused.
 * A road is a polyline of control points [x, z, height] whose corners are
 * rounded with `cornerRadius` and whose height eases smoothly from point to
 * point. Everything else (surface, deck, supports, markings, vehicle routes)
 * derives from that centre line. See docs/adr/0017 and 0018.
 */

/**
 * What each road style looks like. Ids are numbered so a style can get
 * variants (road_02…); code asks these, never the id.
 */
export const ROAD_STYLES: Record<
	TRoadStyle,
	{ surface: "road" | "dirt" | null; centreLine: boolean }
> = {
	road_01: { surface: "road", centreLine: true },
	dirt_path_01: { surface: "dirt", centreLine: false },
	hidden_route_01: { surface: null, centreLine: false },
};

/** An invisible route: vehicles follow it, but nothing is drawn outside the editor. */
export const isHiddenRoute = (style: TRoadStyle) => ROAD_STYLES[style].surface === null;

/** Each style's family name; variants of a family are told apart by number (scene/variants). */
const ROAD_STYLE_NAMES: Record<TRoadStyle, string> = {
	road_01: "Road",
	dirt_path_01: "Dirt path",
	hidden_route_01: "Hidden route",
};

const ROAD_STYLE_IDS = Object.keys(ROAD_STYLE_NAMES) as TRoadStyle[];

export const ROAD_STYLE_LABELS = Object.fromEntries(
	ROAD_STYLE_IDS.map((style) => [
		style,
		variantName(style, ROAD_STYLE_NAMES[style], ROAD_STYLE_IDS),
	]),
) as Record<TRoadStyle, string>;

export const TURN_STYLE_LABELS: Record<TTurnStyle, string> = {
	smooth: "Smoothly",
	sharp: "Sharply",
};

/** The same two choices everywhere turns can be set (scene, road, vehicle). */
export const TURN_STYLE_OPTIONS = (Object.keys(TURN_STYLE_LABELS) as TTurnStyle[]).map((value) => ({
	value,
	label: TURN_STYLE_LABELS[value],
}));

/**
 * How a vehicle takes corners: its own setting, else its road's, else the
 * scene's (see TurnStyleSchema).
 */
export const resolveTurnStyle = (
	scene: TTurnStyle,
	road: TTurnStyle | null | undefined,
	vehicle: TTurnStyle | null | undefined,
): TTurnStyle => vehicle ?? road ?? scene;

/**
 * How far behind and ahead a vehicle looks to smooth its heading (the path
 * sampler's `smoothing`): half its length for smooth turns, 0 for sharp ones.
 */
export const turnSmoothing = (turns: TTurnStyle, vehicleLength: number) =>
	turns === "sharp" ? 0 : Math.min(Math.max(vehicleLength / 2, 0.3), 3);

/** Default width per style when drawing a new road. */
export const ROAD_STYLE_WIDTH: Record<TRoadStyle, number> = {
	road_01: 2.4,
	dirt_path_01: 1.4,
	hidden_route_01: 1.6,
};

/**
 * The road width after switching from one style to another: a width still at
 * the old style's default adopts the new style's default; a custom width stays.
 */
export const widthForStyle = (width: number, from: TRoadStyle, to: TRoadStyle) =>
	Math.abs(width - ROAD_STYLE_WIDTH[from]) < 1e-6 ? ROAD_STYLE_WIDTH[to] : width;

/** Above this height a road counts as elevated: deck, supports and railings appear. */
export const ELEVATED_MIN = 0.05;
/** Thickness of an elevated road deck. */
export const DECK_THICKNESS = 0.3;
/** Railings appear where the road is at least this high. */
export const RAILING_MIN = 0.5;
export const RAILING_HEIGHT = 0.3;
/** Default distance between pillars along the road, and the minimum height that gets one. */
export const PILLAR_SPACING = 4;
export const PILLAR_MIN = 0.8;
/** Horizontal run per unit of height for an embankment side this steep (degrees; 90 = a wall). */
export const embankmentRun = (angle: number) =>
	angle >= 90 ? 0 : 1 / Math.tan((Math.max(1, angle) * Math.PI) / 180);

/** How far from the centre line vehicles drive, as a fraction of the road width. */
const LANE_FRACTION = 0.22;
/** Segments per unit of corner radius when sampling curves (minimum 4). */
const CURVE_SAMPLES_PER_UNIT = 3;
/** Sample spacing along straight parts whose height changes, so ramps look smooth. */
const RAMP_STEP = 0.5;

const sub = (a: TVec2, b: TVec2): TVec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: TVec2, b: TVec2): TVec2 => [a[0] + b[0], a[1] + b[1]];
const scale = (a: TVec2, s: number): TVec2 => [a[0] * s, a[1] * s];
const length = (a: TVec2) => Math.hypot(a[0], a[1]);
const xz = (p: readonly number[]): TVec2 => [p[0], p[1]];
const normalize = (a: TVec2): TVec2 => {
	const len = length(a);
	return len === 0 ? [0, 0] : [a[0] / len, a[1] / len];
};
/** Right-hand side of travel direction `f` on the ground plane (Y up, viewed from above). */
const rightOf = (f: TVec2): TVec2 => [-f[1], f[0]];
/** Ease in and out, so ramps start and end level. */
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Points with height; [x, z] input counts as height 0. A point's own width is kept. */
type TPointInput = TVec2 | TRoadPoint;
const withHeight = (p: TPointInput): TRoadPoint => {
	const width = pointWidth(p);
	return width === undefined ? [p[0], p[1], p[2] ?? 0] : [p[0], p[1], p[2] ?? 0, width];
};

/** A road point's own width (its fourth value), or undefined when it uses the road's. */
export const pointWidth = (p: readonly number[]): number | undefined =>
	p.length > 3 ? p[3] : undefined;

/** Half the road's width at a point: its own width if it has one, otherwise `fallback`. */
const halfWidthAt = (p: TRoadPoint, fallback: number) => {
	const width = pointWidth(p);
	return width === undefined ? fallback : width / 2;
};

/** Drop consecutive duplicate positions (and a closing duplicate of the first point). */
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

/**
 * The road's centre line as a dense polyline of [x, z, height].
 *
 * Shape: each corner is replaced by a quadratic curve that starts and ends `r`
 * before/after it, with `r` = `cornerRadius` limited to half of each adjacent
 * segment so curves never overlap. Closed roads round every corner and don't
 * repeat the first point.
 *
 * Height: computed after the shape. Each control point's height is pinned at
 * its "station" on the rounded line (a corner's station is the middle of its
 * curve), and heights ease (smoothstep) between stations by distance along the
 * line. That keeps slopes continuous through bends; easing per straight
 * segment and blending linearly across curves made a visible kink where a
 * ramp met a bend. Straight parts whose height changes are subdivided so ramps
 * are smooth.
 *
 * Width: when any point has its own width, or `width` (the road's) is given,
 * every output point gets a fourth value, the width there, eased between
 * stations the same way. Points without a width use `width`.
 */
export const roadCenterline = (
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

export const roadCenterlineOf = (
	road: Pick<TRoad, "points" | "loops" | "cornerRadius" | "width">,
) => roadCenterline(road.points, road.loops, road.cornerRadius, road.width);

/** Total ground length of a polyline (heights ignored), including the closing segment for loops. */
export const polylineLength = (points: readonly (readonly number[])[], closed: boolean) => {
	let total = 0;
	const count = closed && points.length > 2 ? points.length : points.length - 1;
	for (let i = 0; i < count; i++) {
		total += length(sub(xz(points[(i + 1) % points.length]), xz(points[i])));
	}
	return total;
};

export interface IRibbon {
	/** Vertex positions as [x, z, height]. */
	vertices: TRoadPoint[];
	/** Per-vertex world normals [x, y, z], following the road's slope. */
	normals: [number, number, number][];
	/** Triangle indices into `vertices`, wound to face up (+Y). */
	indices: number[];
}

/** Arc resolution of the wedge that fills the outside of a bend. */
const JOIN_STEP = Math.PI / 16;

/**
 * Triangulate a band of `halfWidth` around a polyline: one quad per segment,
 * plus a round wedge filling the gap on the outside of each bend. Points with
 * their own width (a fourth value) use half of it instead, so segments taper.
 *
 * - Watertight: every bend gets its wedge, however slight, and the wedge
 *   reuses the quads' exact corner coordinates. Quads are split at the centre
 *   line so the wedge's hub is a shared vertex, not a point in the middle of
 *   a quad's edge. (Skipped slivers and T-junctions showed as hairline cracks.)
 * - Nothing sticks out further than `halfWidth` from the line, however tight
 *   the corner. (Mitred offset edges fold over and spike on hairpins.)
 * - Wedges sit exactly at the bend's height and only cover the gap between
 *   two quads, so nothing pokes through a sloped surface. (Full flat discs
 *   did, hiding markings and shading differently on ramps and bends.)
 * - Normals follow the road's slope per centre-line vertex and are shared by
 *   everything at that vertex, so shading is continuous.
 */
export const buildRibbon = (center: TPointInput[], halfWidth: number, closed: boolean): IRibbon => {
	const pts = center.map(withHeight);
	const n = pts.length;
	const isClosed = closed && n > 2;
	const vertices: TRoadPoint[] = [];
	const normals: [number, number, number][] = [];
	const indices: number[] = [];

	const pushUp = (i0: number, i1: number, i2: number) => {
		const [a, b, c] = [vertices[i0], vertices[i1], vertices[i2]];
		const facesUp = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0;
		indices.push(...(facesUp ? [i0, i1, i2] : [i0, i2, i1]));
	};

	// Per-segment direction and slope, then per-vertex normals from the average of both sides.
	const segments = isClosed ? n : n - 1;
	const segDir: TVec2[] = [];
	const segSlope: number[] = [];
	for (let k = 0; k < segments; k++) {
		const a = pts[k];
		const b = pts[(k + 1) % n];
		const len = length(sub(xz(b), xz(a)));
		segDir.push(normalize(sub(xz(b), xz(a))));
		segSlope.push(len === 0 ? 0 : (b[2] - a[2]) / len);
	}
	const segmentsAt = (i: number) => {
		const before = isClosed || i > 0 ? (i - 1 + segments) % segments : null;
		const after = isClosed || i < n - 1 ? i % segments : null;
		return { before, after };
	};
	const vertexNormal = pts.map((_, i) => {
		const { before, after } = segmentsAt(i);
		const ids = [before, after].filter((k): k is number => k !== null);
		const dir = normalize(ids.reduce<TVec2>((acc, k) => add(acc, segDir[k]), [0, 0]));
		const slope = ids.reduce((acc, k) => acc + segSlope[k], 0) / Math.max(1, ids.length);
		// Surface y = h(s): normal ∝ (-slope · forward, 1).
		const nx = -slope * dir[0];
		const nz = -slope * dir[1];
		const len = Math.hypot(nx, 1, nz);
		return [nx / len, 1 / len, nz / len] as [number, number, number];
	});

	for (let k = 0; k < segments; k++) {
		const ia = k;
		const ib = (k + 1) % n;
		const [a, b] = [pts[ia], pts[ib]];
		const dir = segDir[k];
		if (dir[0] === 0 && dir[1] === 0) {
			continue;
		}
		const sideA = scale(rightOf(dir), halfWidthAt(a, halfWidth));
		const sideB = scale(rightOf(dir), halfWidthAt(b, halfWidth));
		const base = vertices.length;
		// Left, centre and right at each end: two quads, split along the centre line.
		vertices.push(
			[...sub(xz(a), sideA), a[2]],
			[a[0], a[1], a[2]],
			[...add(xz(a), sideA), a[2]],
			[...sub(xz(b), sideB), b[2]],
			[b[0], b[1], b[2]],
			[...add(xz(b), sideB), b[2]],
		);
		normals.push(...[ia, ia, ia, ib, ib, ib].map((i) => vertexNormal[i]));
		pushUp(base, base + 3, base + 1);
		pushUp(base + 1, base + 3, base + 4);
		pushUp(base + 1, base + 4, base + 2);
		pushUp(base + 2, base + 4, base + 5);
	}

	for (let i = 0; i < n; i++) {
		const { before, after } = segmentsAt(i);
		if (before === null || after === null) {
			continue; // open ends stay square
		}
		const inDir = segDir[before];
		const outDir = segDir[after];
		if (inDir[0] === outDir[0] && inDir[1] === outDir[1]) {
			continue; // dead straight: the quads already meet edge to edge
		}
		// The outside of the bend is the side the road turns away from.
		const sIn = rightOf(inDir);
		const sOut = rightOf(outDir);
		const turnsRight = outDir[0] * sIn[0] + outDir[1] * sIn[1] > 0;
		const sign = turnsRight ? -1 : 1;
		const from = Math.atan2(sign * sIn[1], sign * sIn[0]);
		let to = Math.atan2(sign * sOut[1], sign * sOut[0]);
		// Sweep the short way round, from the incoming quad's corner to the outgoing one's.
		while (to - from > Math.PI) {
			to -= Math.PI * 2;
		}
		while (to - from < -Math.PI) {
			to += Math.PI * 2;
		}
		const steps = Math.max(1, Math.ceil(Math.abs(to - from) / JOIN_STEP));
		const [cx, cz, h] = pts[i];
		const radius = halfWidthAt(pts[i], halfWidth);
		// The arc's ends are the quads' outer corners, computed exactly as the quads compute them.
		const corner = (dir: TVec2): TVec2 => {
			const side = scale(rightOf(dir), radius);
			return turnsRight ? sub(xz(pts[i]), side) : add(xz(pts[i]), side);
		};
		const hub = vertices.length;
		vertices.push([cx, cz, h]);
		normals.push(vertexNormal[i]);
		for (let s = 0; s <= steps; s++) {
			const angle = from + ((to - from) * s) / steps;
			const [x, z] =
				s === 0
					? corner(inDir)
					: s === steps
						? corner(outDir)
						: [cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius];
			vertices.push([x, z, h]);
			normals.push(vertexNormal[i]);
		}
		for (let s = 0; s < steps; s++) {
			pushUp(hub, hub + 1 + s, hub + 2 + s);
		}
	}

	return { vertices, normals, indices };
};

/** A vertical or sloped quad strip: one quad per segment between `top` and `bottom` edges. */
export interface IWall {
	/** [x, y, z] corner positions, four per quad: top-a, top-b, bottom-a, bottom-b. */
	quads: [number, number, number][][];
}

/**
 * Left and right edge points for every centre-line vertex, offset along one
 * shared sideways direction per vertex (the average of its two segments), by
 * `offset` or the vertex's own half width, times `widthScale`.
 * Strips built from these are continuous: neighbouring quads share edges, so
 * there are no gaps on the outside of curves. (Per-segment offsets fan apart.)
 */
const vertexEdges = (center: TRoadPoint[], closed: boolean, offset: number, widthScale = 1) => {
	const n = center.length;
	const isClosed = closed && n > 2;
	return center.map((p, i) => {
		const hasPrev = isClosed || i > 0;
		const hasNext = isClosed || i < n - 1;
		const inDir = hasPrev ? normalize(sub(xz(p), xz(center[(i - 1 + n) % n]))) : null;
		const outDir = hasNext ? normalize(sub(xz(center[(i + 1) % n]), xz(p))) : null;
		let side = rightOf(normalize(add(inDir ?? outDir ?? [1, 0], outDir ?? inDir ?? [1, 0])));
		if (side[0] === 0 && side[1] === 0) {
			side = rightOf(outDir ?? inDir ?? [1, 0]); // a full reversal: use the outgoing direction
		}
		const off = scale(side, halfWidthAt(p, offset) * widthScale);
		return { point: p, side, left: sub(xz(p), off), right: add(xz(p), off) };
	});
};

/**
 * Side faces for the elevated parts of a road: the deck's edges and underside
 * (thickness below the surface; closed, so a bridge looks solid and casts a
 * shadow), railings above it, and embankment slopes below when
 * `embankment` is on (a full-width bank replaces the deck's edge, which it
 * would cover or z-fight with). Only segments above `ELEVATED_MIN`. Each is a continuous
 * strip along the road (see `vertexEdges`).
 */
export const buildElevatedSides = (
	center: TRoadPoint[],
	closed: boolean,
	halfWidth: number,
	options: {
		railings: boolean;
		embankment: boolean;
		/** Steepness of the embankment's sides in degrees (default 45; 90 = straight walls). */
		embankmentAngle?: number;
		/** Width of the embankment's top as a share of the road's width (default 1). */
		embankmentWidth?: number;
		/** Keep embankment feet on the ground slab: half its width (x) and depth (z). */
		bounds?: TVec2;
	},
) => {
	const keepOnGround = (p: TVec2): TVec2 =>
		options.bounds
			? [
					Math.max(-options.bounds[0], Math.min(options.bounds[0], p[0])),
					Math.max(-options.bounds[1], Math.min(options.bounds[1], p[1])),
				]
			: p;
	const deck: IWall = { quads: [] };
	const underside: IWall = { quads: [] };
	const railings: IWall = { quads: [] };
	const embankment: IWall = { quads: [] };
	const run = embankmentRun(options.embankmentAngle ?? 45);
	const bankScale = Math.min(1, Math.max(0, options.embankmentWidth ?? 1));
	// A full-width bank covers the deck's edge; a narrower one leaves it showing.
	const fullBank = options.embankment && bankScale >= 1;

	const edges = vertexEdges(center, closed, halfWidth);
	const bankEdges = bankScale < 1 ? vertexEdges(center, closed, halfWidth, bankScale) : edges;
	const n = edges.length;
	const segments = closed && n > 2 ? n : n - 1;
	for (let i = 0; i < segments; i++) {
		const a = edges[i];
		const b = edges[(i + 1) % n];
		const [ha, hb] = [a.point[2], b.point[2]];
		if (ha <= ELEVATED_MIN && hb <= ELEVATED_MIN) {
			continue;
		}
		// The deck's underside, closing it: without it a bridge looks hollow from the side, and the
		// one-sided road surface casts no shadow. Not where an embankment fills the space below, nor
		// where both ends are too low for an underside above the ground.
		const [ua, ub] = [ha - DECK_THICKNESS, hb - DECK_THICKNESS];
		if (!options.embankment && (ua > 0 || ub > 0)) {
			underside.quads.push([
				[a.left[0], Math.max(0, ua), a.left[1]],
				[b.left[0], Math.max(0, ub), b.left[1]],
				[a.right[0], Math.max(0, ua), a.right[1]],
				[b.right[0], Math.max(0, ub), b.right[1]],
			]);
		}
		for (const sign of [-1, 1] as const) {
			const pa = sign < 0 ? a.left : a.right;
			const pb = sign < 0 ? b.left : b.right;
			if (!fullBank) {
				deck.quads.push([
					[pa[0], ha, pa[1]],
					[pb[0], hb, pb[1]],
					[pa[0], Math.max(0, ha - DECK_THICKNESS), pa[1]],
					[pb[0], Math.max(0, hb - DECK_THICKNESS), pb[1]],
				]);
			}
			if (options.railings && ha >= RAILING_MIN && hb >= RAILING_MIN) {
				railings.quads.push([
					[pa[0], ha + RAILING_HEIGHT, pa[1]],
					[pb[0], hb + RAILING_HEIGHT, pb[1]],
					[pa[0], ha, pa[1]],
					[pb[0], hb, pb[1]],
				]);
			}
			if (options.embankment) {
				// Slope outward and down to the ground, from the bank's top edge.
				const ta = sign < 0 ? bankEdges[i].left : bankEdges[i].right;
				const tb = sign < 0 ? bankEdges[(i + 1) % n].left : bankEdges[(i + 1) % n].right;
				const footA = keepOnGround(add(ta, scale(a.side, sign * ha * run)));
				const footB = keepOnGround(add(tb, scale(b.side, sign * hb * run)));
				embankment.quads.push([
					[ta[0], ha, ta[1]],
					[tb[0], hb, tb[1]],
					[footA[0], 0, footA[1]],
					[footB[0], 0, footB[1]],
				]);
			}
		}
	}
	return { deck, underside, railings, embankment };
};

/** Pillar positions [x, z, height] every `spacing` along the road where it's high enough. */
export const pillarPositions = (
	center: TRoadPoint[],
	closed: boolean,
	spacing = PILLAR_SPACING,
): TRoadPoint[] => {
	const pts = closed && center.length > 2 ? [...center, center[0]] : center;
	const pillars: TRoadPoint[] = [];
	const step = Math.max(0.5, spacing);
	let nextAt = step / 2;
	let travelled = 0;
	for (let i = 0; i < pts.length - 1; i++) {
		const a = pts[i];
		const b = pts[i + 1];
		const len = length(sub(xz(b), xz(a)));
		while (len > 0 && nextAt <= travelled + len) {
			const t = (nextAt - travelled) / len;
			const h = a[2] + (b[2] - a[2]) * t;
			if (h >= PILLAR_MIN) {
				pillars.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, h]);
			}
			nextAt += step;
		}
		travelled += len;
	}
	return pillars;
};

/** Split a polyline into dashes of `dash` length separated by `gap`, measured along the ground. */
export const dashPolyline = (
	center: TPointInput[],
	closed: boolean,
	dash: number,
	gap: number,
): TRoadPoint[][] => {
	const base = center.map(withHeight);
	const pts = closed && base.length > 2 ? [...base, base[0]] : base;
	if (pts.length < 2 || dash <= 0) {
		return [];
	}
	// Distance along the line at each point.
	const along = [0];
	for (let i = 1; i < pts.length; i++) {
		along.push(along[i - 1] + length(sub(xz(pts[i]), xz(pts[i - 1]))));
	}
	const total = along[along.length - 1];

	const pointAt = (distance: number): TRoadPoint => {
		let i = 1;
		while (i < along.length - 1 && along[i] < distance) {
			i++;
		}
		const span = along[i] - along[i - 1];
		const t = span === 0 ? 0 : (distance - along[i - 1]) / span;
		const [a, b] = [pts[i - 1], pts[i]];
		return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
	};

	const dashes: TRoadPoint[][] = [];
	// Step by whole periods (never by accumulated float steps), so this always terminates.
	const period = dash + Math.max(gap, 0);
	const count = Math.ceil(total / period);
	for (let k = 0; k < count; k++) {
		const start = gap / 2 + k * period;
		const end = Math.min(start + dash, total);
		if (end - start < 1e-6) {
			continue;
		}
		// Plain [x, z, height]: dashes are drawn at their own width, not the road's.
		const inner = pts
			.filter((_, i) => along[i] > start && along[i] < end)
			.map((p): TRoadPoint => [p[0], p[1], p[2]]);
		dashes.push([pointAt(start), ...inner, pointAt(end)]);
	}
	return dashes;
};

/**
 * Signed sideways offset for vehicles: positive = right of travel direction.
 * Hidden routes have no lanes, so vehicles drive on the line itself.
 */
export const laneOffset = (
	road: Pick<TRoad, "width" | "style" | "drivingLane">,
	driving: TDrivingSide,
) => {
	if (isHiddenRoute(road.style) || road.drivingLane === "centre") {
		return 0;
	}
	return road.width * LANE_FRACTION * (driving === "right" ? 1 : -1);
};

/** Midpoint of segment i → i+1 (wrapping for closed roads), for "insert point" handles. */
export const segmentMidpoints = (points: TPointInput[], closed: boolean) => {
	const pts = points.map(withHeight);
	const count = closed && pts.length > 2 ? pts.length : pts.length - 1;
	return Array.from({ length: count }, (_, i) => {
		const a = pts[i];
		const b = pts[(i + 1) % pts.length];
		return {
			index: i,
			point: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] as TRoadPoint,
		};
	});
};

/** End points of open roads, for joining. Closed roads have no ends. */
export type TRoadEnd = "start" | "end";

export const roadEnds = (road: Pick<TRoad, "points" | "loops">) =>
	road.loops
		? []
		: ([
				{ end: "start" as TRoadEnd, index: 0, point: road.points[0] },
				{
					end: "end" as TRoadEnd,
					index: road.points.length - 1,
					point: road.points.at(-1) as TRoadPoint,
				},
			] as const);

/**
 * Points of two roads joined end to end: `a` is oriented so its joined end
 * comes last, `b` so its joined end comes first. If the two ends touch, the
 * shared point appears once.
 */
export const joinedPoints = (
	a: TRoadPoint[],
	aEnd: TRoadEnd,
	b: TRoadPoint[],
	bEnd: TRoadEnd,
): TRoadPoint[] => {
	const first = aEnd === "end" ? a : [...a].reverse();
	const second = bEnd === "start" ? b : [...b].reverse();
	const last = first[first.length - 1];
	const next = second[0];
	const touching = Math.hypot(last[0] - next[0], last[1] - next[1]) < 1e-6;
	return [...first, ...(touching ? second.slice(1) : second)];
};
