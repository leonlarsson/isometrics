import { roadColor } from "#/render/RoadMesh";
import { areaColor } from "#/scene/areas";
import { isHiddenRoute } from "#/scene/roads";
import type { TArea, TRoad } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

/** Dashed chip for hidden routes, which have no colour of their own. */
const HIDDEN_ROUTE_SWATCH =
	"repeating-linear-gradient(90deg, var(--accent) 0 4px, transparent 4px 7px)";

/** The colour chip for a road in lists (CSS background). */
export const roadSwatch = (road: TRoad, palette: IScenePalette) =>
	isHiddenRoute(road.style) ? HIDDEN_ROUTE_SWATCH : roadColor(road, palette);

/** The colour chip for an area in lists. */
export const areaSwatch = (area: TArea, palette: IScenePalette) => areaColor(area, palette);
