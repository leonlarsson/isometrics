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
