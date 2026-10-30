import { clamp, round } from "#/lib/math";

import type { IColorSpec } from "./colors";
import type { TArea, TAreaKind, TAreaPoint, TVec2 } from "./schema";
import type { IScenePalette } from "./theme";
import { variantName } from "./variants";

/** Free-form areas: water, lawns, beaches, squares and raised land. See docs/adr/0021. */

interface IAreaKind {
	/** Its colours (ADR-0060): what an area's `colors` keeps settings for, by id. */
	colors: readonly IColorSpec[];
	startHeight: number;
	roughness: number;
	staysLevel: boolean;
}

/** An area kind's one colour, its surface, as the theme has it. */
const surface = (of: keyof IScenePalette["areas"]): readonly IColorSpec[] => [
	{ id: "surface", name: "Surface", default: (palette) => palette.areas[of] },
];

/**
 * What each area kind looks like. Ids are numbered so a kind can get variants
 * (water_02…); code asks these, never the id. `startHeight`: raised land is for
 * rocks and plateaus. `staysLevel`: its corners can't have heights of their own
 * (ADR-0096), so water stays a level surface that can mirror the world.
 */
export const AREA_KINDS: Record<TAreaKind, IAreaKind> = {
	water_01: { colors: surface("water"), startHeight: 0, roughness: 0.4, staysLevel: true },
	grass_01: { colors: surface("grass"), startHeight: 0, roughness: 0.95, staysLevel: false },
	sand_01: { colors: surface("sand"), startHeight: 0, roughness: 0.95, staysLevel: false },
	plaza_01: { colors: surface("plaza"), startHeight: 0, roughness: 0.95, staysLevel: false },
	raised_land_01: { colors: surface("land"), startHeight: 1.5, roughness: 0.95, staysLevel: false },
};

/** Each type's family name; variants of a family are told apart by number (scene/variants). */
const AREA_KIND_NAMES: Record<TAreaKind, string> = {
	water_01: "Water",
	grass_01: "Grass",
	sand_01: "Sand",
	plaza_01: "Plaza",
	raised_land_01: "Raised land",
};

const AREA_KIND_IDS = Object.keys(AREA_KIND_NAMES) as TAreaKind[];

export const AREA_KIND_LABELS = Object.fromEntries(
	AREA_KIND_IDS.map((type) => [type, variantName(type, AREA_KIND_NAMES[type], AREA_KIND_IDS)]),
) as Record<TAreaKind, string>;

/** An outline's corners: [x, z], maybe followed by more (an area corner's lift). */
type TOutline = readonly (readonly number[])[];

/** Signed area of a polygon (shoelace); its absolute value is the area in square units. */
export const polygonArea = (points: TOutline) => {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, z1] = points[i];
		const [x2, z2] = points[(i + 1) % points.length];
		sum += x1 * z2 - x2 * z1;
	}
	return sum / 2;
};

/** Whether a point lies inside a closed outline (even-odd rule). */
export const isInsidePolygon = ([x, z]: readonly number[], points: TOutline) => {
	let inside = false;
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const [xi, zi] = points[i];
		const [xj, zj] = points[j];
		if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
			inside = !inside;
		}
	}
	return inside;
};

/**
 * Corners with their own heights (ADR-0096): a corner `[x, z, lift]` raises
 * (or lowers) the area's top there by `lift` above its height, never below the
 * ground; `[x, z]` has none.
 */
export const cornerLift = (point: readonly number[]) => point[2] ?? 0;

/** The most a corner may be lifted above its area's height. */
export const MAX_CORNER_LIFT = 30;

/** A corner at [x, z] with a lift, kept as [x, z] without one so flat corners stay as they were. */
export const cornerWithLift = (x: number, z: number, lift: number): TAreaPoint =>
	lift === 0 ? [round(x), round(z)] : [round(x), round(z), round(lift)];

/** An area's shape as far as its top goes: its outline, height, type, and peaks inside (ADR-0101). */
export type TAreaShape = Pick<TArea, "height" | "points" | "kind"> & { peaks?: TArea["peaks"] };

/**
 * How high the area's top stands at one of its corners: level at its height
 * for types that stay level (water), whatever lift a corner kept from before.
 */
export const cornerTop = (area: Pick<TArea, "height" | "kind">, point: readonly number[]) =>
	Math.max(0, area.height + (AREA_KINDS[area.kind].staysLevel ? 0 : cornerLift(point)));

/** Whether its corners can have heights of their own: not for types that stay level (water). */
export const takesCornerHeights = (area: Pick<TArea, "kind">) => !AREA_KINDS[area.kind].staysLevel;

/** The lift that puts a corner's top at `top` (the ground at least), for an area this high. */
export const liftForTop = (area: Pick<TArea, "height">, top: number) =>
	round(clamp(top, 0, area.height + MAX_CORNER_LIFT) - area.height);

/** Whether its top stands above the ground anywhere: drawn solid, with sides, rather than flat. */
export const isRaised = (area: TAreaShape) =>
	area.points.some((point) => cornerTop(area, point) > 0) ||
	(area.peaks ?? []).some((peak) => cornerTop(area, peak) > 0);

/** Twice the signed area of a triangle in [x, z]: above 0 when a, b, c turn counter-clockwise. */
const turn = (a: readonly number[], b: readonly number[], c: readonly number[]) =>
	(b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Where `p` is in the triangle a, b, c, as weights of its corners (all ≥ 0 inside), or null for a flat one. */
const weightsIn = (
	p: readonly number[],
	a: readonly number[],
	b: readonly number[],
	c: readonly number[],
) => {
	const whole = turn(a, b, c);
	if (Math.abs(whole) < 1e-12) {
		return null;
	}
	const wa = turn(p, b, c) / whole;
	const wb = turn(a, p, c) / whole;
	return [wa, wb, 1 - wa - wb] as const;
};

/**
 * An outline cut into triangles (ear clipping), as corner indices, each
 * turning the way the outline does. The top of an area with corner heights is
 * drawn from these, and its height inside worked out from the same ones, so
 * objects stand where the surface is. A tangled outline's rest is fanned.
 */
export const triangulateOutline = (points: TOutline): [number, number, number][] => {
	const left = points.map((_, i) => i);
	// Ears are found going counter-clockwise; the triangles are put back the outline's way.
	const clockwise = polygonArea(points) < 0;
	if (clockwise) {
		left.reverse();
	}
	const triangles: [number, number, number][] = [];
	while (left.length > 3) {
		const ear = left.findIndex((b, i) => {
			const a = left[(i + left.length - 1) % left.length];
			const c = left[(i + 1) % left.length];
			if (turn(points[a], points[b], points[c]) <= 1e-9) {
				return false;
			}
			// No other corner inside it (one on its edge doesn't count).
			return !left.some((j) => {
				if (j === a || j === b || j === c) {
					return false;
				}
				const weights = weightsIn(points[j], points[a], points[b], points[c]);
				return weights?.every((w) => w > 1e-9);
			});
		});
		if (ear < 0) {
			break;
		}
		triangles.push([
			left[(ear + left.length - 1) % left.length],
			left[ear],
			left[(ear + 1) % left.length],
		]);
		left.splice(ear, 1);
	}
	for (let i = 1; i < left.length - 1; i++) {
		triangles.push([left[0], left[i], left[i + 1]]);
	}
	return clockwise ? triangles.map(([a, b, c]) => [a, c, b]) : triangles;
};

/**
 * A point well inside an outline: its middle (the centroid) when that's inside
 * it, else the middle of its biggest triangle (an L or a C shape).
 */
export const middleOf = (outline: TOutline): TVec2 => {
	const size = polygonArea(outline);
	if (Math.abs(size) > 1e-9) {
		let [cx, cz] = [0, 0];
		for (let i = 0; i < outline.length; i++) {
			const [x1, z1] = outline[i];
			const [x2, z2] = outline[(i + 1) % outline.length];
			const cross = x1 * z2 - x2 * z1;
			cx += (x1 + x2) * cross;
			cz += (z1 + z2) * cross;
		}
		const centroid: TVec2 = [cx / (6 * size), cz / (6 * size)];
		if (isInsidePolygon(centroid, outline)) {
			return centroid;
		}
	}
	const biggest = triangulateOutline(outline)
		.map((triangle) => ({
			triangle,
			size: Math.abs(turn(outline[triangle[0]], outline[triangle[1]], outline[triangle[2]])),
		}))
		.sort((a, b) => b.size - a.size)[0]?.triangle;
	if (!biggest) {
		return [outline[0][0], outline[0][1]];
	}
	const [a, b, c] = biggest.map((i) => outline[i]);
	return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
};

/** Whether d lies inside the circle through a, b and c (counter-clockwise). */
const inCircle = (
	a: readonly number[],
	b: readonly number[],
	c: readonly number[],
	d: readonly number[],
) => {
	const [ax, az] = [a[0] - d[0], a[1] - d[1]];
	const [bx, bz] = [b[0] - d[0], b[1] - d[1]];
	const [cx, cz] = [c[0] - d[0], c[1] - d[1]];
	return (
		(ax * ax + az * az) * (bx * cz - cx * bz) -
			(bx * bx + bz * bz) * (ax * cz - cx * az) +
			(cx * cx + cz * cz) * (ax * bz - bx * az) >
		1e-9
	);
};

/**
 * An outline cut into triangles with points inside it as corners too (an
 * area's peaks, ADR-0101): the outline's ear clipping, then each point put
 * into the triangle it's in, which splits in three, and edges flipped where a
 * triangle would be thinner than the other way round (Lawson), never the
 * outline's own edges. So a peak joins up with the corners round it, and a
 * hill rises evenly to it. Indices run over the outline's corners, then the
 * points (those outside it are left out); triangles turn the outline's way.
 */
export const triangulateWithPoints = (
	outline: TOutline,
	inside: TOutline,
): [number, number, number][] => {
	const clockwise = polygonArea(outline) < 0;
	const all = [...outline, ...inside];
	// Counter-clockwise from here on, turned back at the end.
	const triangles = triangulateOutline(outline).map(([a, b, c]): [number, number, number] =>
		clockwise ? [a, c, b] : [a, b, c],
	);
	const n = outline.length;
	const onOutline = (a: number, b: number) =>
		a < n && b < n && (Math.abs(a - b) === 1 || Math.abs(a - b) === n - 1);
	/** The triangle on the other side of edge a→b, and its third corner. */
	const across = (a: number, b: number) => {
		const index = triangles.findIndex(([p, q, r]) =>
			[
				[p, q],
				[q, r],
				[r, p],
			].some(([u, v]) => u === b && v === a),
		);
		if (index < 0) {
			return null;
		}
		const third = triangles[index].find((corner) => corner !== a && corner !== b) ?? -1;
		return { index, third };
	};
	for (let i = 0; i < inside.length; i++) {
		const point = n + i;
		const into = triangles.findIndex(([a, b, c]) => {
			const weights = weightsIn(all[point], all[a], all[b], all[c]);
			return weights?.every((w) => w > -1e-9);
		});
		if (into < 0) {
			continue;
		}
		const [a, b, c] = triangles[into];
		triangles.splice(into, 1, [a, b, point], [b, c, point], [c, a, point]);
		// Flip the edges facing the new point while the triangle beyond would be better turned.
		const edges: [number, number][] = [
			[a, b],
			[b, c],
			[c, a],
		];
		let guard = 0;
		while (edges.length > 0 && guard++ < 200) {
			const [u, v] = edges.pop() as [number, number];
			if (onOutline(u, v)) {
				continue;
			}
			const other = across(u, v);
			const mine = triangles.findIndex((t) => t.includes(u) && t.includes(v) && t.includes(point));
			if (!other || mine < 0 || !inCircle(all[u], all[v], all[point], all[other.third])) {
				continue;
			}
			// Only where the four make a convex shape, so the new triangles turn the right way.
			if (
				turn(all[point], all[u], all[other.third]) <= 1e-9 ||
				turn(all[point], all[other.third], all[v]) <= 1e-9
			) {
				continue;
			}
			const [first, second] = [Math.max(mine, other.index), Math.min(mine, other.index)];
			triangles.splice(first, 1);
			triangles.splice(second, 1);
			triangles.push([u, other.third, point], [other.third, v, point]);
			edges.push([u, other.third], [other.third, v]);
		}
	}
	return clockwise ? triangles.map(([a, b, c]) => [a, c, b]) : triangles;
};

/**
 * An area's top as triangles (ADR-0096, ADR-0101): its corners, then its
 * peaks inside it, each at its height, and triangles over them. What it's
 * drawn with, and what objects stand on.
 */
export const topSurface = (area: TAreaShape) => {
	const peaks = takesCornerHeights(area) ? (area.peaks ?? []) : [];
	const points: readonly (readonly number[])[] = [...area.points, ...peaks];
	return {
		points,
		tops: points.map((point) => cornerTop(area, point)),
		triangles: triangulateWithPoints(area.points, peaks),
	};
};

/**
 * How high an area's top stands at a point inside it (ADR-0096): between its
 * corners' and peaks' heights, on the triangle the point is in; null outside it.
 */
export const areaTopAt = (area: TAreaShape, point: TVec2) => {
	if (!isInsidePolygon(point, area.points)) {
		return null;
	}
	const { points, tops, triangles } = topSurface(area);
	for (const [a, b, c] of triangles) {
		const weights = weightsIn(point, points[a], points[b], points[c]);
		if (weights?.every((w) => w > -1e-6)) {
			return round(weights[0] * tops[a] + weights[1] * tops[b] + weights[2] * tops[c]);
		}
	}
	return Math.max(0, area.height);
};

/** What the ground is made of: the areas, as far as their heights go. */
type TGround = TAreaShape & Pick<TArea, "isHidden">;

/**
 * How high the ground stands at a point: the highest top of the areas there
 * (raised land, slopes, ADR-0096), else 0. What objects stand on (ADR-0098).
 */
export const groundHeightAt = (areas: readonly TGround[], point: TVec2) =>
	Math.max(
		0,
		...areas
			.filter((area) => !area.isHidden && isRaised(area))
			.map((area) => areaTopAt(area, point) ?? 0),
	);

/**
 * An object's height once it moves from one spot to another: as high above the
 * ground there as it was here, so it climbs onto raised land and follows slopes,
 * and one lifted or sunk on purpose keeps that (ADR-0098).
 */
export const altitudeMovedTo = (
	areas: readonly TGround[],
	elevation: number,
	from: TVec2,
	to: TVec2,
	/** The ground where it goes, when it isn't the same (areas pasted with it). */
	areasThere: readonly TGround[] = areas,
) => round(elevation - groundHeightAt(areas, from) + groundHeightAt(areasThere, to));

/** The longest piece of an outline's edge looked at on its own when finding seams. */
const SEAM_STEP = 0.5;
/** How far beyond an edge another water area must reach for the edge to be a seam. */
const SEAM_PROBE = 0.3;
/** At most this many pieces per area (the shader loops over them). */
export const MAX_WATER_SEAMS = 64;

/**
 * Where a flat water area meets another flat water area (ADR-0075): the
 * pieces of its outline with other water just beyond them, as [x1, z1, x2,
 * z2], merged where they run on. Its own ripples and reflections fade into
 * the world's near these, so neighbouring water meets without a seam; edges
 * against land keep its own look.
 */
export const waterSeams = (area: TArea, areas: TArea[]) => {
	const others = areas.filter(
		(other) =>
			other.id !== area.id && other.kind === "water_01" && !isRaised(other) && !other.isHidden,
	);
	const seams: [number, number, number, number][] = [];
	if (area.kind !== "water_01" || isRaised(area) || others.length === 0) {
		return seams;
	}
	const { points } = area;
	for (let i = 0; i < points.length; i++) {
		const [x1, z1] = points[i];
		const [x2, z2] = points[(i + 1) % points.length];
		const length = Math.hypot(x2 - x1, z2 - z1);
		if (length === 0) {
			continue;
		}
		// Either side, so the outline's winding doesn't matter: the inside is this area anyway.
		const [nx, nz] = [(z1 - z2) / length, (x2 - x1) / length];
		const pieces = Math.max(1, Math.ceil(length / SEAM_STEP));
		let open: [number, number, number, number] | null = null;
		for (let k = 0; k < pieces; k++) {
			const [ax, az] = [x1 + ((x2 - x1) * k) / pieces, z1 + ((z2 - z1) * k) / pieces];
			const [bx, bz] = [x1 + ((x2 - x1) * (k + 1)) / pieces, z1 + ((z2 - z1) * (k + 1)) / pieces];
			const [mx, mz] = [(ax + bx) / 2, (az + bz) / 2];
			const beyond = [
				[mx + nx * SEAM_PROBE, mz + nz * SEAM_PROBE],
				[mx - nx * SEAM_PROBE, mz - nz * SEAM_PROBE],
			] as TVec2[];
			const shared = beyond.some(
				(point) =>
					!isInsidePolygon(point, points) &&
					others.some((other) => isInsidePolygon(point, other.points)),
			);
			if (shared && open) {
				open[2] = bx;
				open[3] = bz;
			} else if (shared) {
				open = [ax, az, bx, bz];
				seams.push(open);
			} else {
				open = null;
			}
		}
	}
	return seams.slice(0, MAX_WATER_SEAMS);
};
