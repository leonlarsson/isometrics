import type { TArea, TAreaType, TVec2 } from "./schema";
import type { IScenePalette } from "./theme";

/** Free-form areas: water, lawns, beaches, squares and raised land. See docs/adr/0021. */

export const AREA_TYPE_LABELS: Record<TAreaType, string> = {
	water: "Water",
	grass: "Grass",
	sand: "Sand",
	plaza: "Plaza",
	land: "Raised land",
};

/** Height a new area of each type starts with ("land" is for rocks and plateaus). */
export const AREA_TYPE_HEIGHT: Record<TAreaType, number> = {
	water: 0,
	grass: 0,
	sand: 0,
	plaza: 0,
	land: 1.5,
};

export const areaColor = (area: Pick<TArea, "type" | "color">, palette: IScenePalette) =>
	area.color ?? palette.areas[area.type];

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
