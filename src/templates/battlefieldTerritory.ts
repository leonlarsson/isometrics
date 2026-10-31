import {
	SCENE_VERSION,
	SceneSchema,
	type TEntityInput,
	type TScene,
	type TVec2,
} from "#/scene/schema";

import { builtShareFor, cluster, flowRoad, logSize } from "./dataWorld";

/*
 * Battlefield territory: the data study's example with the owner's own data,
 * Battlefield Stats (a Discord bot for Battlefield players).
 *
 * A cluster per Battlefield game, sized by how many messages its players have
 * sent the bot (log scale), with roads carrying them to the bot's tower in
 * the middle, as many cars as messages. The tower's floors follow messages
 * per month, with a sparkline, a change on the month before and a watch line,
 * and the story bar plays the months since 2023. A beacon shows registered
 * users, read again every minute while the world is open.
 *
 * It opens from its saved snapshot (read 30 Oct 2026, the files in
 * docs/data-study/samples) and reads the APIs again when online: they let
 * browsers read them (CORS open).
 */

const READ_AT = "2026-10-30T12:00:00Z";

/** Messages sent per game (api.battlefieldstats.com/outputs/counts, category game). */
const GAMES: { name: string; sent: number; kind: string; color: string }[] = [
	{ name: "Battlefield 6", sent: 80969, kind: "tower_cluster_01", color: "#d1a03b" },
	{ name: "Battlefield 2042", sent: 60336, kind: "tower_cluster_01", color: "#4f86c6" },
	{ name: "Battlefield V", sent: 43588, kind: "house_cluster_01", color: "#a8577e" },
	{ name: "Battlefield 1", sent: 30764, kind: "house_cluster_01", color: "#9c6b3e" },
	{ name: "Battlefield 4", sent: 23802, kind: "shed_cluster_01", color: "#2f9e8f" },
	{ name: "Battlefield 3", sent: 4058, kind: "shed_cluster_01", color: "#7d8a52" },
	{ name: "Battlefield Hardline", sent: 1083, kind: "tent_cluster_01", color: "#c8553d" },
	{ name: "Battlefield 2", sent: 557, kind: "tent_cluster_01", color: "#8a7db8" },
	{ name: "Battlefield Bad Company 2", sent: 161, kind: "tent_cluster_01", color: "#3fb07c" },
];

/** The rest of the counts (languages, segments of the bot), kept in the table as the API gives them. */
const OTHER_COUNTS: [string, string, number][] = [
	["language", "English", 175030],
	["language", "French", 11883],
	["language", "Polish", 11530],
	["language", "Brazilian Portuguese", 11384],
	["language", "German", 10030],
	["language", "Spanish", 7925],
	["segment", "Overview", 190536],
	["segment", "Weapons", 28313],
	["segment", "Vehicles", 11800],
	["segment", "Classes", 7125],
];

/** Messages sent per month (battlefieldstats-sent-monthly.csv). */
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
	["2026-10", 1692],
];

const LOW = 100;
const HIGH = 100_000;

/** Where each game's cluster stands: round the bot's tower, the biggest at the back. */
const spot = (index: number): TVec2 => {
	const angle = Math.PI + (index / GAMES.length) * Math.PI * 2;
	return [Math.round(Math.sin(angle) * 19 * 10) / 10, Math.round(Math.cos(angle) * 15 * 10) / 10];
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
			title: "Messages per month",
			dataKeys: ["sent_per_month"],
			offset: [0, 1.5, 0],
		},
		details: {
			description:
				"The bot's tower: a floor for every step in messages per month (log scale). Play the story to watch Battlefield 6's launch in August 2025.",
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
			tableKey: "messages_by_item",
			builtShare: builtShareFor(game.sent, LOW, HIGH),
			size: logSize("row.sent", LOW, HIGH),
			cardKeys: ["row.sent"],
			tileKeys: ["row.sent", "row.category"],
			description: "Messages its players have sent the bot, all time.",
			seed: index + 1,
		}),
	),
	...(
		[
			[-25, -20],
			[25, -20],
			[-26, 20],
			[26, 19],
			[0, -21],
			[0, 21],
			[-9, -6],
			[9, 6],
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
			subtitle: "Battlefield Stats, read 30 Oct 2026",
		},
		theme: "system",
		ground: { width: 58, depth: 48 },
		lighting: { sunShadeContrast: 0.7 },
		camera: { openingViewpointId: "view_all" },
		viewpoints: [
			{ id: "view_all", name: "The territory", target: [0, 1], span: 48 },
			{ id: "view_bot", name: "The bot's tower", target: [0, 0], span: 22 },
		],
		onScreen: {
			legend: [
				{ label: "Size", meaning: "messages sent to the bot per game, log scale" },
				{ label: "Roads", meaning: "the same messages, on their way: more cars, more messages" },
				{ label: "Tower", meaning: "messages per month, log scale" },
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
					name: "Battlefield Stats: messages by game",
					kind: "api",
					url: "https://api.battlefieldstats.com/outputs/counts",
					refreshSeconds: 3600,
					pageUrl: "https://battlefieldstats.com",
					about: "Messages sent to the bot, all time",
					lastReadAt: READ_AT,
				},
				{
					id: "bf_monthly",
					name: "battlefieldstats-sent-monthly.csv",
					kind: "file",
					fileName: "battlefieldstats-sent-monthly.csv",
					pageUrl: "https://battlefieldstats.com",
					about: "Messages sent to the bot per month",
					lastReadAt: READ_AT,
				},
			],
			values: [
				{
					key: "registered_users",
					name: "Registered users",
					value: 41738,
					source: { sourceId: "bf_users", path: "totalUsers" },
				},
				{
					key: "sent_per_month",
					name: "Messages sent this month",
					value: 1692,
					source: { sourceId: "bf_monthly", path: "sent" },
					history: MONTHLY.map(([at, value]) => ({ at, value })),
					threshold: { line: 2000, flagsWhen: "below", word: "Quiet" },
				},
			],
			tables: [
				{
					key: "messages_by_item",
					name: "Messages by game, language and segment",
					keyColumn: "item",
					source: { sourceId: "bf_counts", path: "" },
					columns: [
						{ key: "category", name: "Counted by", field: "category" },
						{ key: "item", name: "Item", field: "item" },
						{ key: "sent", name: "Messages sent", field: "sent" },
					],
					rows: [
						...GAMES.map((game) => ({ category: "game", item: game.name, sent: game.sent })),
						...OTHER_COUNTS.map(([category, item, sent]) => ({ category, item, sent })),
					],
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
				tableKey: "messages_by_item",
				rowKey: game.name,
				vehicles: {
					key: "row.sent",
					usesLogScale: true,
					valueAtLowSetting: LOW,
					valueAtHighSetting: HIGH,
					lowSetting: 1,
					highSetting: 9,
				},
				vehicleKind: "delivery_van_01",
			}),
		),
	});
