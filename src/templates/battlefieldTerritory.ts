import {
	SCENE_VERSION,
	SceneSchema,
	type TEntityInput,
	type TScene,
	type TVec2,
} from "#/scene/schema";

import {
	builtShareFor,
	cluster,
	flowRoad,
	logScale,
	logSize,
	reachOf,
	scaleFor,
} from "./dataWorld";

/*
 * Battlefield territory: the data study's example with the owner's own data,
 * Battlefield Stats (a Discord bot for Battlefield players).
 *
 * A cluster per Battlefield game, sized by how many deliveries the bot has
 * made for it (its outputs: stats sent to players, log scale), with roads
 * carrying each month's deliveries to the bot's tower in the middle: wider
 * and busier for more. The tower's floors follow deliveries per month, with a sparkline, a change on the month before
 * and a watch line. The story bar plays the months since 2023: clusters grow
 * with the deliveries made by then, roads swell and thin with each month's (the
 * launch of Battlefield 6 in August 2025 floods its road). A beacon shows
 * registered users, read again every minute while the world is open.
 *
 * It opens from its saved snapshot (read 31 Oct 2026, the files in
 * docs/data-study/samples) and reads the APIs again when online: they let
 * browsers read them (CORS open).
 */

const READ_AT = "2026-10-31T12:33:00Z";

/** Deliveries per game (api.battlefieldstats.com/outputs/counts, category game). */
const GAMES: { name: string; sent: number; kind: string; color: string }[] = [
	{ name: "Battlefield 6", sent: 80969, kind: "tower_cluster_01", color: "#d1a03b" },
	{ name: "Battlefield 2042", sent: 60336, kind: "tower_cluster_01", color: "#4f86c6" },
	{ name: "Battlefield V", sent: 43592, kind: "house_cluster_01", color: "#a8577e" },
	{ name: "Battlefield 1", sent: 30783, kind: "house_cluster_01", color: "#9c6b3e" },
	{ name: "Battlefield 4", sent: 23802, kind: "shed_cluster_01", color: "#2f9e8f" },
	{ name: "Battlefield 3", sent: 4058, kind: "shed_cluster_01", color: "#7d8a52" },
	{ name: "Battlefield Hardline", sent: 1083, kind: "tent_cluster_01", color: "#c8553d" },
	{ name: "Battlefield 2", sent: 557, kind: "tent_cluster_01", color: "#8a7db8" },
	{ name: "Battlefield Bad Company 2", sent: 161, kind: "tent_cluster_01", color: "#3fb07c" },
];

/** The rest of the counts (languages, segments of the bot), kept in the table as the API gives them. */
const OTHER_COUNTS: [string, string, number][] = [
	["language", "English", 175042],
	["language", "French", 11883],
	["language", "Polish", 11530],
	["language", "Brazilian Portuguese", 11388],
	["language", "German", 10030],
	["language", "Spanish", 7925],
	["segment", "Overview", 190536],
	["segment", "Weapons", 28313],
	["segment", "Vehicles", 11800],
	["segment", "Classes", 7125],
];

/** Deliveries per month (battlefieldstats-sent-monthly.csv). */
const MONTHLY: [string, number][] = [
	["2023-01", 5581],
	["2023-02", 5063],
	["2023-03", 6552],
	["2023-04", 6323],
	["2023-05", 5182],
	["2023-06", 5764],
	["2023-07", 5207],
	["2023-08", 4939],
	["2023-09", 3751],
	["2023-10", 4817],
	["2023-11", 4812],
	["2023-12", 4498],
	["2024-01", 5395],
	["2024-02", 5025],
	["2024-03", 5321],
	["2024-04", 4083],
	["2024-05", 3483],
	["2024-06", 3144],
	["2024-07", 3553],
	["2024-08", 3479],
	["2024-09", 3168],
	["2024-10", 2859],
	["2024-11", 2866],
	["2024-12", 2349],
	["2025-01", 2766],
	["2025-02", 6590],
	["2025-03", 3646],
	["2025-04", 3213],
	["2025-05", 3309],
	["2025-06", 2660],
	["2025-07", 3202],
	["2025-08", 39770],
	["2025-09", 5491],
	["2025-10", 22044],
	["2025-11", 14746],
	["2025-12", 6235],
	["2026-01", 4026],
	["2026-02", 2879],
	["2026-03", 2272],
	["2026-04", 2205],
	["2026-05", 2315],
	["2026-06", 1812],
	["2026-07", 2621],
	["2026-08", 2764],
	["2026-09", 1846],
	["2026-10", 1715],
];

/** Deliveries per game in each month since January 2023 (api.battlefieldstats.com/outputs/daily-games, read 31 Oct 2026; October 2026 so far). */
const SENT_BY_MONTH: Record<string, number[]> = {
	"Battlefield 6": [
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		24685, 1152, 18382, 13442, 5520, 3257, 2260, 1705, 1535, 1563, 1246, 1824, 2159, 1178, 1061,
	],
	"Battlefield 2042": [
		2273, 2112, 3083, 2998, 2392, 2373, 1797, 1769, 1333, 2119, 2313, 1658, 1635, 1737, 2049, 1818,
		1134, 1077, 1199, 1265, 921, 920, 1172, 774, 977, 2107, 1517, 1124, 1228, 890, 1133, 5058, 2343,
		1159, 158, 79, 76, 70, 50, 58, 83, 78, 58, 83, 40, 46,
	],
	"Battlefield V": [
		1276, 1314, 1524, 1634, 1233, 1500, 1594, 1422, 1122, 1227, 966, 1217, 1805, 1785, 1701, 1026,
		1078, 989, 899, 932, 836, 855, 831, 838, 910, 1560, 849, 970, 871, 689, 813, 2584, 623, 694,
		342, 203, 206, 194, 262, 327, 375, 293, 450, 214, 282, 277,
	],
	"Battlefield 1": [
		996, 719, 843, 747, 704, 708, 916, 848, 652, 735, 626, 608, 659, 597, 593, 523, 525, 483, 891,
		789, 838, 627, 562, 550, 531, 1316, 732, 712, 800, 703, 682, 3139, 809, 891, 595, 333, 360, 266,
		239, 268, 285, 179, 255, 292, 342, 315,
	],
	"Battlefield 4": [
		828, 656, 752, 748, 694, 1007, 725, 761, 596, 624, 786, 946, 1170, 764, 737, 637, 513, 509, 460,
		404, 482, 400, 258, 174, 275, 1254, 414, 334, 325, 285, 478, 3241, 447, 658, 163, 73, 100, 70,
		9, 12, 4, 5, 3, 9, 1, 11,
	],
	"Battlefield 3": [
		156, 186, 263, 142, 114, 108, 147, 104, 35, 73, 70, 58, 95, 72, 186, 46, 205, 69, 80, 72, 66,
		54, 24, 9, 33, 267, 101, 54, 44, 47, 67, 704, 75, 158, 24, 17, 14, 5, 0, 0, 0, 4, 7, 0, 0, 3,
	],
	"Battlefield Hardline": [
		28, 46, 54, 26, 24, 39, 15, 21, 7, 15, 12, 9, 24, 43, 47, 32, 14, 14, 21, 11, 22, 3, 9, 4, 18,
		50, 22, 12, 20, 19, 21, 264, 32, 58, 12, 5, 4, 1, 2, 1, 0, 2, 0, 0, 0, 0,
	],
	"Battlefield 2": [
		12, 6, 9, 6, 6, 19, 8, 6, 5, 16, 8, 1, 7, 27, 8, 1, 14, 3, 3, 6, 3, 0, 10, 0, 22, 36, 11, 7, 21,
		27, 8, 95, 10, 44, 10, 5, 9, 13, 5, 4, 5, 5, 24, 7, 3, 2,
	],
	"Battlefield Bad Company 2": [
		12, 24, 24, 22, 15, 10, 5, 8, 1, 8, 31, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	],
};

/** Deliveries in the last 30 days (api.battlefieldstats.com/outputs/counts?days=30). */
const LAST_30_DAYS: [string, string, number][] = [
	["game", "Battlefield 6", 1042],
	["game", "Battlefield 1", 303],
	["game", "Battlefield V", 262],
	["game", "Battlefield 2042", 46],
	["game", "Battlefield 4", 11],
	["game", "Battlefield 3", 3],
	["game", "Battlefield 2", 2],
	["language", "English", 1139],
	["language", "Brazilian Portuguese", 177],
	["language", "Polish", 73],
	["language", "German", 71],
	["language", "Russian", 52],
	["language", "French", 41],
	["language", "Spanish", 39],
	["language", "Japanese", 27],
	["language", "Dutch", 14],
	["language", "Italian", 10],
	["language", "Norwegian", 9],
	["language", "Chinese", 7],
	["language", "Turkish", 5],
	["language", "Swedish", 3],
	["language", "Danish", 2],
	["segment", "Overview", 817],
	["segment", "Weapons", 325],
	["segment", "Vehicles", 161],
	["segment", "Classes", 101],
	["segment", "Matches", 86],
	["segment", "Modes", 77],
	["segment", "Maps", 55],
	["segment", "Gadgets", 40],
	["segment", "Progression", 5],
	["segment", "Firestorm", 2],
];

/** The months of SENT_BY_MONTH, as dates ("2023-01"), the same months as MONTHLY. */
const MONTHS = MONTHLY.map(([at]) => at);

/** Deliveries in a month: from none to a launch month's tens of thousands, log scale. */
const MONTH_LOW = 1;
const MONTH_HIGH = 30_000;

const LOW = 100;
const HIGH = 100_000;

/** Where each game's cluster stands: round the bot's tower, the biggest at the back. */
const spot = (index: number): TVec2 => {
	const angle = Math.PI + (index / GAMES.length) * Math.PI * 2;
	return [Math.round(Math.sin(angle) * 29 * 10) / 10, Math.round(Math.cos(angle) * 23 * 10) / 10];
};

const HQ: TVec2 = [0, 0];

const ENTITIES: TEntityInput[] = [
	{
		id: "bot",
		kind: "office_tower_01",
		name: "Battlefield Stats bot",
		position: HQ,
		props: { width: 3, depth: 3, floorCount: 8 },
		colors: { facade: { color: "#3c4a63" } },
		data: {
			floorCount: {
				key: "sent_per_month",
				usesLogScale: true,
				valueAtLowSetting: 1000,
				valueAtHighSetting: 40000,
				lowSetting: 4,
				highSetting: 30,
			},
		},
		label: {
			isShown: true,
			title: "Deliveries per month",
			dataKeys: ["sent_per_month"],
			offset: [0, 1.5, 0],
		},
		details: {
			description:
				"The bot's tower: a floor for every step in deliveries per month (log scale). Play the story to watch Battlefield 6's launch in August 2025.",
			dataKeys: ["sent_per_month", "registered_users"],
		},
	},
	{
		id: "users",
		kind: "beacon_01",
		name: "Registered users",
		position: [4.5, 3.5],
		label: {
			isShown: true,
			title: "Registered users",
			dataKeys: ["registered_users"],
			offset: [0, 1, 0],
		},
		details: {
			description: "Read from api.battlefieldstats.com every minute while the world is open.",
			dataKeys: ["registered_users"],
		},
	},
	...GAMES.map((game, index) =>
		cluster({
			id: `game_${index + 1}`,
			kind: game.kind,
			name: game.name,
			position: spot(index),
			color: game.color,
			tableKey: "deliveries_by_item",
			builtShare: builtShareFor(game.sent, LOW, HIGH),
			size: logSize("row.sent", LOW, HIGH),
			scale: scaleFor(game.sent, LOW, HIGH),
			scaleFromData: logScale("row.sent", LOW, HIGH),
			cardKeys: ["row.sent"],
			tileKeys: ["row.sent", "row.category"],
			description: "Deliveries the bot has made for this game so far: stats sent to its players.",
			seed: index + 1,
		}),
	),
	...(
		[
			[-36, -29],
			[36, -29],
			[-36, 29],
			[36, 29],
			[-14, -30],
			[14, 30],
			[-11, -8],
			[11, 8],
		] as TVec2[]
	).map(
		(position, index): TEntityInput => ({
			id: `tree_${index + 1}`,
			kind: index % 2 === 0 ? "round_tree_01" : "pine_tree_01",
			position,
		}),
	),
];

export const createBattlefieldTerritoryScene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: {
			title: "Battlefield territory",
			subtitle: "Battlefield Stats, read 31 Oct 2026",
		},
		theme: "system",
		ground: { width: 80, depth: 66 },
		lighting: { sunShadeContrast: 0.7 },
		camera: { openingViewpointId: "view_all" },
		viewpoints: [
			{ id: "view_all", name: "The territory", target: [0, 1], span: 66 },
			{ id: "view_bot", name: "The bot's tower", target: [0, 0], span: 22 },
		],
		onScreen: {
			legend: [
				{ label: "Size", meaning: "deliveries per game so far, log scale" },
				{
					label: "Roads",
					meaning:
						"deliveries on their way in a month: wider and busier, more deliveries, log scale",
				},
				{ label: "Tower", meaning: "deliveries per month, log scale" },
			],
			tileKeys: ["registered_users", "sent_per_month"],
		},
		data: {
			sources: [
				{
					id: "bf_users",
					name: "Battlefield Stats: users",
					kind: "api",
					url: "https://api.battlefieldstats.com/users/count",
					refreshSeconds: 60,
					pageUrl: "https://battlefieldstats.com",
					about: "Registered users of the bot",
					lastReadAt: READ_AT,
				},
				{
					id: "bf_counts",
					name: "Battlefield Stats: deliveries by game",
					kind: "api",
					url: "https://api.battlefieldstats.com/outputs/counts",
					refreshSeconds: 3600,
					pageUrl: "https://battlefieldstats.com",
					about: "Deliveries the bot has made (outputs), all time",
					lastReadAt: READ_AT,
				},
				{
					id: "bf_last_30_days",
					name: "Battlefield Stats: deliveries in the last 30 days",
					kind: "api",
					url: "https://api.battlefieldstats.com/outputs/counts?days=30",
					refreshSeconds: 3600,
					pageUrl: "https://battlefieldstats.com",
					about:
						"Deliveries the bot has made in the last 30 days; the months before from api.battlefieldstats.com/outputs/daily-games",
					lastReadAt: READ_AT,
				},
				{
					id: "bf_monthly",
					name: "battlefieldstats-sent-monthly.csv",
					kind: "file",
					fileName: "battlefieldstats-sent-monthly.csv",
					pageUrl: "https://battlefieldstats.com",
					about: "Deliveries the bot has made per month",
					lastReadAt: READ_AT,
				},
			],
			values: [
				{
					key: "registered_users",
					name: "Registered users",
					value: 41740,
					source: { sourceId: "bf_users", path: "totalUsers" },
				},
				{
					key: "sent_per_month",
					name: "Deliveries this month",
					value: 1715,
					source: { sourceId: "bf_monthly", path: "sent" },
					history: MONTHLY.map(([at, value]) => ({ at, value })),
					threshold: { line: 2000, flagsWhen: "below", word: "Quiet" },
				},
			],
			tables: [
				{
					key: "deliveries_by_item",
					name: "Deliveries by game, language and segment",
					keyColumn: "item",
					source: { sourceId: "bf_counts", path: "" },
					columns: [
						{ key: "category", name: "Counted by", field: "category" },
						{ key: "item", name: "Item", field: "item" },
						{ key: "sent", name: "Deliveries so far", field: "sent" },
					],
					rows: [
						...GAMES.map((game) => ({ category: "game", item: game.name, sent: game.sent })),
						...OTHER_COUNTS.map(([category, item, sent]) => ({ category, item, sent })),
					],
					// Each game's deliveries by the end of each month, so the story grows the clusters.
					history: MONTHS.map((at, month) => ({
						at,
						rows: GAMES.map((game) => ({
							category: "game",
							item: game.name,
							sent: SENT_BY_MONTH[game.name]
								.slice(0, month + 1)
								.reduce((sum, sent) => sum + sent, 0),
						})),
					})),
				},
				{
					key: "deliveries_per_month",
					name: "Deliveries by game, per month",
					keyColumn: "item",
					source: { sourceId: "bf_last_30_days", path: "" },
					columns: [
						{ key: "category", name: "Counted by", field: "category" },
						{ key: "item", name: "Item", field: "item" },
						{
							key: "sent",
							name: "Deliveries in a month",
							field: "sent",
							about: "Now: the last 30 days. Months before: each calendar month",
						},
					],
					rows: [
						...LAST_30_DAYS.map(([category, item, sent]) => ({ category, item, sent })),
						// Games with no deliveries lately aren't in the API's answer: none, not unknown.
						...GAMES.filter((game) => !LAST_30_DAYS.some(([, item]) => item === game.name)).map(
							(game) => ({ category: "game", item: game.name, sent: 0 }),
						),
					],
					// Each game's deliveries in each month, so the story swells and thins the roads.
					history: MONTHS.map((at, month) => ({
						at,
						rows: GAMES.map((game) => ({
							category: "game",
							item: game.name,
							sent: SENT_BY_MONTH[game.name][month] ?? 0,
						})),
					})),
				},
			],
		},
		entities: ENTITIES,
		roads: GAMES.map((game, index) =>
			flowRoad({
				id: `road_${index + 1}`,
				name: `${game.name} → the bot`,
				from: spot(index),
				to: HQ,
				fromReach: reachOf(scaleFor(game.sent, LOW, HIGH)),
				toReach: 2,
				tableKey: "deliveries_per_month",
				rowKey: game.name,
				// Wider for more deliveries a month: from a lane's width to a broad road, on a log scale.
				width: {
					key: "row.sent",
					usesLogScale: true,
					valueAtLowSetting: MONTH_LOW,
					valueAtHighSetting: MONTH_HIGH,
					lowSetting: 0.6,
					highSetting: 3.2,
				},
				// Busier too, and empty in a month with no deliveries.
				density: {
					key: "row.sent",
					usesLogScale: true,
					valueAtLowSetting: MONTH_LOW,
					valueAtHighSetting: MONTH_HIGH,
					lowSetting: 0,
					highSetting: 3,
				},
				vehicleKind: "delivery_van_01",
			}),
		),
	});
