import type { TArea, TAreaType, TVec2 } from "./schema";
import type { IScenePalette } from "./theme";
import { variantName } from "./variants";

/** Free-form areas: water, lawns, beaches, squares and raised land. See docs/adr/0021. */

/**
 * What each area type looks like. Ids are numbered so a type can get variants
 * (water_02…); code asks these, never the id. `startHeight`: raised land is for
 * rocks and plateaus.
 */
export const AREA_TYPES: Record<
	TAreaType,
	{ surface: keyof IScenePalette["areas"]; startHeight: number; roughness: number }
> = {
	water_01: { surface: "water", startHeight: 0, roughness: 0.4 },
	grass_01: { surface: "grass", startHeight: 0, roughness: 0.95 },
	sand_01: { surface: "sand", startHeight: 0, roughness: 0.95 },
	plaza_01: { surface: "plaza", startHeight: 0, roughness: 0.95 },
	raised_land_01: { surface: "land", startHeight: 1.5, roughness: 0.95 },
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

/** Signed area of a polygon (shoelace); its absolute value is the area in square units. */
export const polygonArea = (points: TVec2[]) => {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, z1] = points[i];
		const [x2, z2] = points[(i + 1) % points.length];
		sum += x1 * z2 - x2 * z1;
	}
	return sum / 2;
};

/** Whether a point lies inside a closed outline (even-odd rule). */
export const isInsidePolygon = ([x, z]: TVec2, points: TVec2[]) => {
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
			other.id !== area.id && other.type === "water_01" && other.height === 0 && !other.hidden,
	);
	const seams: [number, number, number, number][] = [];
	if (area.type !== "water_01" || area.height > 0 || others.length === 0) {
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
