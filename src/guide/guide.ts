import { APP_NAME } from "#/lib/app";

/**
 * The guide (ADR-0116): how a world is made, walked through with a real API,
 * for people and for the AIs they ask to build worlds. One text for the
 * `/guide` page, `/guide.md` and the prompt Build with AI copies. Text
 * marks **bold** (what's on screen) and `code` (what's typed); no React.
 */

export type TGuideBlock =
	| { kind: "text"; text: string }
	| { kind: "steps"; steps: string[] }
	| { kind: "points"; points: string[] }
	| { kind: "note"; text: string };

export interface IGuideSection {
	id: string;
	title: string;
	blocks: TGuideBlock[];
	/** Smaller sections under it. */
	parts?: IGuideSection[];
}

/** Battlefield Stats' public API, the walkthrough's example: a Discord bot's deliveries per game. */
export const GUIDE_API = {
	counts: "https://api.battlefieldstats.com/outputs/counts",
	users: "https://api.battlefieldstats.com/users/count",
};

export const GUIDE_INTRO = `${APP_NAME} builds small animated 3D worlds: low-poly buildings, roads, water and vehicles, with cards that show numbers. Build one by hand like a city builder, or make it show your data: a warehouse for each row of a spreadsheet, a road as busy as the traffic it carries. This guide walks through both, with a real API.`;

export const GUIDE: IGuideSection[] = [
	{
		id: "pieces",
		title: "The pieces of a world",
		blocks: [
			{
				kind: "points",
				points: [
					"**Objects**: buildings, vehicles, trees, lamps and more, from **Add to scene** on the left. Each has its own settings: size, colours, lights.",
					"**Roads**, **areas** (water, grass, sand, plazas, raised land) and **fences**, drawn point by point. Roads meet at **junctions**, where vehicles drive on from one road to another. A fence can have gates, open or shut by hand or from data, and an area makes one round itself with **Fence along the edge**.",
					"**Label cards** float over objects with a title and values.",
					"**Data**: **values** (one number, like registered users), **tables** (rows, one for each warehouse, game or city) and the **sources** they're read from: a spreadsheet, a link or an API.",
					"Things **follow data**: an object follows a table row, and its size, colours, lights and card show the row's columns. Roads show flows (from, to, amount) with their width and vehicles.",
					"**Edit** and **View** at the top: build in Edit, show it in View, where cards open into details and the data has tiles and a time slider.",
				],
			},
			{
				kind: "note",
				text: "A new world starts as a plain city builder, without data; the starters that show data come with it on. Turn **Uses data** on (or off) in the **Data** tab or the **World** tab (the globe icon on the right): off, nothing about data shows.",
			},
			{
				kind: "note",
				text: "A world someone sends you (a file, an AI's answer) can name links and APIs to read: external sources. Every one starts disabled: when such a world opens, a dialog lists the external sources it reads, to allow now or later in the Data tab (each under **Sources** has **Allow**). Only links you read yourself, with **Read a link or API…**, are read without asking; **External sources this browser reads…** lists every one you've allowed, to forget any.",
			},
		],
	},
	{
		id: "junctions",
		title: "Roads that meet: junctions",
		blocks: [
			{
				kind: "steps",
				steps: [
					"Draw a road: **Add to scene**, **Roads**, then click points on the ground; Enter or a double-click finishes it.",
					"To start or end a new road on another one, click on that road (or on its end): a ring shows where, and clicking there connects them at a **junction**. Ending on a road finishes the new one. Hold **Alt** to put a point there without connecting.",
					"To connect roads already drawn, drag a road's end onto another road, or onto its end, and let go: the bar offers **Connect** (or **Join**, to make one road of two).",
					"With **Play motion** on (Space), vehicles on connected roads drive on at each junction, along a way picked at random, and turn round only at a dead end.",
				],
			},
			{
				kind: "note",
				text: "Connecting to the middle of a road cuts it in two there (the second half's name gets \"(2)\"). Click a connected end's point to see what it's connected to: **Draw a road from here**, **Join into one road** (when just two roads meet) and **Disconnect**. Dragging it moves the junction, and the other roads' ends follow.",
			},
		],
	},
	{
		id: "walkthrough",
		title: "Walkthrough: a world from the Battlefield Stats API",
		blocks: [
			{
				kind: "text",
				text: "Battlefield Stats is a Discord bot for Battlefield players. Its public API says how many **deliveries** it has made (stats it sent to players), for each game. The steps below turn them into a world: a cluster of buildings for each game, as big as its deliveries, with a live count of the bot's users.",
			},
		],
		parts: [
			{
				id: "read-table",
				title: "1. Read the API as a table",
				blocks: [
					{
						kind: "steps",
						steps: [
							"Open the **Data** tab on the right (the chart icon) and click **Add data**: the Data window opens.",
							"Click **A link or API…**.",
							`In **Address**, type \`${GUIDE_API.counts}\` and click **Read**.`,
							"It answers with a list. Under it, set **Keep it as** to **A table: a row for each entry**, call it `Deliveries`, keep the columns `category`, `item` and `sent`, and set **Rows named by** to `item` (a game, a language or a part of the bot).",
							"Set **Read it again** to **Every hour**.",
							"Click **Add 1 table**. The Data window shows the new table, under its source, with **Show it in the world** first.",
						],
					},
				],
			},
			{
				id: "place-rows",
				title: "2. Place an object for each row",
				blocks: [
					{
						kind: "steps",
						steps: [
							"Under **Show it in the world**, click **Place one for each row…** (later: click the table in the Data tab to open it again).",
							"**Part**: Tower cluster (many buildings that grow with a number). **Layout**: A circle. **Sized by**: `sent`, **Which grows**: Built, with **Log scale** on (the numbers go from hundreds to tens of thousands). **On each card**: `sent`.",
							"Click **Place … objects**. Each is named by its row and follows it: its card shows its deliveries, and the busiest games have the most buildings.",
						],
					},
					{
						kind: "note",
						text: "This API lists languages and parts of the bot too, so they get objects as well. Delete the ones you don't want (select them, then Delete), or place your own, as below.",
					},
				],
			},
			{
				id: "match-names",
				title: "3. Or: give your own objects their rows",
				blocks: [
					{
						kind: "steps",
						steps: [
							"Place a few clusters from **Add to scene** (Buildings) and name them as the rows are: `Battlefield 6`, `Battlefield 2042`, `Battlefield V`.",
							"Select them all, open their **Data** tab, pick **Table**: Deliveries, and click **Give each the row matching its name**. (Or, in the Data window, the table's **Show it in the world** offers to give every object named like a row its row.)",
							"In one's **Data** tab, under **Follows data**, pick **Built** in **Make follow data**, then `Row: sent` as its **Data value**, on a log scale. Select them all to set it for every one.",
							"In its **Label** tab, add `Row: sent` to **Values shown**.",
						],
					},
				],
			},
			{
				id: "read-value",
				title: "4. Add a value: the bot's users",
				blocks: [
					{
						kind: "steps",
						steps: [
							`**Add data**, **A link or API…** again, with \`${GUIDE_API.users}\`, then **Read**.`,
							"Under **Values**, tick `totalUsers`, set **Read it again** to **Every minute**, and click **Add 1 value**.",
							"Under **Show it in the world**, click **Add it as a tile in View mode**. Or select an object first and put it on that object's card from there (or its **Label** tab, **Values shown**).",
							"Already have a value typed by hand that cards show? Open it in the Data window and click **Read it from a source…**: pick the source and the number, and it follows that from now on, keeping its name and its cards.",
						],
					},
				],
			},
			{
				id: "view",
				title: "5. Look at it",
				blocks: [
					{
						kind: "steps",
						steps: [
							"Click **View** at the top. Cards show the numbers; click one for its details.",
							"While the world is open, the API is read again on its timer and what arrives shows at once. To save it with the world, click **Keep these values** in the Data tab.",
							"Add a **legend** so viewers know what sizes mean: in the **World** tab, under **Legend and tiles**, click **Suggest chips** (Size: Deliveries, log scale), and edit them.",
						],
					},
				],
			},
		],
	},
	{
		id: "ai",
		title: "Building with AI",
		blocks: [
			{
				kind: "text",
				text: `Any AI chat can write a world for you: ${APP_NAME} doesn't call one itself.`,
			},
			{
				kind: "steps",
				steps: [
					"Open **Build with AI** in the File menu and pick **A new world…** (or **Build with AI…** in **New world**, or **Build with AI** in the welcome; **AI** next to the File menu opens it too, for a new world when none is open).",
					"Say what your AI should build: how it looks and what it has. Data is optional: **Add your data** to paste it there (or **Upload a file…**), or give it to your AI yourself in the chat after the prompt. An API's or a CSV or JSON file's address works too: your AI adds it as a source the world reads itself, live, and like every external source it's read only once you allow it.",
					"Click **Copy the prompt** and paste it into your AI. It answers with a file, `world.json`, if it can make one, else with the world as text.",
					"Bring back what it wrote: paste it into **What your AI wrote**, or **Upload a file…** with its file. It's checked as it arrives: anything wrong is listed, with **Copy the problems for your AI** to send them back. Click **Open it**: it opens as a new world, repaired where it needs it; your other worlds are untouched. Came back later with what it wrote? **Paste what your AI wrote**, in the dialog or in the File menu's **Build with AI**, goes straight there.",
				],
			},
			{
				kind: "text",
				text: "To change the world you're in, click **AI** next to the File menu (or pick **Change this world…** under **Build with AI** in the File menu) and say what to change. Your AI answers with a **patch**, only the changes, which is quick to copy; the dialog says what it changes before you click **Apply the changes** (one undo step). To give your AI a link to the world instead of the whole world, open **More options**.",
			},
		],
	},
	{
		id: "sharing",
		title: "Sharing a world",
		blocks: [
			{
				kind: "steps",
				steps: [
					"Open **Share a link…** in the File menu (or the save status next to it).",
					"Pick how long it's kept (**Keep it for**: an hour to 30 days) and click **Create a public link**. Nothing is uploaded before you do.",
					"Copy the link and send it. Anyone with it can open the world and make a copy, until it expires: share nothing private.",
					"It's a snapshot: share again to send later changes. **Stop sharing** ends a link early; links you shared from this browser are listed there.",
				],
			},
			{
				kind: "note",
				text: "A shared link opens that world on its own, in View mode, and keeps nothing in your browser until you click **Keep a copy** (or **Edit**, which asks first). If it uses external sources, you're asked before it's built: **Open and allow**, **Open** (nothing is read until you allow them, from the bar at the top) or **Don't open it**. A link shared moments ago can take up to a minute to open everywhere.",
			},
			{
				kind: "text",
				text: "Changing a world with AI, **Give your AI a link to the world** (under **More options**) puts a link to the world in the prompt instead of the whole world (public for an hour), and you can paste back a link your AI gives you instead of its JSON.",
			},
		],
	},
	{
		id: "rules",
		title: "What makes a good data world",
		blocks: [
			{
				kind: "points",
				points: [
					"**One row, one thing.** Each row becomes an object (a cluster for an amount), named by the row's key, following its row (`dataRow`).",
					"**Sizes on a log scale** when numbers span many orders of magnitude, so small ones still show.",
					"**Flows become roads**: a table of from, to and amount draws a road from one thing to the other, its width and vehicles per 10 units following the amount.",
					"**Say what things mean**: a legend chip for each thing that shows a number (Size, Roads, Colour).",
					"**Numbers say where they come from**: a source with a page to read more. Made-up numbers say so (`Example numbers`).",
					"**No number, no invention**: a thing without data shows **no data**, greyed.",
					"**Restraint**: a calm ground, a few kinds of buildings, trees and landmarks to tell places apart. The data is the point.",
				],
			},
		],
	},
	{
		id: "format",
		title: "For AIs: the world format",
		blocks: [
			{
				kind: "points",
				points: [
					"A world is one JSON document. Its format, with every part kind and its settings, is the JSON Schema at `/api/worlds/schema`.",
					"Complete example worlds are listed at `/api/worlds/templates`, each at `/api/worlds/templates/<id>`; `battlefield-territory` and `extraction-shooters` are data maps.",
					"Distances are grid units; the ground is centred on 0, 0; x runs east, z south; an object's `rotation` is `[x, y, z]` in degrees.",
					"Objects follow a table row with `dataRow: { tableKey, rowKey }` and read its columns as `row.<column>` in label `dataKeys` and in `data` bindings (sizes: `scale` or a prop such as `builtShare`, with `valueAtLowSetting`, `valueAtHighSetting`, `lowSetting`, `highSetting`, `usesLogScale`).",
					"Roads follow rows the same way, with `flow: { enabled: true }` and `data.width` / `data.vehicleDensity` bindings for amounts.",
					'Roads meet at `junctions`: `{ "id": "j1", "ends": [{ "roadId": "main", "end": "end" }, { "roadId": "side", "end": "start" }] }` joins road ends (`start` = a road\'s first point, `end` = its last) that are at the same x, z and altitude. A T or a crossroads joins the ends of the roads that meet there, so the road going through is two roads. Vehicles on a road with a junction drive on across the network.',

					"Fields left out get their defaults, so leave out what stays at its default; unknown or invalid fields are repaired or dropped when the world opens.",
					"Check a world before handing it over: POST it as JSON to `/api/worlds/validate`. It answers whether it opens as written (`isValid`), with its `problems` (what opening it would repair or leave out) and `warnings` (what opens but won't look as meant: a part kind that doesn't exist, a card value that reads nothing, an object off the ground), each with where it is.",
					"Long worlds are best handed over as a file, `world.json`: **Upload a file…** in Build with AI opens it.",
					"Worlds and patches can be handed back as a link: POST the JSON to `/api/user-worlds` (kept for an hour unless `?expiresIn=` says 86400, 604800 or 2592000 seconds) and give the `url` it returns. Anyone with the link can open it until it expires; `GET /api/user-worlds/<id>` gives the JSON.",
					'To change a world, answer with a patch, not the whole world: the changes only, shaped like the world with the same field names, plus `"isPatch": true`. A settings group (`lighting`, `meta`, …) holds only the fields that change, merged as JSON Merge Patch (`null` puts a field back to its default); a list of things takes `remove` (ids), `change` (the id and only the fields that change) and `add` (whole new things), never the whole list. Things are named by their id, not their place in a list. Its format: `/api/worlds/schema/patch`; check it with `/api/worlds/validate`, sending `{ "world": ..., "patch": ... }`.',
				],
			},
		],
	},
];

/** **bold** and `code` as Markdown already; anything else as it is. */
const blockAsMarkdown = (block: TGuideBlock) => {
	switch (block.kind) {
		case "text":
			return block.text;
		case "note":
			return `> ${block.text}`;
		case "steps":
			return block.steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
		case "points":
			return block.points.map((point) => `- ${point}`).join("\n");
	}
};

const sectionAsMarkdown = (section: IGuideSection, depth: number): string =>
	[
		`${"#".repeat(depth)} ${section.title}`,
		...section.blocks.map(blockAsMarkdown),
		...(section.parts ?? []).map((part) => sectionAsMarkdown(part, depth + 1)),
	].join("\n\n");

/** The site's own addresses (`/api/worlds/schema`) made whole with `origin`, so an AI can open them. */
const withOrigin = (text: string, origin: string) =>
	text.replace(/`\/(guide\.md|api\/(?:worlds|user-worlds)[^`]*)`/g, `\`${origin}/$1\``);

/** Some of the guide's sections as Markdown, headed at `depth`, for the prompt. */
export const sectionsAsMarkdown = (sections: readonly IGuideSection[], origin = "", depth = 2) =>
	withOrigin(sections.map((section) => sectionAsMarkdown(section, depth)).join("\n\n"), origin);

/** The whole guide as Markdown, for `/guide.md`. */
export const guideAsMarkdown = (origin = "") =>
	[`# ${APP_NAME}: a guide`, GUIDE_INTRO, sectionsAsMarkdown(GUIDE, origin)].join("\n\n");
