import type { TScene } from "#/scene/schema";

import { createBattlefieldTerritoryScene } from "./battlefieldTerritory";
import { createBrightwaterScene } from "./brightwater";
import { type ITemplateEntry, TEMPLATE_CATALOGUE, type TTemplateId } from "./catalogue";
import { createExtractionShootersScene } from "./extractionShooters";
import { createLanternBayScene } from "./lanternBay";
import { createMonacoScene } from "./monaco";
import { createNyc311Scene } from "./nyc311";
import { createShapeCastleScene } from "./shapeCastle";
import { createStockholmScene } from "./stockholm";

export {
	TEMPLATE_CATEGORIES,
	type TTemplateCategory,
} from "./catalogue";
export { createEmptyScene } from "./empty";

export interface ITemplateInfo extends ITemplateEntry {
	create: () => TScene;
}

/** Each starter's world, by its id in the catalogue. */
const CREATE: Record<TTemplateId, () => TScene> = {
	brightwater: createBrightwaterScene,
	"lantern-bay": createLanternBayScene,
	stockholm: createStockholmScene,
	monaco: createMonacoScene,
	"shape-castle": createShapeCastleScene,
	"battlefield-territory": createBattlefieldTerritoryScene,
	"extraction-shooters": createExtractionShootersScene,
	"nyc-311": createNyc311Scene,
};

/** The starter worlds, in the catalogue's order (./catalogue: their names and what they're about). */
export const TEMPLATES: ITemplateInfo[] = TEMPLATE_CATALOGUE.map((entry) => ({
	...entry,
	create: CREATE[entry.id],
}));

/** A template by its id (`lantern-bay`, ADR-0126). */
export const templateById = (id: string) => TEMPLATES.find((template) => template.id === id);
