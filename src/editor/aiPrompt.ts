import { GUIDE, sectionsAsMarkdown } from "#/guide/guide";
import { APP_NAME } from "#/lib/app";
import { compactWorld } from "#/parts/compactWorld";
import { PARTS, partName } from "#/parts/registry";
import {
	AreaKindSchema,
	FenceKindSchema,
	RoadKindSchema,
	type TScene,
	type TSceneInput,
} from "#/scene/schema";

/**
 * Build with your AI (ADR-0116): the prompt someone copies into the AI chat
 * of their choice. It says what they want in their own words, carries their
 * data (and the world, to change one), and teaches the format: the guide's
 * rules, every part kind, and a small world that shows the moves. What comes
 * back is pasted in and read like any untrusted world (`readWorld`).
 */

/** More characters of pasted data than this are cut, saying so: a chat can't take a whole database. */
export const MOST_DATA_CHARACTERS = 60_000;

export interface IAiPromptInput {
	/** How they want the world to look and what it should have, in their words. */
	description: string;
	/** Their data as text (CSV, JSON, a list…), or "". */
	data: string;
	/** The world to change, or null for a new one. */
	world: TScene | null;
	/** The site's address, so the AI can open the schema and examples. */
	origin: string;
	/**
	 * Changing a world handed over as a link (ADR-0120): where its JSON is, for an
	 * hour, instead of the world in the prompt.
	 */
	worldUrl?: string | null;
}

/** A small world that shows the moves: a row-following cluster, a value on a card, a flow road. */
export const EXAMPLE_WORLD = {
	version: 1,
	meta: { title: "Shops", subtitle: "Sales this month" },
	ground: { width: 48, depth: 36 },
	camera: { openingViewpointId: "view_all" },
	viewpoints: [{ id: "view_all", name: "All the shops", target: [0, 0], span: 40 }],
	onScreen: {
		legend: [
			{ label: "Size", meaning: "sales this month, log scale" },
			{ label: "Roads", meaning: "deliveries between shops: wider and busier, more deliveries" },
		],
		tileKeys: ["total_sales"],
	},
	data: {
		sources: [{ id: "sheet", name: "sales.csv", kind: "file", fileName: "sales.csv" }],
		values: [{ key: "total_sales", name: "Sales, all shops", value: 18400, unit: "€" }],
		tables: [
			{
				key: "shops",
				name: "Shops",
				keyColumn: "shop",
				source: { sourceId: "sheet" },
				columns: [
					{ key: "shop", name: "Shop" },
					{ key: "sales", name: "Sales this month" },
				],
				rows: [
					{ shop: "North", sales: 12000 },
					{ shop: "South", sales: 6400 },
				],
			},
			{
				key: "deliveries",
				name: "Deliveries",
				keyColumn: "route",
				columns: [
					{ key: "route", name: "Route" },
					{ key: "from", name: "From" },
					{ key: "to", name: "To" },
					{ key: "count", name: "Deliveries" },
				],
				rows: [{ route: "North → South", from: "North", to: "South", count: 40 }],
			},
		],
	},
	entities: [
		{
			id: "shop_north",
			kind: "house_cluster_01",
			name: "North",
			position: [-10, -6],
			props: { builtShare: 0.8, width: 8, seed: 1 },
			dataRow: { tableKey: "shops", rowKey: "North" },
			data: {
				builtShare: {
					key: "row.sales",
					usesLogScale: true,
					valueAtLowSetting: 100,
					valueAtHighSetting: 20000,
					lowSetting: 0.06,
					highSetting: 1,
				},
			},
			label: { isShown: true, dataKeys: ["row.sales"], offset: [0, 1.5, 0] },
		},
		{
			id: "shop_south",
			kind: "house_cluster_01",
			name: "South",
			position: [10, 6],
			props: { builtShare: 0.7, width: 8, seed: 2 },
			dataRow: { tableKey: "shops", rowKey: "South" },
			data: {
				builtShare: {
					key: "row.sales",
					usesLogScale: true,
					valueAtLowSetting: 100,
					valueAtHighSetting: 20000,
					lowSetting: 0.06,
					highSetting: 1,
				},
			},
			label: { isShown: true, dataKeys: ["row.sales"], offset: [0, 1.5, 0] },
		},
		{ id: "tree_1", kind: "pine_tree_01", position: [-16, 8] },
		{ id: "tree_2", kind: "round_tree_01", position: [15, -9] },
	],
	roads: [
		{
			id: "road_north_south",
			name: "North → South",
			kind: "road_01",
			points: [
				[-5.4, -3.2],
				[5.4, 3.2],
			],
			width: 2,
			dataRow: { tableKey: "deliveries", rowKey: "North → South" },
			flow: { isOn: true, vehicleKind: "delivery_van_01", vehicleCountAlong: 2 },
			data: {
				width: {
					key: "row.count",
					valueAtLowSetting: 0,
					valueAtHighSetting: 100,
					lowSetting: 0.6,
					highSetting: 3,
				},
				vehicleDensity: {
					key: "row.count",
					valueAtLowSetting: 0,
					valueAtHighSetting: 100,
					lowSetting: 0,
					highSetting: 3,
				},
			},
		},
	],
	areas: [
		{
			id: "pond",
			kind: "water_01",
			points: [
				[-20, -14],
				[-14, -14],
				[-14, -10],
				[-20, -10],
			],
		},
	],
} satisfies TSceneInput;

/** Every part kind, one line each: what it is, its settings with their defaults, its colours. */
export const partsCatalogue = () =>
	PARTS.map((part) => {
		const defaults = part.schema.parse({}) as Record<string, unknown>;
		const props = part.fields
			.map((field) => `${field.key} ${JSON.stringify(defaults[field.key])}`)
			.join(", ");
		const colors = part.colors.map((color) => color.id).join(", ");
		return `- \`${part.kind}\`: ${partName(part)} (${part.category})${props ? `; props: ${props}` : ""}${colors ? `; colors: ${colors}` : ""}`;
	}).join("\n");

/** How to answer with a new world. */
const WORLD_ANSWER = [
	"Give it a `meta.title`, a ground big enough for what's on it, an opening viewpoint that shows it all, and a legend for anything that shows a number.",
	"Leave out every field that stays at its default, as the example does: it keeps the world short.",
	"**If you can make files** (a downloadable file, an artifact, a code tool's output), write the world to a file named `world.json` and give that, not the JSON in the chat: it's long, and a file is easy to open in the app.",
	"Otherwise, answer with the world alone, in one ```json code block, with no explanation before or after, so it can be pasted straight back.",
].join("\n\n");

/** A patch that shows every move, for the prompt (ADR-0118). */
export const EXAMPLE_PATCH = {
	isPatch: true,
	lighting: { time: 19.5 },
	entities: {
		change: [{ id: "lighthouse", scale: 1.6, props: { floorCount: null } }],
		add: [{ id: "boat_2", kind: "sailing_boat_01", name: "Boat 2", position: [12, 8] }],
		remove: ["old_shed"],
	},
	data: { values: { change: [{ key: "boats", value: 4 }] } },
};

/** How to answer with the changes to a world: a patch (ADR-0118). */
const PATCH_ANSWER = [
	'A **patch**: the changes only, shaped like the world with the same field names, plus `"isPatch": true`. For example:',
	`\`\`\`json\n${JSON.stringify(EXAMPLE_PATCH, null, 1)}\n\`\`\``,
	"- A settings group (`meta`, `ground`, `lighting`, `sky`, `water`, `weather`, `camera`, `onScreen`, `traffic`, …): only the fields that change. Groups inside merge the same way, a list is replaced whole, and `null` removes a field so its default applies.",
	"- A list of things (`entities`, `roads`, `areas`, `fences`, `viewpoints`, `moods`; `data.values` and `data.tables` by `key`, `data.sources` by `id`): `remove` (their ids), `change` (each with the id of what it changes, and only the fields that change, merged the same way) and `add` (whole new things, with ids no other thing has). Never send a whole list.",
	"- Use the ids in the world above. Leave out every field that stays as it is.",
	"If what they ask replaces most of the world (start over, a different place), answer with a whole new world instead, without `isPatch`, written as the example world is.",
	"Answer with the patch alone, in one ```json code block, with no explanation before or after, so it can be pasted straight back (or as a file, `patch.json`, if it's long and you can make files).",
].join("\n\n");

/** Pasted data, cut to a size a chat takes, saying how much was left out. */
const dataForPrompt = (data: string) => {
	const trimmed = data.trim();
	if (trimmed.length <= MOST_DATA_CHARACTERS) {
		return trimmed;
	}
	return `${trimmed.slice(0, MOST_DATA_CHARACTERS)}\n… (cut here: ${(trimmed.length - MOST_DATA_CHARACTERS).toLocaleString("en")} more characters weren't included)`;
};

/** The guide's sections an AI needs to write a world: the rules and the format. */
const RULES_AND_FORMAT = GUIDE.filter(
	(section) => section.id === "rules" || section.id === "format",
);

/** The prompt to copy into an AI chat. */
export const aiPrompt = ({ description, data, world, origin, worldUrl = null }: IAiPromptInput) => {
	const wanted = description.trim();
	const given = dataForPrompt(data);
	return [
		world
			? `You're changing a world in ${APP_NAME}, an app for small animated 3D worlds (low-poly buildings, roads, water, vehicles) whose things can show data. Change it as asked below and answer with a patch: only what changes, as one JSON document (how is at the end). Everything not asked about stays as it is.`
			: `You're building a world in ${APP_NAME}, an app for small animated 3D worlds (low-poly buildings, roads, water, vehicles) whose things can show data. Build the world described below and answer with it as one JSON document (how is at the end).`,
		"## What they want",
		wanted
			? wanted
					.split("\n")
					.map((line) => `> ${line}`)
					.join("\n")
			: "> (Nothing described: make a calm, pleasant small town.)",
		"## Their data",
		given
			? `Show this data in the world: put it in \`data\` (tables and values, as in the example), and make things follow it (rows become things, amounts sizes, from → to → amount roads). Use the numbers as they are; don't invent more.\n\n\`\`\`\n${given}\n\`\`\``
			: world
				? "No new data in this prompt: keep the world's own, and add any they give you in this chat (a file, or rows pasted after this prompt) the same way, with the numbers as they are."
				: 'None in this prompt. They may give you data in this chat instead (a file, or rows pasted after this prompt): if they do, put it in `data` (tables and values, as in the example) and make things follow it, with the numbers as they are. With no data at all: if what they want shows no numbers, set `"data": { "isOn": false }` for a plain world to build; if it does, use example numbers, and say so in each source\'s and column\'s `about` ("Example numbers").',
		...(world
			? [
					"## The world now",
					worldUrl
						? `It's at ${worldUrl}, as JSON with everything at its default left out (opening a world fills the defaults back in), for the next hour: open it there. If you can't open links, say so, and they'll paste the world instead.`
						: `With everything at its default left out (opening a world fills the defaults back in):\n\n\`\`\`json\n${JSON.stringify(compactWorld(world))}\n\`\`\``,
				]
			: []),
		"## How to write a world",
		sectionsAsMarkdown(RULES_AND_FORMAT, origin, 3),
		`If you can open links, the full format is at ${origin}/api/worlds/schema and complete example worlds are listed at ${origin}/api/worlds/templates; the guide for people is at ${origin}/guide.md. If you can make HTTP requests (running code, a tool), check your world before answering: POST it as JSON to ${origin}/api/worlds/validate, which answers with its problems and warnings and where they are, and fix them. Everything you need is also below.`,
		"## Roads, areas and fences",
		`Roads' \`kind\`: ${RoadKindSchema.options.map((kind) => `\`${kind}\``).join(", ")}. Areas' (\`points\`: their corners): ${AreaKindSchema.options.map((kind) => `\`${kind}\``).join(", ")}. Fences': ${FenceKindSchema.options.map((kind) => `\`${kind}\``).join(", ")}.`,
		"## Every part kind",
		"Objects' `kind`, with their `props` and defaults (leave out what stays at its default) and their colour ids (`colors: { <id>: { color: \"#rrggbb\" } }`). Footprints are about 1 to 3 grid units for houses and vehicles, more for big buildings and clusters (`width` sets a cluster's).",
		partsCatalogue(),
		"## A small example world",
		`Two shops as clusters following table rows, sized by sales on a log scale, a value as a tile, and a road whose width and vans follow deliveries:\n\n\`\`\`json\n${JSON.stringify(EXAMPLE_WORLD, null, 1)}\n\`\`\``,
		"## Answer",
		world ? PATCH_ANSWER : WORLD_ANSWER,
		`If you can make HTTP requests (running code, a tool), you can hand your answer back as a link instead: POST it (the world or the patch, as JSON) to ${origin}/api/user-worlds and answer with just the \`url\` it returns, which they paste back. It's public to anyone with that link for an hour.`,
	].join("\n\n");
};

/**
 * The world in what an AI answered: the JSON in it, inside ``` fences or
 * between its outermost braces, parsed. Throws with a reason people can act on.
 */
export const worldFromAnswer = (answer: string): unknown => {
	const text = answer.trim();
	if (!text) {
		throw new Error("Nothing pasted yet.");
	}
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	const inside = fenced ? fenced[1] : text;
	const start = inside.indexOf("{");
	const end = inside.lastIndexOf("}");
	if (start === -1) {
		throw new Error("There's no world in it: a world is JSON, starting with {.");
	}
	try {
		// Without a closing brace it was cut off, and reading it says so below.
		return JSON.parse(end > start ? inside.slice(start, end + 1) : inside.slice(start));
	} catch (error) {
		throw new Error(
			`Its JSON doesn't read (${error instanceof Error ? error.message : String(error)}). Ask your AI for the whole world again, as JSON only; long answers are sometimes cut off.`,
		);
	}
};
