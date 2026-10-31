import type { TScene } from "#/scene/schema";

import { createBattlefieldTerritoryScene } from "./battlefieldTerritory";
import { createBrightwaterScene } from "./brightwater";
import { createExtractionShootersScene } from "./extractionShooters";
import { createLanternBayScene } from "./lanternBay";
import { createMonacoScene } from "./monaco";

export { createEmptyScene } from "./empty";

/** What a starter world is: a place to look at and build on, or a map made to show data. */
export type TTemplateCategory = "places" | "dataMaps";

/** The categories, in the order File → New world offers them, with their names. */
export const TEMPLATE_CATEGORIES: { value: TTemplateCategory; label: string }[] = [
	{ value: "places", label: "Places" },
	{ value: "dataMaps", label: "Data maps" },
];

export interface ITemplateInfo {
	id: string;
	name: string;
	description: string;
	category: TTemplateCategory;
	create: () => TScene;
}

export const TEMPLATES: ITemplateInfo[] = [
	{
		id: "brightwater",
		name: "Brightwater",
		description: "Harbour city: river bridge, flyover, hill, stadium, marina and live city data",
		category: "places",
		create: createBrightwaterScene,
	},
	{
		id: "lantern_bay",
		name: "Lantern Bay",
		description:
			"Waterfront at dusk: lit towers, lamps on the promenade, a mirror-calm harbour. Best with Graphics: Ultra",
		category: "places",
		create: createLanternBayScene,
	},
	{
		id: "monaco",
		name: "Monaco street circuit",
		description: "F1 street circuit around a harbour: Casino hill, hairpin, tunnel, race data",
		category: "places",
		create: createMonacoScene,
	},
	{
		id: "battlefield_territory",
		name: "Battlefield territory",
		description:
			"A data map from Battlefield Stats: a cluster per game sized by messages, flows to the bot, a live users count and a story of the months",
		category: "dataMaps",
		create: createBattlefieldTerritoryScene,
	},
	{
		id: "extraction_shooters",
		name: "Extraction shooter territory",
		description:
			"A data map of Steam players: a cluster per game, roads for shared audiences, stat tiles and no data where there's none",
		category: "dataMaps",
		create: createExtractionShootersScene,
	},
];
