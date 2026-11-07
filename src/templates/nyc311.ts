import {
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TRoadInput,
	type TScene,
} from "#/scene/schema";

import { NYC_311_ROWS } from "./nyc311Data";

/*
 * NYC 311: complaint weather (ADR-0151, ADR-0152, ADR-0153).
 *
 * New York's five boroughs, each a hidden area with weather of its own, all
 * following one table read from a real spreadsheet: NYC 311 service requests
 * per borough per month, November 2025 to October 2026, from NYC Open Data
 * (a snapshot kept on this site, read as a table over time). Complaints per
 * 1,000 residents bring rain and clouds, the share about noise lightning;
 * every borough has the same weather settings and differs only in its row.
 * The twelve months are the table's past, so the story plays them. The map is
 * a sketch of the city, not to scale.
 */

/** When the snapshot was read from NYC Open Data. */
const READ_AT = "2026-11-07T18:00:00Z";
const DATASET_PAGE =
	"https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9";

/** A month's rows of the table, as the spreadsheet holds them. */
const rowsOn = (month: string) =>
	NYC_311_ROWS.filter((row) => row[0] === month).map(
		([, borough, complaints, noise, perThousand, noiseShare]) => ({
			borough,
			complaints,
			noise_complaints: noise,
			complaints_per_1000: perThousand,
			noise_share: noiseShare,
		}),
	);

const MONTHS = [...new Set(NYC_311_ROWS.map((row) => row[0]))].sort();
const LATEST = MONTHS[MONTHS.length - 1];

/** How a borough's weather follows its row: which column, and the value that gives 100%. */
const FOLLOWS = {
	cloudCover: { column: "complaints_per_1000", valueAtFull: 90 },
	rainAmount: { column: "complaints_per_1000", valueAtFull: 70 },
	lightningRate: { column: "noise_share", valueAtFull: 50 },
} as const;

/**
 * The same weather settings on every borough, following its row; set by hand
 * to what its row gives now, so a copy made with its data off still shows the
 * latest month's weather.
 */
const boroughWeatherOf = (borough: string) => {
	const now = rowsOn(LATEST).find((row) => row.borough === borough);
	const byHand = Object.fromEntries(
		Object.entries(FOLLOWS).map(([setting, { column, valueAtFull }]) => [
			setting,
			Math.min(1, Math.round(((now?.[column] ?? 0) / valueAtFull) * 100) / 100),
		]),
	);
	return {
		...byHand,
		cloudAltitude: 11,
		cloudTransparency: 0.3,
		data: Object.fromEntries(
			Object.entries(FOLLOWS).map(([setting, { column, valueAtFull }]) => [
				setting,
				{ key: `row.${column}`, valueAtFull },
			]),
		),
	};
};

type TOutline = [number, number][];

const rect = (x0: number, z0: number, x1: number, z1: number): TOutline => [
	[x0, z0],
	[x1, z0],
	[x1, z1],
	[x0, z1],
];

/** The boroughs: where each lies on the sketch (x east, z south). */
const BOROUGHS: { id: string; name: string; outline: TOutline }[] = [
	{ id: "bronx", name: "Bronx", outline: rect(-12, -50, 26, -39) },
	{ id: "manhattan", name: "Manhattan", outline: rect(-15, -34, -6, 8) },
	{ id: "queens", name: "Queens", outline: rect(-1, -33, 48, 5) },
	{ id: "brooklyn", name: "Brooklyn", outline: rect(5, 8, 48, 48) },
	{ id: "staten_island", name: "Staten Island", outline: rect(-48, 34, -16, 50) },
];

const WATERS: TAreaInput[] = [
	{
		id: "hudson",
		kind: "water_01",
		name: "Hudson River",
		points: [
			[-22, -50],
			[-15, -50],
			[-15, 9],
			[-22, 9],
		],
	},
	{
		id: "harlem_and_east_river",
		kind: "water_01",
		name: "Harlem and East Rivers",
		points: [
			[-15, -38],
			[48, -38],
			[48, -35],
			[-3, -35],
			[-3, 9],
			[-6, 9],
			[-6, -35],
			[-15, -35],
		],
	},
	{
		id: "upper_bay",
		kind: "water_01",
		name: "Upper New York Bay",
		points: [
			[-48, 9],
			[3, 9],
			[3, 50],
			[-14, 50],
			[-14, 32],
			[-48, 32],
		],
	},
	{ id: "central_park", kind: "grass_01", name: "Central Park", points: rect(-13, -26, -8, -16) },
	{ id: "prospect_park", kind: "grass_01", name: "Prospect Park", points: rect(18, 26, 26, 34) },
];

const AREAS: TAreaInput[] = [
	...WATERS,
	...BOROUGHS.map(
		(borough): TAreaInput => ({
			id: borough.id,
			kind: "hidden_area_01",
			name: borough.name,
			points: borough.outline,
			dataRow: { tableKey: "boroughs", rowKey: borough.name },
			weather: boroughWeatherOf(borough.name),
		}),
	),
];

const CARD_KEYS = ["row.complaints", "row.complaints_per_1000", "row.noise_share"];

/** A borough's landmark: it follows the borough's row and shows it on a card. */
const landmark = (
	id: string,
	kind: string,
	position: [number, number],
	borough: string,
	rotation = 0,
): TEntityInput => ({
	id,
	kind,
	name: borough,
	position,
	rotation: [0, rotation, 0],
	dataRow: { tableKey: "boroughs", rowKey: borough },
	label: { isShown: true, title: borough, dataKeys: CARD_KEYS },
	details: {
		description: `${borough}: NYC 311 service requests this month, from the Boroughs table. Its weather follows the same row: rain and clouds from complaints per 1,000 residents, lightning from the share about noise.`,
		dataKeys: [...CARD_KEYS, "row.noise_complaints"],
	},
});

const thing = (
	id: string,
	kind: string,
	position: [number, number],
	rotation = 0,
): TEntityInput => ({ id, kind, position, rotation: [0, rotation, 0] });

const cluster = (
	id: string,
	kind: "tower_cluster_01" | "house_cluster_01",
	position: [number, number],
	width: number,
	seed: number,
	builtShare = 0.7,
): TEntityInput => ({ id, kind, position, props: { width, seed, builtShare } });

const ENTITIES: TEntityInput[] = [
	// Manhattan: towers the length of the island, round its park.
	landmark("manhattan_tower", "office_tower_01", [-10.5, -4], "Manhattan"),
	cluster("mn_towers_1", "tower_cluster_01", [-10.5, -30.5], 7, 3, 0.9),
	cluster("mn_towers_2", "tower_cluster_01", [-10.5, -11.5], 7, 5, 0.9),
	cluster("mn_towers_3", "tower_cluster_01", [-10.5, 4], 7, 7, 0.95),
	// The Bronx: its stadium, homes round it.
	landmark("bronx_stadium", "grandstand_01", [6, -44.5], "Bronx"),
	cluster("bx_homes_1", "tower_cluster_01", [-6, -44.5], 10, 11, 0.75),
	cluster("bx_homes_2", "house_cluster_01", [19, -44.5], 10, 13, 0.85),
	// Queens: homes, flats and a warehouse district.
	landmark("queens_flats", "apartment_block_01", [20, -12], "Queens"),
	cluster("qn_homes_1", "house_cluster_01", [7, -26], 12, 17, 0.85),
	cluster("qn_homes_2", "house_cluster_01", [22, -26], 12, 19, 0.85),
	cluster("qn_homes_3", "house_cluster_01", [38, -26], 12, 23, 0.85),
	cluster("qn_homes_4", "house_cluster_01", [38, -11], 12, 25, 0.85),
	cluster("qn_homes_5", "house_cluster_01", [38, 0], 9, 27, 0.85),
	thing("qn_warehouse", "warehouse_01", [7, -8]),
	// Brooklyn: its borough hall, brownstones, flats and a park.
	landmark("brooklyn_hall", "city_hall_01", [12, 16], "Brooklyn"),
	cluster("bk_towers", "tower_cluster_01", [26, 17], 6, 41, 0.6),
	cluster("bk_homes_1", "house_cluster_01", [38, 17], 12, 29, 0.85),
	cluster("bk_homes_2", "house_cluster_01", [12, 29], 10, 31, 0.85),
	cluster("bk_homes_3", "house_cluster_01", [38, 31], 12, 37, 0.85),
	cluster("bk_homes_4", "house_cluster_01", [12, 42], 10, 39, 0.85),
	cluster("bk_homes_5", "house_cluster_01", [27, 42], 10, 43, 0.85),
	cluster("bk_homes_6", "house_cluster_01", [42, 44], 8, 45, 0.85),
	// Staten Island: houses and the ferry's dock.
	landmark("staten_island_school", "school_01", [-31, 42], "Staten Island"),
	cluster("si_homes_1", "house_cluster_01", [-42, 42], 9, 47, 0.8),
	cluster("si_homes_2", "house_cluster_01", [-21, 44], 7, 49, 0.8),
	// The Staten Island Ferry, across the bay to Manhattan's tip.
	{
		id: "staten_island_ferry",
		kind: "ferry_01",
		follow: { roadId: "ferry_route", speed: 1.5, startDistance: 0 },
	},
];

const ROADS: TRoadInput[] = [
	{
		id: "ferry_route",
		kind: "hidden_route_01",
		name: "Staten Island Ferry",
		points: [
			[-17, 33],
			[-9, 24],
			[-9, 12],
		],
	},
];

/** All five boroughs' requests in a month, added up. */
const totalOn = (month: string) => rowsOn(month).reduce((sum, row) => sum + row.complaints, 0);

export const createNyc311Scene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: {
			title: "NYC 311: complaint weather",
			subtitle: "Real 311 requests per borough, Nov 2025 to Oct 2026",
		},
		ground: { width: 100, depth: 100 },
		weather: { cloudCover: 0.1 },
		camera: { openingViewpointId: "view_city" },
		viewpoints: [
			{ id: "view_city", name: "The five boroughs", target: [0, 0], span: 104 },
			{
				id: "view_bronx",
				name: "The Bronx",
				description:
					"The most complaints per resident, and in winter the most about noise: drag the time slider to December 2025.",
				target: [7, -44],
				span: 44,
			},
			{
				id: "view_manhattan_brooklyn",
				name: "Manhattan and Brooklyn",
				description: "Either side of the East River, the ferry to Staten Island crossing the bay.",
				target: [2, 0],
				span: 60,
			},
		],
		onScreen: {
			legend: [
				{ label: "Rain and clouds", meaning: "311 complaints per 1,000 residents: more, wetter" },
				{ label: "Lightning", meaning: "Share about noise: higher, more often" },
			],
			tileKeys: ["nyc_311_total"],
		},
		data: {
			enabled: true,
			sources: [
				{
					id: "nyc_311_file",
					name: "nyc-311-boroughs.csv",
					kind: "file",
					fileName: "nyc-311-boroughs.csv",
					exampleFileUrl: "/examples/nyc-311-boroughs.csv",
					about:
						"NYC 311 service requests per borough per month, counted from NYC Open Data's 311 Service Requests from 2010 to Present on 7 Nov 2026 (all requests, and those whose type starts with Noise; per 1,000 residents from the 2020 census): a spreadsheet kept on this site, read as a table over time, to download from this source's page",
					pageUrl: DATASET_PAGE,
					lastReadAt: READ_AT,
				},
			],
			values: [
				{
					key: "nyc_311_total",
					name: "311 requests this month, all boroughs",
					value: totalOn(LATEST),
					about: "Worked out: the five boroughs' requests in the month, added up",
					history: MONTHS.map((at) => ({ at, value: totalOn(at) })),
				},
			],
			tables: [
				{
					key: "boroughs",
					name: "Boroughs",
					keyColumn: "borough",
					source: { sourceId: "nyc_311_file" },
					columns: [
						{ key: "borough", name: "Borough" },
						{ key: "complaints", name: "311 requests" },
						{ key: "noise_complaints", name: "About noise" },
						{
							key: "complaints_per_1000",
							name: "Per 1,000 residents",
							about: "Worked out: requests ÷ the borough's 2020 census population × 1,000",
						},
						{
							key: "noise_share",
							name: "Share about noise",
							unit: "%",
							about: "Worked out: requests about noise ÷ all requests",
						},
					],
					rows: rowsOn(LATEST),
					// Every month, from the spreadsheet: a table over time (ADR-0153).
					history: MONTHS.map((at) => ({ at, rows: rowsOn(at) })),
				},
			],
		},
		entities: ENTITIES,
		roads: ROADS,
		areas: AREAS,
	});
