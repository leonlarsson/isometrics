import type { TScene } from "#/scene/schema";

import { createBattlefieldTerritoryScene } from "./battlefieldTerritory";
import { createBrightwaterScene } from "./brightwater";
import { createExtractionShootersScene } from "./extractionShooters";
import { createLanternBayScene } from "./lanternBay";
import { createMonacoScene } from "./monaco";

export { createEmptyScene } from "./empty";

export interface ITemplateInfo {
	id: string;
	name: string;
	description: string;
	create: () => TScene;
}

export const TEMPLATES: ITemplateInfo[] = [
	{
		id: "brightwater",
		name: "Brightwater",
		description: "Harbour city: river bridge, flyover, hill, stadium, marina and live city data",
		create: createBrightwaterScene,
	},
	{
		id: "lantern_bay",
		name: "Lantern Bay",
		description:
			"Waterfront at dusk: lit towers, lamps on the promenade, a mirror-calm harbour. Best with Graphics: Ultra",
		create: createLanternBayScene,
	},
	{
		id: "monaco",
		name: "Monaco street circuit",
		description: "F1 street circuit around a harbour: Casino hill, hairpin, tunnel, race data",
		create: createMonacoScene,
	},
	{
		id: "battlefield_territory",
		name: "Battlefield territory",
		description:
			"A data map from Battlefield Stats: a cluster per game sized by messages, flows to the bot, a live users count and a story of the months",
		create: createBattlefieldTerritoryScene,
	},
	{
		id: "extraction_shooters",
		name: "Extraction shooter territory",
		description:
			"A data map of Steam players: a cluster per game, roads for shared audiences, stat tiles and no data where there's none",
		create: createExtractionShootersScene,
	},
];
