import {
	SCENE_VERSION,
	SceneSchema,
	type TEntityInput,
	type TRoadInput,
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
 * Extraction shooter territory: the data study's concept picture as a world.
 *
 * A cluster per game, sized by its players on Steam right now (log scale),
 * with a card of the count; roads between games for the audience they share;
 * a detail sheet with stat tiles, where the numbers come from and when they
 * were read. Hunt: Showdown 1896 is "home". Two placeholder titles have no
 * data and show it, greyed.
 *
 * The data is a saved snapshot, not live: Steam's current-players API
 * (ISteamUserStats/GetNumberOfCurrentPlayers) sends no CORS header, so a
 * browser can't read it (docs/data-study: a read-through route on the server
 * would). Steam gives only the count now; the 30-day averages and peaks, the
 * months before and the shared audience are example numbers, and say so.
 */

/** When the current players were read from Steam. */
const READ_AT = "2026-10-31T12:00:00Z";

/** The months the example past covers, oldest first; the last is now. */
const MONTHS = [
	"2025-11",
	"2025-12",
	"2026-01",
	"2026-02",
	"2026-03",
	"2026-04",
	"2026-05",
	"2026-06",
	"2026-07",
	"2026-08",
	"2026-09",
	"2026-10",
];

interface IGame {
	id: string;
	name: string;
	appid: number;
	/** Players on Steam now, read on READ_AT. */
	players: number | null;
	kind: string;
	position: TVec2;
	color: string;
	/** Example past: each month's players as a share of now (null = not out yet). */
	past: (number | null)[];
	/** Example 30-day average and peak as shares of now, and an all-time peak. */
	average: number;
	peak: number;
	allTimePeak: number;
	seed: number;
	tag?: string;
}

const GAMES: IGame[] = [
	{
		id: "tarkov",
		name: "Escape from Tarkov",
		appid: 3932890,
		players: 18036,
		kind: "shed_cluster_01",
		position: [0, 0],
		color: "#8a9a5b",
		past: [null, null, null, null, null, null, null, null, null, 0.8, 1.15, 1],
		average: 1.08,
		peak: 1.9,
		allTimePeak: 41260,
		seed: 3,
	},
	{
		id: "hunt",
		name: "Hunt: Showdown 1896",
		appid: 594650,
		players: 10516,
		kind: "house_cluster_01",
		position: [-21.2, -10],
		color: "#a8577e",
		past: [1.35, 1.3, 1.25, 1.4, 1.2, 1.1, 1.05, 1.15, 1.2, 1.1, 1.05, 1],
		average: 1.12,
		peak: 2.2,
		allTimePeak: 59968,
		seed: 2,
		tag: "home",
	},
	{
		id: "arena",
		name: "Arena Breakout: Infinite",
		appid: 2073620,
		players: 19872,
		kind: "shed_cluster_01",
		position: [21.2, -12.5],
		color: "#4f86c6",
		past: [1.2, 1.25, 1.1, 1.05, 1, 0.95, 1.05, 1.1, 1, 0.9, 0.95, 1],
		average: 1.05,
		peak: 1.8,
		allTimePeak: 78515,
		seed: 5,
	},
	{
		id: "delta",
		name: "Delta Force",
		appid: 2507950,
		players: 36478,
		kind: "tower_cluster_01",
		position: [23.8, 11.2],
		color: "#d1a03b",
		past: [1.9, 1.7, 1.5, 1.4, 1.3, 1.2, 1.25, 1.1, 1.05, 1.0, 1.05, 1],
		average: 1.06,
		peak: 1.75,
		allTimePeak: 205412,
		seed: 4,
	},
	{
		id: "arc",
		name: "ARC Raiders",
		appid: 1808500,
		players: 67032,
		kind: "tower_cluster_01",
		position: [-6.2, 18.8],
		color: "#2f9e8f",
		past: [5.2, 4.6, 3.4, 2.6, 2.0, 1.7, 1.5, 1.3, 1.2, 1.1, 1.05, 1],
		average: 1.1,
		peak: 1.7,
		allTimePeak: 481966,
		seed: 7,
	},
	{
		id: "grayzone",
		name: "Gray Zone Warfare",
		appid: 2479810,
		players: 12620,
		kind: "tent_cluster_01",
		position: [-2.5, -20],
		color: "#9c8b6e",
		past: [0.9, 0.85, 0.8, 0.95, 1.1, 1.0, 0.9, 0.85, 1.2, 1.1, 1.0, 1],
		average: 1.02,
		peak: 1.6,
		allTimePeak: 66452,
		seed: 6,
	},
	{
		id: "finals",
		name: "THE FINALS",
		appid: 2073850,
		players: 19712,
		kind: "tower_cluster_01",
		position: [-26.2, 15],
		color: "#c8553d",
		past: [0.8, 0.9, 1.1, 1.0, 0.95, 1.2, 1.1, 1.0, 0.9, 0.95, 1.1, 1],
		average: 1.04,
		peak: 1.85,
		allTimePeak: 242619,
		seed: 8,
	},
	{
		id: "bf6",
		name: "Battlefield 6",
		appid: 2807960,
		players: 31670,
		kind: "house_cluster_01",
		position: [15, 26.2],
		color: "#5b6fa8",
		past: [6.5, 4.8, 3.6, 2.9, 2.3, 1.9, 1.6, 1.4, 1.3, 1.15, 1.05, 1],
		average: 1.12,
		peak: 1.95,
		allTimePeak: 747440,
		seed: 9,
	},
	{
		id: "marathon",
		name: "Marathon",
		appid: 3065800,
		players: 2828,
		kind: "tent_cluster_01",
		position: [-33.8, -2.5],
		color: "#3fb07c",
		past: [null, null, null, null, null, null, null, null, null, 3.1, 1.6, 1],
		average: 1.3,
		peak: 2.6,
		allTimePeak: 24611,
		seed: 10,
	},
];

/** Titles in the picture with no numbers: shown with no data, greyed. */
const PLACEHOLDERS = [
	{
		id: "upcoming",
		name: "Upcoming title (placeholder)",
		position: [33.8, -5] as TVec2,
		seed: 11,
	},
	{
		id: "offsteam",
		name: "Placeholder: off-Steam title",
		position: [-33.8, -23.8] as TVec2,
		seed: 12,
	},
];

/** Audience overlap between games: example numbers, not from Steam. */
const OVERLAP: { from: string; to: string; shared: number }[] = [
	{ from: "hunt", to: "tarkov", shared: 4200 },
	{ from: "tarkov", to: "arena", shared: 6100 },
	{ from: "tarkov", to: "delta", shared: 3800 },
	{ from: "arc", to: "tarkov", shared: 5200 },
	{ from: "arc", to: "marathon", shared: 900 },
	{ from: "delta", to: "arena", shared: 2900 },
	{ from: "grayzone", to: "tarkov", shared: 2400 },
	{ from: "finals", to: "arc", shared: 2100 },
	{ from: "bf6", to: "delta", shared: 3300 },
	{ from: "bf6", to: "arc", shared: 2600 },
];

/** The players size from a sliver at 1,000 to full at 100,000 (a log scale). */
const LOW = 1000;
const HIGH = 100_000;

const EXAMPLE = "Example numbers, not from Steam";

const round = (value: number) => Math.round(value / 10) * 10;

/** A game's row: its count now from Steam, the rest example numbers. */
const rowOf = (game: IGame) => ({
	game: game.name,
	appid: game.appid,
	players: game.players,
	average_30_days: game.players === null ? null : round(game.players * game.average),
	peak_30_days: game.players === null ? null : round(game.players * game.peak),
	all_time_peak: game.allTimePeak,
});

const byId = new Map(GAMES.map((game) => [game.id, game]));

const ENTITIES: TEntityInput[] = [
	...GAMES.map((game) =>
		cluster({
			id: game.id,
			kind: game.kind,
			name: game.name,
			position: game.position,
			color: game.color,
			tableKey: "games",
			builtShare: builtShareFor(game.players ?? 0, LOW, HIGH),
			size: logSize("row.players", LOW, HIGH),
			scale: scaleFor(game.players ?? 0, LOW, HIGH),
			scaleFromData: logScale("row.players", LOW, HIGH),
			cardKeys: ["row.players"],
			tileKeys: ["row.players", "row.average_30_days", "row.peak_30_days", "row.all_time_peak"],
			description:
				"Players now were read from Steam's API on 31 Oct 2026. Steam gives no averages, peaks or past months: those are example numbers, and say so.",
			tag: game.tag,
			seed: game.seed,
		}),
	),
	...PLACEHOLDERS.map((placeholder) =>
		cluster({
			id: placeholder.id,
			kind: "tent_cluster_01",
			name: placeholder.name,
			position: placeholder.position,
			color: "#8c8c8c",
			tableKey: "games",
			builtShare: 0.12,
			cardKeys: ["row.players"],
			tileKeys: ["row.players"],
			description: "A title in the picture with no numbers yet: it shows no data.",
			seed: placeholder.seed,
		}),
	),
	// Pines round the edges, the diorama's wilds.
	...(
		[
			[-37.5, 25],
			[-15, 27.5],
			[2.5, 30],
			[35, 22.5],
			[37.5, 5],
			[30, -27.5],
			[10, -27.5],
			[-17.5, -27.5],
			[-37.5, 10],
			[12.5, -2.5],
			[-12.5, 5],
			[-13.8, -15],
		] as TVec2[]
	).map(
		(position, index): TEntityInput => ({
			id: `pine_${index + 1}`,
			kind: index % 3 === 0 ? "pine_tree_02" : "pine_tree_01",
			position,
			scale: 0.8 + (index % 4) * 0.1,
		}),
	),
];

const ROADS: TRoadInput[] = OVERLAP.map(({ from, to }) => {
	const a = byId.get(from);
	const b = byId.get(to);
	if (!a || !b) {
		throw new Error(`No game ${from} or ${to}`);
	}
	return flowRoad({
		id: `overlap_${from}_${to}`,
		name: `${a.name} ↔ ${b.name}`,
		from: a.position,
		to: b.position,
		fromReach: reachOf(scaleFor(a.players ?? 0, LOW, HIGH)),
		toReach: reachOf(scaleFor(b.players ?? 0, LOW, HIGH)),
		tableKey: "overlap",
		rowKey: `${a.name} ↔ ${b.name}`,
		vehicles: {
			key: "row.shared_players",
			valueAtLowSetting: 0,
			valueAtHighSetting: 6000,
			lowSetting: 1,
			highSetting: 8,
		},
	});
});

export const createExtractionShootersScene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: {
			title: "Extraction shooter territory",
			subtitle: "Steam snapshot, read 31 Oct 2026",
		},
		theme: "dark",
		ground: { width: 84, depth: 66 },
		moods: [
			{
				id: "mood_evening",
				name: "Evening, windows lit",
				lighting: { time: 20.5, timeSource: "fixed" },
			},
		],
		camera: { openingViewpointId: "view_all" },
		viewpoints: [
			{ id: "view_all", name: "The territory", target: [0, 2], span: 64 },
			{
				id: "view_home",
				name: "Home: Hunt",
				description: "Hunt: Showdown 1896 and its neighbours.",
				target: [-13, -5],
				span: 36,
			},
			{
				id: "view_evening",
				name: "The territory by night",
				description: "The same, its windows and camps lit.",
				target: [0, 2],
				span: 76,
				moodId: "mood_evening",
			},
		],
		onScreen: {
			legend: [
				{ label: "Size", meaning: "Steam players now, log scale" },
				{ label: "Roads", meaning: "audience overlap (example numbers): more cars, more shared" },
			],
			tileKeys: ["steam_players_total"],
		},
		data: {
			sources: [
				{
					id: "steam",
					name: "Steam Web API",
					kind: "api",
					about: "Steam players now, read by hand",
					pageUrl: "https://store.steampowered.com/charts/mostplayed",
					lastReadAt: READ_AT,
				},
				{
					id: "examples",
					name: "Example numbers",
					kind: "file",
					fileName: "made up for this example",
					about: EXAMPLE,
					lastReadAt: READ_AT,
				},
			],
			values: [
				{
					key: "steam_players_total",
					name: "Players now in these games, on Steam",
					value: GAMES.reduce((sum, game) => sum + (game.players ?? 0), 0),
					source: { sourceId: "steam" },
				},
			],
			tables: [
				{
					key: "games",
					name: "Games",
					keyColumn: "game",
					source: { sourceId: "steam" },
					columns: [
						{ key: "game", name: "Game" },
						{ key: "appid", name: "Steam app" },
						{
							key: "players",
							name: "Steam players now",
							about: "Now: Steam, 31 Oct 2026. Months before: example numbers",
						},
						{ key: "average_30_days", name: "30-day average", about: EXAMPLE },
						{ key: "peak_30_days", name: "30-day peak", about: EXAMPLE },
						{ key: "all_time_peak", name: "All-time peak", about: EXAMPLE },
					],
					rows: [
						...GAMES.map(rowOf),
						...PLACEHOLDERS.map((placeholder) => ({ game: placeholder.name, players: null })),
					],
					// Example months before now, so cards show a trend and the story plays.
					history: MONTHS.map((at, month) => ({
						at,
						rows: GAMES.flatMap((game) => {
							const share = game.past[month];
							return share === null || share === undefined || game.players === null
								? []
								: [
										{
											game: game.name,
											// Now is Steam's own count; the months before are examples.
											players:
												month === MONTHS.length - 1 ? game.players : round(game.players * share),
										},
									];
						}),
					})),
				},
				{
					key: "overlap",
					name: "Audience overlap",
					keyColumn: "pair",
					source: { sourceId: "examples" },
					columns: [
						{ key: "pair", name: "Games" },
						{ key: "from", name: "From" },
						{ key: "to", name: "To" },
						{ key: "shared_players", name: "Shared players", about: EXAMPLE },
					],
					rows: OVERLAP.map(({ from, to, shared }) => {
						const a = byId.get(from)?.name ?? from;
						const b = byId.get(to)?.name ?? to;
						return { pair: `${a} ↔ ${b}`, from: a, to: b, shared_players: shared };
					}),
				},
			],
		},
		entities: ENTITIES,
		roads: ROADS,
	});
