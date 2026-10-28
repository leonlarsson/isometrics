import { clamp, round } from "#/lib/math";

import type { TArea, TAreaPoint, TAreaType, TVec2 } from "./schema";
import type { IScenePalette } from "./theme";
import { variantName } from "./variants";

/** Free-form areas: water, lawns, beaches, squares and raised land. See docs/adr/0021. */

/**
 * What each area type looks like. Ids are numbered so a type can get variants
 * (water_02…); code asks these, never the id. `startHeight`: raised land is for
 * rocks and plateaus. `staysLevel`: its corners can't have heights of their own
 * (ADR-0096), so water stays a level surface that can mirror the world.
 */
export const AREA_TYPES: Record<
	TAreaType,
	{
		surface: keyof IScenePalette["areas"];
		startHeight: number;
		roughness: number;
		staysLevel: boolean;
	}
> = {
	water_01: { surface: "water", startHeight: 0, roughness: 0.4, staysLevel: true },
	grass_01: { surface: "grass", startHeight: 0, roughness: 0.95, staysLevel: false },
	sand_01: { surface: "sand", startHeight: 0, roughness: 0.95, staysLevel: false },
	plaza_01: { surface: "plaza", startHeight: 0, roughness: 0.95, staysLevel: false },
	raised_land_01: { surface: "land", startHeight: 1.5, roughness: 0.95, staysLevel: false },
};

/** Each type's family name; variants of a family are told apart by number (scene/variants). */
const AREA_TYPE_NAMES: Record<TAreaType, string> = {
	water_01: "Water",
	grass_01: "Grass",
	sand_01: "Sand",
	plaza_01: "Plaza",
	raised_land_01: "Raised land",
};

const AREA_TYPE_IDS = Object.keys(AREA_TYPE_NAMES) as TAreaType[];

export const AREA_TYPE_LABELS = Object.fromEntries(
	AREA_TYPE_IDS.map((type) => [type, variantName(type, AREA_TYPE_NAMES[type], AREA_TYPE_IDS)]),
) as Record<TAreaType, string>;

export const areaColor = (area: Pick<TArea, "type" | "color">, palette: IScenePalette) =>
	area.color ?? palette.areas[AREA_TYPES[area.type].surface];

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

/**
 * How high the area's top stands at one of its corners: level at its height
 * for types that stay level (water), whatever lift a corner kept from before.
 */
export const cornerTop = (area: Pick<TArea, "height" | "type">, point: readonly number[]) =>
	Math.max(0, area.height + (AREA_TYPES[area.type].staysLevel ? 0 : cornerLift(point)));

/** Whether its corners can have heights of their own: not for types that stay level (water). */
export const takesCornerHeights = (area: Pick<TArea, "type">) => !AREA_TYPES[area.type].staysLevel;

/** The lift that puts a corner's top at `top` (the ground at least), for an area this high. */
export const liftForTop = (area: Pick<TArea, "height">, top: number) =>
	round(clamp(top, 0, area.height + MAX_CORNER_LIFT) - area.height);

/** Whether its top stands above the ground anywhere: drawn solid, with sides, rather than flat. */
export const isRaised = (area: Pick<TArea, "height" | "points" | "type">) =>
	area.points.some((point) => cornerTop(area, point) > 0);

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
 * How high an area's top stands at a point inside it (ADR-0096): between its
 * corners' heights, on the triangle the point is in; null outside it.
 */
export const areaTopAt = (area: Pick<TArea, "height" | "points" | "type">, point: TVec2) => {
	if (!isInsidePolygon(point, area.points)) {
		return null;
	}
	const tops = area.points.map((corner) => cornerTop(area, corner));
	for (const [a, b, c] of triangulateOutline(area.points)) {
		const weights = weightsIn(point, area.points[a], area.points[b], area.points[c]);
		if (weights?.every((w) => w > -1e-6)) {
			return round(weights[0] * tops[a] + weights[1] * tops[b] + weights[2] * tops[c]);
		}
	}
	return Math.max(0, area.height);
};

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
			other.id !== area.id && other.type === "water_01" && !isRaised(other) && !other.hidden,
	);
	const seams: [number, number, number, number][] = [];
	if (area.type !== "water_01" || isRaised(area) || others.length === 0) {
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
