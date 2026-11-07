import {
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TRoadInput,
	type TScene,
} from "#/scene/schema";

/*
 * Sentiment City: a data map of weather (ADR-0151, ADR-0152).
 *
 * Four districts, each a hidden area over its streets with weather of its own,
 * all following one table, a row per district: complaints bring rain and
 * clouds, anger lightning, uncertainty fog. Every district has the same
 * weather settings and differs only in the row it follows, so a new district
 * is a new row and an area. A landmark in each follows the same row and shows
 * it on a card. The table has six months of example past, so the story plays
 * the Market souring and the Harbour fogging over. Example numbers, kept in a
 * spreadsheet on this site.
 */

/** The months the example past covers, oldest first; the last is now. */
const MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

interface IDistrict {
	id: string;
	name: string;
	/** Its outline, a square between the streets. */
	from: [number, number];
	to: [number, number];
	/** Each month's sentiment (0–100), complaints, anger and uncertainty (%), oldest first. */
	sentiment: number[];
	complaints: number[];
	anger: number[];
	uncertainty: number[];
}

const DISTRICTS: IDistrict[] = [
	{
		id: "old_town",
		name: "Old Town",
		from: [-30, -30],
		to: [-3, -3],
		sentiment: [74, 76, 75, 77, 79, 78],
		complaints: [18, 15, 16, 14, 11, 12],
		anger: [2, 1, 2, 0, 0, 0],
		uncertainty: [8, 6, 7, 5, 4, 5],
	},
	{
		id: "harbour",
		name: "Harbour",
		from: [3, -30],
		to: [30, -3],
		sentiment: [62, 58, 55, 49, 44, 41],
		complaints: [40, 48, 60, 72, 84, 90],
		anger: [4, 5, 6, 8, 9, 10],
		uncertainty: [15, 28, 40, 55, 68, 75],
	},
	{
		id: "riverside",
		name: "Riverside",
		from: [-30, 3],
		to: [-3, 30],
		sentiment: [41, 45, 49, 52, 55, 58],
		complaints: [130, 115, 98, 84, 70, 60],
		anger: [30, 24, 18, 12, 8, 5],
		uncertainty: [45, 42, 38, 35, 32, 30],
	},
	{
		id: "market",
		name: "Market",
		from: [3, 3],
		to: [30, 30],
		sentiment: [55, 48, 39, 30, 21, 14],
		complaints: [40, 62, 110, 160, 205, 240],
		anger: [5, 12, 30, 52, 70, 80],
		uncertainty: [10, 12, 14, 12, 10, 10],
	},
];

const NOW = MONTHS.length - 1;

/** A district's row in a month: what the spreadsheet holds for it. */
const rowOf = (district: IDistrict, month: number) => ({
	district: district.name,
	sentiment: district.sentiment[month],
	complaints: district.complaints[month],
	anger: district.anger[month],
	uncertainty: district.uncertainty[month],
});

const square = ([x0, z0]: [number, number], [x1, z1]: [number, number]): [number, number][] => [
	[x0, z0],
	[x1, z0],
	[x1, z1],
	[x0, z1],
];

/**
 * The same weather on every district, following its row: rain and clouds
 * from complaints, lightning from anger, fog from uncertainty.
 */
const DISTRICT_WEATHER = {
	cloudCover: 0,
	rainAmount: 0,
	lightningRate: 0,
	fogDensity: 0,
	cloudAltitude: 12,
	cloudTransparency: 0.15,
	data: {
		cloudCover: { key: "row.complaints", valueAtFull: 200 },
		rainAmount: { key: "row.complaints", valueAtFull: 220 },
		lightningRate: { key: "row.anger", valueAtFull: 100 },
		fogDensity: { key: "row.uncertainty", valueAtFull: 100 },
	},
};

const AREAS: TAreaInput[] = [
	{
		id: "harbour_water",
		kind: "water_01",
		name: "The harbour",
		points: square([17, -30], [30, -18]),
	},
	{
		id: "riverside_park",
		kind: "grass_01",
		name: "Riverside park",
		points: square([-27, 6], [-16, 16]),
	},
	{
		id: "market_square",
		kind: "plaza_01",
		name: "Market square",
		points: square([8, 8], [18, 18]),
	},
	{
		id: "old_town_green",
		kind: "grass_01",
		name: "Cathedral green",
		points: square([-27, -27], [-19, -19]),
	},
	...DISTRICTS.map(
		(district): TAreaInput => ({
			id: district.id,
			kind: "hidden_area_01",
			name: district.name,
			points: square(district.from, district.to),
			dataRow: { tableKey: "districts", rowKey: district.name },
			weather: DISTRICT_WEATHER,
		}),
	),
];

/** A district's landmark: it follows the district's row and shows it on a card. */
const landmark = (
	id: string,
	kind: string,
	position: [number, number],
	district: string,
	rotation = 0,
): TEntityInput => ({
	id,
	kind,
	name: district,
	position,
	rotation: [0, rotation, 0],
	dataRow: { tableKey: "districts", rowKey: district },
	label: {
		isShown: true,
		title: district,
		dataKeys: ["row.sentiment", "row.complaints", "row.anger", "row.uncertainty"],
	},
	details: {
		description: `${district}: how its people feel, from the Districts table. Its weather follows the same row.`,
		dataKeys: ["row.sentiment", "row.complaints", "row.anger", "row.uncertainty"],
	},
});

const thing = (
	id: string,
	kind: string,
	position: [number, number],
	rotation = 0,
): TEntityInput => ({
	id,
	kind,
	position,
	rotation: [0, rotation, 0],
});

const ENTITIES: TEntityInput[] = [
	// Old Town: the hall, a cathedral on its green, houses.
	landmark("old_town_hall", "city_hall_01", [-14, -14], "Old Town"),
	thing("ot_church", "church_01", [-23, -23]),
	thing("ot_house_1", "house_01", [-26, -9]),
	thing("ot_house_2", "house_01", [-20, -7], 90),
	thing("ot_house_3", "house_01", [-8, -26]),
	thing("ot_house_4", "house_01", [-7, -20], 90),
	thing("ot_tree_1", "round_tree_01", [-7, -8]),
	thing("ot_tree_2", "round_tree_02", [-25, -15]),
	// Harbour: the warehouse, a depot, the lighthouse by the water.
	landmark("harbour_warehouse", "warehouse_01", [9, -14], "Harbour"),
	thing("hb_depot", "depot_01", [9, -25]),
	thing("hb_lighthouse", "lighthouse_01", [26, -8]),
	thing("hb_shed", "warehouse_01", [21, -11]),
	// Riverside: the school by the park, houses, trees.
	landmark("riverside_school", "school_01", [-11, 21], "Riverside"),
	thing("rs_house_1", "house_01", [-25, 25]),
	thing("rs_house_2", "house_01", [-19, 26]),
	thing("rs_tree_1", "round_tree_01", [-24, 9]),
	thing("rs_tree_2", "round_tree_02", [-19, 13]),
	thing("rs_tree_3", "birch_01", [-23, 14]),
	thing("rs_tree_4", "birch_01", [-7, 8]),
	// Market: shops round the square, flats behind.
	landmark("market_shop", "shop_01", [13, 22], "Market"),
	thing("mk_cafe", "cafe_01", [23, 9]),
	thing("mk_shop_2", "shop_02", [6, 23]),
	thing("mk_apartments", "apartment_block_01", [24, 24]),
	thing("mk_apartments_2", "apartment_block_01", [24, 15], 90),
];

/** Four streets meeting in the middle, joined at a junction. */
const STREETS: Record<string, [number, number][]> = {
	east: [
		[0, 0],
		[32, 0],
	],
	west: [
		[0, 0],
		[-32, 0],
	],
	north: [
		[0, 0],
		[0, -32],
	],
	south: [
		[0, 0],
		[0, 32],
	],
};

const ROADS: TRoadInput[] = Object.entries(STREETS).map(([id, points]) => ({
	id,
	kind: "road_01",
	name: `${id.charAt(0).toUpperCase()}${id.slice(1)} Street`,
	points,
}));

/** The city's sentiment now: the districts' average. */
const citySentiment = Math.round(
	DISTRICTS.reduce((sum, district) => sum + district.sentiment[NOW], 0) / DISTRICTS.length,
);

export const createSentimentCityScene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: {
			title: "Sentiment City",
			subtitle: "Complaints bring rain, anger lightning, uncertainty fog",
		},
		ground: { width: 68, depth: 68 },
		weather: { cloudCover: 0.1 },
		camera: { openingViewpointId: "view_city" },
		viewpoints: [
			{ id: "view_city", name: "The city", target: [0, 0], span: 72 },
			{
				id: "view_market",
				name: "The Market's storm",
				description: "Complaints and anger at their highest: rain, low clouds, lightning.",
				target: [16, 16],
				span: 34,
			},
			{
				id: "view_harbour",
				name: "Fog over the Harbour",
				description: "Uncertainty rising: fog lies over the water and the quays.",
				target: [16, -16],
				span: 34,
			},
		],
		onScreen: {
			legend: [
				{ label: "Rain and clouds", meaning: "Complaints: more, wetter" },
				{ label: "Lightning", meaning: "Anger: more, more often" },
				{ label: "Fog", meaning: "Uncertainty: more, thicker" },
			],
			tileKeys: ["city_sentiment"],
		},
		data: {
			enabled: true,
			sources: [
				{
					id: "districts_file",
					name: "sentiment-city-districts.csv",
					kind: "file",
					fileName: "sentiment-city-districts.csv",
					exampleFileUrl: "/examples/sentiment-city-districts.csv",
					about:
						"Example numbers: a spreadsheet kept on this site, a row per district, to download from this source's page, change and read again",
					lastReadAt: "2026-10-31T12:00:00Z",
				},
			],
			values: [
				{
					key: "city_sentiment",
					name: "City sentiment",
					value: citySentiment,
					unit: "/100",
					about: "Typed: the districts' sentiment now, averaged",
				},
			],
			tables: [
				{
					key: "districts",
					name: "Districts",
					keyColumn: "district",
					source: { sourceId: "districts_file" },
					columns: [
						{ key: "district", name: "District" },
						{ key: "sentiment", name: "Sentiment", unit: "/100" },
						{ key: "complaints", name: "Complaints" },
						{ key: "anger", name: "Anger", unit: "%" },
						{ key: "uncertainty", name: "Uncertainty", unit: "%" },
					],
					rows: DISTRICTS.map((district) => rowOf(district, NOW)),
					// Example months before now, so the story plays each district's weather changing.
					history: MONTHS.map((at, month) => ({
						at,
						rows: DISTRICTS.map((district) => rowOf(district, month)),
					})),
				},
			],
		},
		entities: ENTITIES,
		roads: ROADS,
		junctions: [
			{
				id: "centre",
				ends: Object.keys(STREETS).map((roadId) => ({ roadId, end: "start" })),
			},
		],
		areas: AREAS,
	});
