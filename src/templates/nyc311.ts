import { isInsidePolygon } from "#/scene/areas";
import {
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TFenceInput,
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
 * 1,000 residents bring rain and clouds, the share about noise lightning,
 * heating complaints per 1,000 snow; every borough has the same weather
 * settings and differs only in its row. The twelve months are the table's
 * past, so the story plays them: the Bronx snows in January.
 *
 * The city is a sketch, not to scale: Manhattan's skyline between the rivers,
 * Central Park, brownstone Brooklyn, the Bronx's stadium, the harbour with
 * its ferry and ships, four bridges with their traffic, and a dusk to light
 * the towers' windows.
 */

/** When the snapshot was read from NYC Open Data. */
const READ_AT = "2026-11-07T18:00:00Z";
const DATASET_PAGE =
	"https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9";

/** A month's rows of the table, as the spreadsheet holds them. */
const rowsOn = (month: string) =>
	NYC_311_ROWS.filter((row) => row[0] === month).map(
		([, borough, complaints, noise, heat, perThousand, noiseShare, heatPerThousand]) => ({
			borough,
			complaints,
			noise_complaints: noise,
			heat_complaints: heat,
			complaints_per_1000: perThousand,
			noise_share: noiseShare,
			heat_per_1000: heatPerThousand,
		}),
	);

const MONTHS = [...new Set(NYC_311_ROWS.map((row) => row[0]))].sort();
const LATEST = MONTHS[MONTHS.length - 1];

/** How a borough's weather follows its row: which column, and the value that gives 100%. */
const FOLLOWS = {
	cloudCover: { column: "complaints_per_1000", valueAtFull: 90 },
	rainAmount: { column: "complaints_per_1000", valueAtFull: 70 },
	lightningRate: { column: "noise_share", valueAtFull: 50 },
	snowAmount: { column: "heat_per_1000", valueAtFull: 20 },
} as const;

/**
 * The same weather settings on every borough, following its row; set by hand
 * to what its row gives now, so a copy made with its data off still shows the
 * latest month's weather. Its clouds hang low, so Manhattan's towers rise
 * through them.
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

/** The land of each borough on the sketch (x east, z south): its hidden area's outline. */
const MANHATTAN: TOutline = [
	[-16.249, -44.853],
	[-9.013, -44.832],
	[-8.108, -42.571],
	[-5.161, -31.195],
	[-4.197, -13.744],
	[-5.246, 3.938],
	[-9.175, 10.831],
	[-10.961, 10.795],
	[-14.91, 5.825],
	[-16.866, -14.633],
	[-16.838, -31.877],
];
const BRONX: TOutline = [
	[-15.48, -54.847],
	[55, -55],
	[55, -42],
	[20, -41],
	[-4, -45],
	[-15.941, -45.268],
];
const QUEENS: TOutline = [
	[1, -33],
	[55, -35],
	[55, 4],
	[30, 7],
	[15, 8],
	[4, 7],
	[1, -5],
];
const BROOKLYN: TOutline = [
	[4, 8],
	[15, 9],
	[30, 8],
	[55, 5],
	[55, 44],
	[32, 48],
	[16, 50],
	[7, 45],
	[4, 32],
	[3, 20],
	[3, 12],
];
const STATEN_ISLAND: TOutline = [
	[-55, 36],
	[-32, 33],
	[-16, 42],
	[-15, 55],
	[-55, 55],
];

const BOROUGHS: { id: string; name: string; outline: TOutline }[] = [
	{ id: "bronx", name: "Bronx", outline: BRONX },
	{ id: "manhattan", name: "Manhattan", outline: MANHATTAN },
	{ id: "queens", name: "Queens", outline: QUEENS },
	{ id: "brooklyn", name: "Brooklyn", outline: BROOKLYN },
	{ id: "staten_island", name: "Staten Island", outline: STATEN_ISLAND },
];

const rect = (x0: number, z0: number, x1: number, z1: number): TOutline => [
	[x0, z0],
	[x1, z0],
	[x1, z1],
	[x0, z1],
];

const CENTRAL_PARK: TOutline = [
	[-13, -30],
	[-8, -30],
	[-7.5, -20],
	[-13, -20],
];
const PROSPECT_PARK = rect(16, 24, 25, 33);

/** The rivers, the harbour and the islands in it, the parks: drawn under the boroughs. */
const LAND_AND_WATER: TAreaInput[] = [
	{
		id: "hudson",
		kind: "water_01",
		name: "Hudson River",
		points: [
			[-25, -55],
			[-16, -55],
			[-17, -32],
			[-17, -14],
			[-15, 6],
			[-11, 11],
			[-25, 11],
		],
	},
	{
		id: "east_river",
		kind: "water_01",
		name: "East River and Harlem River",
		points: [
			[-9, -45],
			[-3, -44],
			[20, -40],
			[55, -40],
			[55, -36],
			[0, -34],
			[0, -5],
			[3, 6],
			[1, 11],
			[-9, 11],
			[-5, 4],
			[-4, -14],
			[-5, -32],
			[-8, -43],
		],
	},
	{
		id: "harbour",
		kind: "water_01",
		name: "Upper New York Bay and the Narrows",
		points: [
			[-30, 11],
			[1, 11],
			[2, 20],
			[3, 32],
			[5, 45],
			[8, 55],
			[-14, 55],
			[-14, 40],
			[-30, 32],
		],
	},
	{
		id: "kill_van_kull",
		kind: "water_01",
		name: "Kill Van Kull",
		points: [
			[-55, 32],
			[-30, 30],
			[-30, 33],
			[-55, 35],
		],
	},
	{ id: "central_park", kind: "grass_01", name: "Central Park", points: CENTRAL_PARK },
	{ id: "prospect_park", kind: "grass_01", name: "Prospect Park", points: PROSPECT_PARK },
];

const AREAS: TAreaInput[] = [
	...LAND_AND_WATER,
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

const CARD_KEYS = ["row.complaints_per_1000", "row.noise_share", "row.heat_per_1000"];

/** A borough's landmark: it follows the borough's row and shows it on a card. */
const landmark = (
	id: string,
	kind: string,
	position: [number, number],
	borough: string,
	props: Record<string, unknown> = {},
	rotation = 0,
): TEntityInput => ({
	id,
	kind,
	name: borough,
	position,
	rotation: [0, rotation, 0],
	props,
	dataRow: { tableKey: "boroughs", rowKey: borough },
	label: { isShown: true, title: borough, dataKeys: CARD_KEYS },
	details: {
		description: `${borough}: NYC 311 service requests in the month, from the Boroughs table. Its weather follows the same row: rain and clouds from complaints per 1,000 residents, lightning from the share about noise, snow from heating complaints per 1,000.`,
		dataKeys: ["row.complaints", "row.noise_complaints", "row.heat_complaints", ...CARD_KEYS],
	},
});

const thing = (
	id: string,
	kind: string,
	position: [number, number],
	props: Record<string, unknown> = {},
	rotation = 0,
): TEntityInput => ({ id, kind, position, props, rotation: [0, rotation, 0] });

const cluster = (
	id: string,
	kind: "tower_cluster_01" | "house_cluster_01",
	position: [number, number],
	width: number,
	seed: number,
	builtShare = 0.85,
): TEntityInput => ({ id, kind, position, props: { width, seed, builtShare } });

/** The skyline's facades, glass and stone, so the towers aren't all one colour. */
const FACADES = ["#5b7a99", "#8a9aa8", "#3d5a73", "#b8b0a2", "#6f8f8a", "#4a4f63", "#9fb3c8"];

/** A skyscraper: an office tower this many floors tall, in one of the skyline's facades. */
const tower = (
	id: string,
	position: [number, number],
	floorCount: number,
	width = 3,
	facade = FACADES[(id.length + floorCount) % FACADES.length],
): TEntityInput => ({
	...thing(id, "office_tower_01", position, { floorCount, width, depth: width }),
	colors: { facade: { color: facade } },
});

type TBox = [number, number, number, number];

/**
 * Brooklyn's brownstones: rows of terraced houses on a grid, each placed only
 * where it lies in Brooklyn, off its park and clear of what's there already.
 */
const brownstones = (keepClear: TBox[]): TEntityInput[] => {
	const rowLength = 6 * 1.1 + 0.2;
	const rowDepth = 2;
	const fits = (x: number, z: number) => {
		const box: TBox = [
			x - rowLength / 2 - 0.4,
			z - rowDepth / 2 - 0.4,
			x + rowLength / 2 + 0.4,
			z + rowDepth / 2 + 0.4,
		];
		const corners = [
			[box[0], box[1]],
			[box[2], box[1]],
			[box[2], box[3]],
			[box[0], box[3]],
		];
		return (
			corners.every((corner) => isInsidePolygon(corner, BROOKLYN)) &&
			corners.every((corner) => !isInsidePolygon(corner, PROSPECT_PARK)) &&
			keepClear.every(
				([x0, z0, x1, z1]) => box[2] < x0 || box[0] > x1 || box[3] < z0 || box[1] > z1,
			)
		);
	};
	const rows: TEntityInput[] = [];
	for (let z = 14; z <= 46; z += 4.5) {
		for (let x = 10; x <= 52; x += 9) {
			if (fits(x, z)) {
				rows.push(
					thing(
						`bk_row_${rows.length + 1}`,
						rows.length % 3 === 2 ? "terraced_row_02" : "terraced_row_01",
						[x, z],
						{
							houseCount: 6,
						},
					),
				);
			}
		}
	}
	return rows;
};

/** Where Brooklyn's other things stand, which its brownstones keep clear of: [x0, z0, x1, z1]. */
const BROOKLYN_TAKEN: TBox[] = [
	// Borough Hall and the bridge's landing.
	[6, 9, 17, 18],
	// The Red Hook waterfront: cranes and containers.
	[3, 19, 12, 31],
	// Towers by Prospect Park.
	[26, 20, 32, 28],
	// The Verrazzano's landing.
	[3, 43, 10, 49],
];

const ENTITIES: TEntityInput[] = [
	// Manhattan: Midtown's and Downtown's towers through the clouds, Upper Manhattan round the park.
	{
		...landmark("manhattan_tower", "office_tower_01", [-8, -7.5], "Manhattan", {
			floorCount: 40,
			width: 3,
			depth: 3,
		}),
		colors: { facade: { color: "#a9b8c6" } },
	},
	tower("mn_midtown_1", [-14, -12], 30),
	tower("mn_midtown_2", [-8, -12], 36),
	tower("mn_midtown_3", [-14, -7.5], 26),
	tower("mn_midtown_4", [-14, -3], 22),
	tower("mn_midtown_5", [-8, -3], 28),
	tower("mn_downtown_1", [-12, 2], 38),
	tower("mn_downtown_2", [-8.5, 1.5], 30, 2.6),
	tower("mn_downtown_3", [-12, 6], 24, 2.6),
	cluster("mn_uptown_1", "tower_cluster_01", [-11.5, -40], 5, 3, 0.8),
	cluster("mn_harlem", "tower_cluster_01", [-13.5, -17], 4, 5, 0.8),
	// The Bronx: its stadium among apartment blocks.
	landmark("bronx_stadium", "grandstand_01", [10, -49], "Bronx"),
	cluster("bx_blocks_1", "tower_cluster_01", [-5, -50], 8, 11, 0.8),
	thing("bx_block_1", "apartment_block_01", [24, -49], { floorCount: 8, width: 5 }),
	thing("bx_block_2", "apartment_block_01", [31, -49], { floorCount: 10, width: 5 }),
	cluster("bx_homes", "house_cluster_01", [43, -48], 10, 13),
	// Queens: homes and flats, a ballpark, warehouses by the river.
	landmark("queens_flats", "apartment_block_01", [20, -12], "Queens", { floorCount: 10, width: 4 }),
	thing("qn_ballpark", "grandstand_01", [32, -8]),
	cluster("qn_homes_1", "house_cluster_01", [10, -26], 12, 17),
	cluster("qn_homes_2", "house_cluster_01", [26, -27], 12, 19),
	cluster("qn_homes_3", "house_cluster_01", [43, -27], 12, 23),
	cluster("qn_homes_4", "house_cluster_01", [46, -12], 10, 25),
	cluster("qn_homes_5", "house_cluster_01", [46, 0], 7, 27),
	thing("qn_warehouse_1", "warehouse_01", [9, -7]),
	thing("qn_warehouse_2", "warehouse_01", [9, 2]),
	// Brooklyn: its borough hall, the Red Hook docks, towers by the park, then brownstones.
	landmark("brooklyn_hall", "city_hall_01", [11, 14], "Brooklyn"),
	thing("bk_crane", "gantry_crane_01", [7, 22], {}, 90),
	thing("bk_containers_1", "shipping_container_01", [9, 27], { containerCount: 3, length: 2 }),
	thing("bk_containers_2", "shipping_container_01", [9, 29.5], { containerCount: 2, length: 2 }),
	tower("bk_tower_1", [28, 22], 16, 2.6),
	tower("bk_tower_2", [30, 26], 12, 2.6),
	...brownstones(BROOKLYN_TAKEN),
	// Staten Island: houses and its school.
	landmark("staten_island_school", "school_01", [-26, 48], "Staten Island"),
	cluster("si_homes_1", "house_cluster_01", [-46, 46], 10, 43),
	cluster("si_homes_2", "house_cluster_01", [-36, 45], 8, 47),
	// On the water: the Staten Island Ferry, a container ship through the Narrows, sailing boats.
	{
		id: "staten_island_ferry",
		kind: "ferry_01",
		follow: { roadId: "ferry_route", speed: 1.5, startDistance: 0 },
	},
	{
		id: "container_ship",
		kind: "cargo_ship_01",
		props: { length: 5.5 },
		follow: { roadId: "shipping_lane", speed: 1, startDistance: 0 },
	},
	thing("sailing_boat_1", "sailing_boat_01", [-23, 22], {}, 30),
	thing("sailing_boat_2", "sailing_boat_01", [-10.5, 32.5], {}, 200),
];

/** A raised road across water, with its traffic: a flow of cars driving it both ways. */
const bridge = (id: string, name: string, points: [number, number, number][]): TRoadInput => ({
	id,
	kind: "road_01",
	name,
	points,
	flow: { enabled: true, vehicleKind: "car_01", vehicleDensity: 1, speed: 2 },
});

const ROADS: TRoadInput[] = [
	bridge("brooklyn_bridge", "Brooklyn Bridge", [
		[-8.5, 7, 0],
		[-5, 8, 1.1],
		[2, 10, 1.1],
		[5, 11, 0],
	]),
	bridge("queensboro_bridge", "Queensboro Bridge", [
		[-6.5, -16, 0],
		[-3.011, -16, 1.1],
		[-0.98, -16, 1.1],
		[3, -16, 0],
	]),
	bridge("george_washington_bridge", "George Washington Bridge", [
		[-15.5, -34, 0],
		[-20, -34, 1.1],
		[-23, -34, 1.1],
		[-27, -34, 0],
	]),
	bridge("verrazzano_bridge", "Verrazzano-Narrows Bridge", [
		[6.5, 46, 0],
		[-2, 46, 2.038],
		[-8, 46, 2.038],
		[-17, 46, 0],
	]),
	{
		id: "broadway",
		kind: "road_01",
		name: "Broadway",
		points: [
			[-11, -19.64],
			[-11, -2],
		],
		flow: { enabled: true, vehicleKind: "car_01", vehicleDensity: 1, speed: 2 },
	},
	{
		id: "ferry_route",
		kind: "hidden_route_01",
		name: "Staten Island Ferry",
		points: [
			[-17, 36],
			[-12.166, 23.522],
			[-9, 13],
		],
	},
	{
		id: "shipping_lane",
		kind: "hidden_route_01",
		name: "Shipping lane",
		// A loop in through the Narrows, round the upper bay and back out.
		loops: true,
		points: [
			[-5.451, 52.312],
			[-4.5, 49],
			[-4.448, 41.959],
			[-1, 23],
			[-2, 18],
			[-5.5, 17],
			[-6.5, 19],
			[-6.222, 47.574],
			[-10, 49.5],
			[-11, 52.5],
			[-7.5, 53.5],
		],
	},
];

/** A hedge round Central Park, a gate at its south and north ends. */
const FENCES: TFenceInput[] = [
	{
		id: "central_park_hedge",
		kind: "hedge_01",
		name: "Central Park hedge",
		points: [
			[-12.78, -29.78],
			[-8.209, -29.78],
			[-7.731, -20.22],
			[-12.78, -20.22],
		],
		loops: true,
		height: 0.64,
		gates: [0, 2].map((spanIndex) => ({
			kind: "swinging" as const,
			spanIndex,
			alongShare: spanIndex === 0 ? 0.5 : 0.4951,
			width: 1.4,
			isOpen: true,
			opensToTheLeft: true,
			hasTwoLeaves: true,
		})),
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
		grounds: [{ id: "ground", width: 110, depth: 110 }],
		weather: { cloudCover: 0.1 },
		moods: [
			{
				id: "mood_dusk",
				name: "Dusk, the skyline lit",
				lighting: { time: 20.25, timeSource: "fixed" },
			},
		],
		camera: { openingViewpointId: "view_city" },
		viewpoints: [
			{ id: "view_city", name: "The five boroughs", target: [0, 0], span: 112 },
			{
				id: "view_skyline",
				name: "The skyline at dusk",
				description: "Midtown and Downtown through the clouds, their windows lit.",
				target: [-10, -6],
				targetAltitude: 6,
				elevation: 38,
				span: 44,
				moodId: "mood_dusk",
			},
			{
				id: "view_bronx",
				name: "The Bronx",
				description:
					"The most complaints per resident: in winter it snows with heating complaints (drag the time slider to January 2026), in summer the noise brings storms.",
				target: [12, -48],
				span: 44,
			},
			{
				id: "view_harbour",
				name: "The harbour",
				description: "The ferry to Staten Island, a ship through the Narrows, the Verrazzano.",
				target: [-8, 34],
				span: 50,
			},
		],
		onScreen: {
			legend: [
				{ label: "Rain and clouds", meaning: "311 complaints per 1,000 residents: more, wetter" },
				{ label: "Lightning", meaning: "Share about noise: higher, more often" },
				{ label: "Snow", meaning: "Heating complaints per 1,000 residents: more, heavier" },
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
						"NYC 311 service requests per borough per month, counted from NYC Open Data's 311 Service Requests from 2010 to Present on 7 Nov 2026 (all requests, those whose type starts with Noise, and HEAT/HOT WATER; per 1,000 residents from the 2020 census): a spreadsheet kept on this site, read as a table over time, to download from this source's page",
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
						{ key: "heat_complaints", name: "About heat and hot water" },
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
						{
							key: "heat_per_1000",
							name: "Heating per 1,000 residents",
							about:
								"Worked out: requests about heat and hot water ÷ the borough's 2020 census population × 1,000",
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
		fences: FENCES,
	});
