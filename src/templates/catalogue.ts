/**
 * The starter worlds by name, without their worlds (ADR-0146): what a
 * starter is called and is about, for what needs only that, like a page's
 * link preview (`/templates/<id>`), so it never loads every world to say it.
 * `TEMPLATES` (./index) is this list with each world's `create`.
 */

/** What a starter world is: a place to look at and build on, or a map made to show data. */
export type TTemplateCategory = "places" | "dataMaps";

/** The categories, in the order File → New world offers them, with their names. */
export const TEMPLATE_CATEGORIES: { value: TTemplateCategory; label: string }[] = [
	{ value: "places", label: "Places" },
	{ value: "dataMaps", label: "Data maps" },
];

/** A starter world as it's listed: its id (in its address, ADR-0126), name and what it's about. */
export interface ITemplateEntry {
	id: string;
	name: string;
	description: string;
	category: TTemplateCategory;
}

export const TEMPLATE_CATALOGUE = [
	{
		id: "brightwater",
		name: "Brightwater",
		description: "Harbour city: river bridge, flyover, hill, stadium, marina and live city data",
		category: "places",
	},
	{
		id: "lantern-bay",
		name: "Lantern Bay",
		description:
			"Waterfront at dusk: lit towers, lamps on the promenade, a mirror-calm harbour. Best with Graphics: Ultra",
		category: "places",
	},
	{
		id: "stockholm",
		name: "Stockholm",
		description:
			"Gamla stan and its waters on a two-minute evening: lanterns, lit windows one by one, a floodlit palace and churches, Centralbron's traffic, ferries and example data. Best with Graphics: Nice or Ultra",
		category: "places",
	},
	{
		id: "interchange",
		name: "The Interchange",
		description:
			"A traffic landscape: a four-level stack, a cloverleaf, a river bridge and tunnels into the hills, busy with traffic, and a day of example counts as a story. Best with Graphics: Ultra",
		category: "places",
	},
	{
		id: "monaco",
		name: "Monaco street circuit",
		description: "F1 street circuit around a harbour: Casino hill, hairpin, tunnel, race data",
		category: "places",
	},
	{
		id: "shape-castle",
		name: "Shape Castle",
		description:
			"A castle by a river built only from shapes: walls, towers, a keep lit after dark, an arch bridge. No data, a world to build on",
		category: "places",
	},
	{
		id: "battlefield-territory",
		name: "Battlefield territory",
		description:
			"A data map from Battlefield Stats: a cluster per game sized by messages, flows to the bot, a live users count and a story of the months",
		category: "dataMaps",
	},
	{
		id: "extraction-shooters",
		name: "Extraction shooter territory",
		description:
			"A data map of Steam players: a cluster per game, roads for shared audiences, stat tiles and no data where there's none",
		category: "dataMaps",
	},
] as const satisfies readonly ITemplateEntry[];

export type TTemplateId = (typeof TEMPLATE_CATALOGUE)[number]["id"];

/** A starter as it's listed, by its id, or undefined. */
export const templateEntryById = (id: string): ITemplateEntry | undefined =>
	TEMPLATE_CATALOGUE.find((entry) => entry.id === id);

/**
 * Where a starter's link preview is on this site (`og:image`: a JPEG of it on
 * the light background, made by scripts/starter-pictures.mjs), or null.
 */
export const starterPreviewOf = (id: string) =>
	templateEntryById(id) ? `/starters/${id}-preview.jpg` : null;
