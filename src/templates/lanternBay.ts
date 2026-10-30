import {
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TLightingInput,
	type TMoodInput,
	type TRoadInput,
	type TScene,
	type TSceneInput,
	type TTiltShiftInput,
	type TVec2,
} from "#/scene/schema";

import { paint } from "./paint";
import { turned } from "./turned";

/*
 * Lantern Bay: a waterfront that shows off the look (ADR-0072 to ADR-0077),
 * best with Preferences → Graphics → Ultra. Its day runs from golden hour into
 * night while motion plays.
 *
 * The camera looks from the south (+Z), so the north is the back of the
 * picture, layered for the view from the water: the upper town on a ridge
 * along the back (terraced rows facing the bay, a church spire, lanterns
 * along the ridge path), houses with front lawns below it, lit towers inside
 * the waterfront loop road, a promenade of lamps and benches along the beach,
 * and the bay in front. A rocky headland with a lighthouse frames the west
 * end; harbour lanes with a café and string lights face the water at the east
 * end. A breakwater pier with a beacon closes off a mirror-calm harbour basin,
 * full of moored yachts, from the rippling bay, where a ferry and sailing
 * boats cross.
 *
 *   Areas: the bay, the calm harbour basin, a beach, the promenade, the pier, the back lawns,
 *          the ridge, the headland, the east quay
 *   Roads: the waterfront loop, and a hidden ferry route across the bay
 *   Data:  the town's evening, the offices still at work, the marina and the ferry
 */

const LOOP_ID = "waterfront_loop";
const FERRY_ID = "ferry_route";

const PIER = 0.5;
/** How high the ridge of the upper town and the lighthouse headland stand. */
const RIDGE = 1.4;
const HEADLAND = 1.2;
const RIDGE_PATH_ID = "ridge_path";
const HEADLAND_PATH_ID = "headland_path";

// ---------------------------------------------------------------- areas

const AREAS: TAreaInput[] = [
	{
		id: "bay",
		name: "Lantern Bay",
		kind: "water_01",
		points: [
			[-22.8, 4],
			[-12, 3.2],
			[-2, 4.2],
			[2, 6],
			[17, 6],
			[17, 1],
			[30, 1],
			[30, 26],
			[-30, 26],
			// Round the headland's tip, back to the beach.
			[-30, 13.4],
			[-27.4, 12.6],
			[-25, 10.2],
			[-23.4, 6.4],
		],
	},
	{
		// Sheltered by the pier: still enough to mirror the yachts and the town.
		id: "basin",
		name: "Harbour basin",
		kind: "water_01",
		water: { rippleStrength: 0.06, reflectionStrength: 1 },
		points: [
			[2, 0],
			[17, 0],
			[17, 6.4],
			[2, 6.4],
		],
	},
	{
		id: "beach",
		name: "Beach",
		kind: "sand_01",
		points: [
			[-22.8, 1.6],
			[2, 1.6],
			[2, 6],
			[-2, 4.2],
			[-12, 3.2],
			[-22.8, 4],
		],
	},
	{
		id: "promenade",
		name: "Promenade",
		kind: "plaza_01",
		points: [
			[-23.2, -1.6],
			[17, -1.6],
			[17, 0],
			[2, 0],
			[2, 1.6],
			[-22.8, 1.6],
		],
	},
	{
		id: "pier",
		name: "Breakwater",
		kind: "raised_land_01",
		height: PIER,
		points: [
			[17, -1.6],
			[18.4, -1.6],
			[18.4, 13],
			[17, 13],
		],
	},
	{
		id: "back_lawns",
		name: "Back lawns",
		// In front of the row of houses at the back, down to the road.
		kind: "grass_01",
		points: [
			[-30, -21],
			[-4.25, -21],
			[-6.2, -14.8],
			[-30, -14.8],
		],
	},
	{
		// The town's garden between the towers and the headland, round a still pond.
		id: "lighthouse_gardens",
		name: "Lighthouse gardens",
		kind: "grass_01",
		points: [
			[-30, -14.8],
			[-21.6, -14.8],
			[-21.6, -2],
			[-30, -2],
		],
	},
	{
		// Sheltered and still: it mirrors the garden's lamps and the lit towers at night.
		id: "garden_pond",
		name: "Garden pond",
		kind: "water_01",
		water: { rippleStrength: 0.04, reflectionStrength: 1 },
		points: [
			[-27.6, -10.6],
			[-25.4, -11.2],
			[-23.6, -9.8],
			[-23.8, -7.4],
			[-25.8, -6.4],
			[-27.8, -7.2],
			[-28.4, -9],
		],
	},
	{
		id: "schoolyard",
		name: "Schoolyard",
		kind: "grass_01",
		points: [
			[16, -21],
			[30, -21],
			[30, -15.4],
			[16, -15.4],
		],
	},
	{
		id: "terrace_lawns",
		name: "Terrace lawns",
		kind: "grass_01",
		points: [
			[-3.6, -21],
			[16, -21],
			[16, -15],
			[-5.6, -15],
		],
	},
	{
		// The upper town's ridge along the back, its cliff facing the bay.
		id: "ridge",
		name: "Upper town",
		kind: "raised_land_01",
		height: RIDGE,
		points: [
			[-30, -26],
			[30, -26],
			[30, -21],
			[-30, -21],
		],
	},
	{
		// A rocky point out into the bay at the west end, the lighthouse on top.
		id: "headland",
		name: "Lighthouse point",
		kind: "raised_land_01",
		height: HEADLAND,
		points: [
			[-30, -1.6],
			[-23.6, -1.6],
			[-23.2, 1.6],
			[-22.8, 4],
			[-23.4, 6.4],
			[-25, 10.2],
			[-27.4, 12.6],
			[-30, 13.4],
		],
	},
	{
		// Past the pier: the harbour lanes' quay, facing the water.
		id: "east_quay",
		name: "East quay",
		kind: "plaza_01",
		points: [
			[18.4, -1.6],
			[30, -1.6],
			[30, 1],
			[18.4, 1],
		],
	},
	{
		id: "square",
		name: "Tower square",
		kind: "plaza_01",
		points: [
			[-10, -12],
			[8, -12],
			[8, -4.4],
			[-10, -4.4],
		],
	},
];

// ---------------------------------------------------------------- roads

const ROADS: TRoadInput[] = [
	{
		id: LOOP_ID,
		name: "Waterfront loop",
		kind: "road_01",
		loops: true,
		cornerRadius: 3,
		points: [
			[-20, -3],
			[14, -3],
			[14, -13.4],
			[-20, -13.4],
		],
	},
	{
		id: FERRY_ID,
		name: "Ferry line",
		kind: "hidden_route_01",
		loops: true,
		cornerRadius: 3,
		points: [
			[-14, 9],
			[10, 9.5],
			[12, 15.5],
			[-16, 15.5],
		],
	},
	{
		// Along the front of the ridge, past the upper town's doors.
		id: RIDGE_PATH_ID,
		name: "Ridge path",
		kind: "dirt_path_01",
		width: 1.1,
		traffic: { drivingLane: "centre" },
		points: [
			[-29, -21.8, RIDGE],
			[29, -21.8, RIDGE],
		],
	},
	{
		// From the west end of the promenade up onto the headland, to the lighthouse.
		id: HEADLAND_PATH_ID,
		name: "Headland path",
		kind: "dirt_path_01",
		width: 1,
		cornerRadius: 1.5,
		heldUpBy: "embankment",
		showsRailings: false,
		traffic: { drivingLane: "centre" },
		points: [
			[-22.6, -0.6],
			[-25.4, -0.4, HEADLAND],
			[-26.2, 3.4, HEADLAND],
			[-26.6, 6.4, HEADLAND],
		],
	},
];

// ---------------------------------------------------------------- town

/** [id, name, x, z, width, depth, floors, facade colour] */
const TOWER_SPECS: [string, string, number, number, number, number, number, string][] = [
	["tower_harbourside", "Harbourside", -15.5, -8, 2.8, 2.8, 8, "#f07b4f"],
	["tower_green", "Greenline", -10.6, -9.2, 3.2, 3.2, 13, "#2bb58c"],
	["tower_lantern", "Lantern Tower", -4.6, -8.4, 3.2, 3.2, 17, "#e8b83a"],
	["tower_violet", "Violet House", 1.2, -9.4, 3, 3, 11, "#8a5cf0"],
	["tower_bayview", "Bayview", 6.6, -8, 3.4, 3.4, 14, "#4a64e0"],
	["tower_quay", "Quay House", 11, -6.8, 2.4, 2.4, 6, "#e2cfa8"],
];

const towers: TEntityInput[] = TOWER_SPECS.map(
	([id, name, x, z, width, depth, floorCount, facade]) => ({
		id,
		name,
		kind: "office_tower_01",
		position: [x, z] as TVec2,
		colors: paint({ facade }),
		props: { width, depth, floorCount },
	}),
);

// The tallest tower carries the town's card; Bayview's lit windows follow its offices at work.
const lanternTower = towers.find((tower) => tower.id === "tower_lantern");
if (lanternTower) {
	lanternTower.label = {
		title: "Lantern Bay",
		dataKeys: ["evening_visitors", "restaurants_open"],
		offset: [-3, 4, 2],
	};
	lanternTower.details = {
		description: "A waterfront town that comes alive after dark.",
		dataKeys: ["evening_visitors", "restaurants_open"],
	};
}
const bayview = towers.find((tower) => tower.id === "tower_bayview");
if (bayview) {
	bayview.lights = {
		windows: { data: { litPaneShare: { key: "offices_at_work", valueAtFull: 100 } } },
	};
	bayview.label = {
		title: "Bayview offices",
		dataKeys: ["offices_at_work"],
		offset: [3, 3, 2],
	};
	bayview.details = {
		description: "Its lit windows follow how many of its offices are still at work.",
		dataKeys: ["offices_at_work"],
	};
}

/**
 * A row along the back of the world, behind the waterfront road, with lawns in front and
 * behind: houses 2.2 wide (2.5 with the roof's overhang) and two pines between them, a little
 * apart so no roof or tree runs into another.
 */
const BACK_HOUSE_WIDTH = 2.2;
const BACK_ROW = -17.6;
const backHouses: TEntityInput[] = (
	[
		[-20.6, "#f07b4f"],
		[-17.95, "#4a64e0"],
		[-14.25, "#3cbf9a"],
		[-11.6, "#e8b83a"],
		[-7.9, "#8a5cf0"],
	] as const
).map(([x, roof], i) => ({
	id: `back_house_${i}`,
	kind: "house_01",
	name: `House ${i + 1}`,
	position: [x, BACK_ROW] as TVec2,
	colors: paint({ roof }),
	props: { width: BACK_HOUSE_WIDTH },
}));

const warehouse: TEntityInput[] = [
	{
		id: "fish_hall",
		kind: "warehouse_01",
		name: "Fish hall",
		position: [18.5, -11],
		props: { width: 6.4, depth: 4, height: 2.6, doorCount: 3, showsSolarPanels: true },
	},
	{
		id: "hall_truck",
		kind: "truck_01",
		name: "Fish truck",
		position: [17, -6.4],
		rotation: turned(90),
	},
];

// ---------------------------------------------------------------- waterfront

const promenadeLamps: TEntityInput[] = [-19.6, -15.6, -11.6, -7.6, -3.6, 0.4].map((x, i) => ({
	id: `promenade_lamp_${i}`,
	kind: "street_lamp_01",
	name: `Promenade lamp ${i + 1}`,
	position: [x, 1] as TVec2,
}));

const quayLamps: TEntityInput[] = [5, 9.5, 14].map((x, i) => ({
	id: `quay_lamp_${i}`,
	kind: "street_lamp_01",
	name: `Quay lamp ${i + 1}`,
	position: [x, -1.1] as TVec2,
}));

const pier: TEntityInput[] = [
	...[2.5, 7, 11.4].map((z, i) => ({
		id: `pier_lamp_${i}`,
		kind: "street_lamp_01",
		name: `Pier lamp ${i + 1}`,
		position: [17.7, z] as TVec2,
		altitude: PIER,
	})),
	{
		id: "pier_beacon",
		kind: "beacon_01",
		name: "Pier beacon",
		position: [17.7, 12.4],
		altitude: PIER,
		props: { radius: 0.6, pulses: true },
	},
];

const marina: TEntityInput[] = [
	{
		id: "marina_office",
		kind: "depot_01",
		name: "Marina office",
		position: [20.4, -0.4],
		colors: paint({ walls: "#e8b83a" }),
		props: { width: 2.6, depth: 1.6, height: 1.2, showsGarageDoor: false },
		label: {
			title: "Marina",
			dataKeys: ["berths", "boats_in"],
			offset: [2, 1.6, 2],
		},
		details: {
			description: "Moorings for 44 boats in the calm of the harbour basin.",
			dataKeys: ["berths", "boats_in"],
		},
	},
	// Moored along the quay, bows to the basin.
	...[3.6, 6.2, 8.8, 11.4, 14].map((x, i) => ({
		id: `moored_yacht_${i}`,
		kind: "yacht_01",
		name: `Moored yacht ${i + 1}`,
		position: [x, 1.7] as TVec2,
		rotation: turned(-90),
		props: { length: [2.4, 2.8, 3.4, 2.6, 3][i], deckCount: i === 2 ? 2 : 1 },
	})),
	...[
		[6, 4.6, 10],
		[12.5, 4.8, -15],
	].map(([x, z, rotation], i) => ({
		id: `basin_yacht_${i}`,
		kind: "yacht_01",
		name: `Basin yacht ${i + 1}`,
		position: [x, z] as TVec2,
		rotation: turned(rotation),
		props: { length: 2.6, deckCount: 1 },
	})),
	// Out in the bay, clear of the ferry line.
	{
		id: "bay_yacht_1",
		kind: "yacht_01",
		name: "Bay yacht",
		position: [4, 12.6],
		rotation: turned(-20),
		colors: paint({ stripe: "#2bb58c" }),
		props: { length: 2.8, deckCount: 2 },
	},
	...(
		[
			[-8, 12.2, 30, "#f4f1ea"],
			[-18.4, 12, 12, "#e2603b"],
			[8, 21, -15, "#f2c230"],
			[-4, 23.2, 20, "#f4f1ea"],
			[19, 18.6, 170, "#3d4fd6"],
		] as const
	).map(([x, z, rotation, sails], i) => ({
		id: `bay_sailing_boat_${i}`,
		kind: "sailing_boat_01",
		name: `Sailing boat ${i + 1}`,
		position: [x, z] as TVec2,
		rotation: turned(rotation),
		colors: paint({ sails }),
		props: { length: [2.2, 1.8, 2.6, 2, 2.2][i] },
	})),
	{
		id: "ferry",
		kind: "ferry_01",
		name: "Bay ferry",
		colors: paint({ hull: "#2f3a56", funnel: "#e8b83a" }),
		props: { length: 5 },
		follow: { roadId: FERRY_ID, speed: 1.3, startDistance: 6 },
		// Its cabins glow brighter the more passengers it carries: 60 is 100% (ADR-0058).
		lights: { cabins: { data: { strength: { key: "ferry_passengers", valueAtFull: 60 } } } },
		label: {
			title: "Bay ferry",
			dataKeys: ["ferry_next", "ferry_passengers"],
			offset: [2, 2.4, 2],
		},
		details: {
			description: "Round the bay every twenty minutes, all evening.",
			dataKeys: ["ferry_next", "ferry_passengers"],
		},
	},
	{
		id: "beach_cafe",
		kind: "cafe_01",
		name: "Beach café",
		position: [-6, 2.7],
		// Its front to the promenade; its tables out on the sand either side.
		rotation: turned(180),
		colors: paint({ walls: "#f3d9b0", awning: "#f07b4f" }),
		props: { width: 2.2 },
	},
	...[
		[-8.3, 2.8],
		[-3.7, 2.9],
	].flatMap(([x, z], i) => [
		{ id: `beach_table_${i}`, kind: "cafe_table_01", position: [x, z] as TVec2 },
		{
			id: `beach_parasol_${i}`,
			kind: "parasol_01",
			position: [x, z + 0.34] as TVec2,
			colors: paint({ canopy: ["#f07b4f", "#3cbf9a"][i] }),
		},
		{
			id: `beach_chair_${i}a`,
			kind: "chair_01",
			position: [x - 0.32, z] as TVec2,
			rotation: turned(90),
		},
		{
			id: `beach_chair_${i}b`,
			kind: "chair_01",
			position: [x + 0.32, z] as TVec2,
			rotation: turned(-90),
		},
	]),
];

const traffic: TEntityInput[] = [
	{
		id: "loop_car_1",
		kind: "car_01",
		name: "Taxi",
		colors: paint({ body: "#e8b83a" }),
		follow: { roadId: LOOP_ID, speed: 3, startDistance: 4 },
	},
	{
		id: "loop_car_2",
		kind: "car_01",
		name: "Red car",
		colors: paint({ body: "#e05a4a" }),
		follow: { roadId: LOOP_ID, speed: 3.3, startDistance: 30 },
	},
	{
		id: "loop_van",
		kind: "delivery_van_01",
		name: "Delivery van",
		follow: { roadId: LOOP_ID, speed: 2.6, startDistance: 52 },
	},
	{
		id: "loop_car_3",
		kind: "car_01",
		name: "Blue car",
		colors: paint({ body: "#4a64e0" }),
		follow: { roadId: LOOP_ID, speed: 2.9, startDistance: 72 },
	},
];

// ---------------------------------------------------------------- nature

const nature: TEntityInput[] = [
	...[
		[-18.6, -0.4],
		[-13.4, -0.4],
		[-8.2, -0.4],
		[-3, -0.4],
		[-12, -5.6],
		[9, -11],
		[-1.6, -11.2],
	].map(([x, z], i) => ({
		id: `tree_${i}`,
		kind: "round_tree_01",
		position: [x, z] as TVec2,
		scale: 0.9 + (i % 3) * 0.15,
	})),
	// In the two gaps between the houses at the back.
	...[
		[-16.1, BACK_ROW],
		[-9.75, BACK_ROW],
	].map(([x, z], i) => ({
		id: `pine_${i}`,
		kind: "pine_tree_01",
		position: [x, z] as TVec2,
		scale: 0.9,
	})),
];

/** Benches along the promenade between the lamps, looking out to sea. */
const promenadeBenches: TEntityInput[] = [-17.6, -13.6, -9.6, -1.6].map((x, i) => ({
	id: `promenade_bench_${i}`,
	kind: "bench_01",
	position: [x, 1.15] as TVec2,
}));

/**
 * The upper town on the ridge: terraced rows facing the bay, the church with
 * its spire between them, cypresses in the gaps, lanterns along the ridge path.
 */
const UPPER_ROW = -24.2;
const upperTown: TEntityInput[] = [
	...(
		[
			[-24, 5, "#e3c9a2", "#c9785a", "#5d4a44"],
			[-14, 4, "#d98f6a", "#efe2c4", "#4a4e55"],
			[4, 6, "#e8d4a8", "#9cc4d8", "#5d4a44"],
			[14, 4, "#c9b8e8", "#f0e0c0", "#4a4e55"],
			[23.5, 5, "#efd9a0", "#d98f6a", "#5d4a44"],
		] as const
	).map(([x, houseCount, walls, otherWalls, roof], i) => ({
		id: `upper_row_${i}`,
		kind: "terraced_row_01",
		name: `Upper town row ${i + 1}`,
		position: [x, UPPER_ROW] as TVec2,
		altitude: RIDGE,
		colors: paint({ walls, otherWalls, roof }),
		props: { houseCount },
	})),
	{
		id: "upper_church",
		kind: "church_01",
		name: "St Elmo's",
		position: [-5.5, UPPER_ROW + 0.2],
		altitude: RIDGE,
		props: { depth: 2.6, towerHeight: 4.2 },
	},
	...[-19, -9, -1.6, 9.5, 18.4, 28.2].map((x, i) => ({
		id: `upper_cypress_${i}`,
		kind: "cypress_01",
		position: [x, UPPER_ROW - 0.2] as TVec2,
		altitude: RIDGE,
		scale: 0.9 + (i % 2) * 0.2,
	})),
	...[-26, -20.6, -13, -8, -3, 2, 7.2, 12, 17, 21, 26].map((x, i) => ({
		id: `upper_lantern_${i}`,
		kind: "street_lamp_02",
		position: [x, -22.7] as TVec2,
		altitude: RIDGE,
		props: { height: 1.1 },
	})),
];

/** The headland at the west end: the lighthouse, a bench looking out, a lit path, rough grass, rocks in the sea. */
const headland: TEntityInput[] = [
	{
		id: "lighthouse",
		kind: "lighthouse_01",
		name: "Point lighthouse",
		position: [-27.6, 7.6],
		altitude: HEADLAND,
		props: { height: 3.4 },
		details: { description: "Lit every evening since 1891." },
	},
	{ id: "headland_bench", kind: "bench_01", position: [-25.8, 9.2], altitude: HEADLAND },
	...[
		[-26.9, 1.8],
		[-25.5, 4.8],
	].map(([x, z], i) => ({
		id: `headland_bollard_${i}`,
		kind: "bollard_light_01",
		position: [x, z] as TVec2,
		altitude: HEADLAND,
	})),
	...[
		[-28.8, 2.2],
		[-29.2, 10.8],
		[-24, 2.4],
		[-28.6, -0.6],
	].map(([x, z], i) => ({
		id: `headland_grass_${i}`,
		kind: "tall_grass_01",
		position: [x, z] as TVec2,
		altitude: HEADLAND,
	})),
	{
		id: "headland_bush",
		kind: "bush_01",
		position: [-29, 5.2],
		altitude: HEADLAND,
		scale: 0.9,
	},
	{
		id: "headland_pine",
		kind: "pine_tree_01",
		position: [-29.1, 1],
		altitude: HEADLAND,
		scale: 0.9,
	},
	// At the foot of the cliffs, in the sea.
	{ id: "headland_rocks_1", kind: "rocks_01", position: [-24.2, 11.6], props: { rockCount: 4 } },
	{ id: "headland_rocks_2", kind: "rocks_01", position: [-29, 15], props: { rockCount: 3 } },
];

/**
 * Harbour lanes past the pier: narrow shops and a café facing the east quay,
 * a terrace with string lights, a sailing boat moored with its sails down,
 * and a row of houses and flats behind.
 */
const LANES_ROW = -3.6;
const harbourLanes: TEntityInput[] = [
	{
		id: "lanes_chandler",
		kind: "shop_02",
		name: "Chandlery",
		position: [23, LANES_ROW],
		colors: paint({ walls: "#9cc4d8", awning: "#3d4fd6" }),
	},
	{
		id: "lanes_fishmonger",
		kind: "shop_02",
		name: "Fishmonger",
		position: [24.5, LANES_ROW],
		colors: paint({ walls: "#e3c9a2", awning: "#2f7a5d" }),
		props: { floorCount: 4 },
	},
	{ id: "lanes_deli", kind: "shop_01", name: "Deli", position: [26.4, LANES_ROW] },
	{
		id: "lanes_cafe",
		kind: "cafe_01",
		name: "Quay café",
		position: [28.7, LANES_ROW],
		colors: paint({ walls: "#f3e3c3", awning: "#c8553d" }),
		props: { width: 2.2 },
	},
	...[
		[27.6, -0.4],
		[29.2, -0.4],
	].flatMap(([x, z], i) => [
		{ id: `lanes_table_${i}`, kind: "cafe_table_01", position: [x, z] as TVec2 },
		{ id: `lanes_parasol_${i}`, kind: "parasol_01", position: [x, z - 0.34] as TVec2 },
		{
			id: `lanes_chair_${i}a`,
			kind: "chair_01",
			position: [x - 0.32, z] as TVec2,
			rotation: turned(90),
		},
		{
			id: `lanes_chair_${i}b`,
			kind: "chair_01",
			position: [x + 0.32, z] as TVec2,
			rotation: turned(-90),
		},
	]),
	{
		id: "lanes_string_lights",
		kind: "string_lights_01",
		position: [25.75, 0.75],
		props: { length: 7, height: 1.2 },
	},
	{
		id: "lanes_moored_sailing_boat",
		kind: "sailing_boat_01",
		name: "Moored sailing boat",
		position: [24, 2.6],
		props: { length: 2, showsSails: false },
	},
	{
		id: "lanes_terrace",
		kind: "terraced_row_01",
		name: "Quay terrace",
		position: [26, -8],
		props: { houseCount: 3 },
		colors: paint({ walls: "#d98f6a", otherWalls: "#efe2c4" }),
	},
	{
		id: "lanes_flats",
		kind: "apartment_block_01",
		name: "Harbour flats",
		position: [26, -14],
		props: { width: 3.2, depth: 2, floorCount: 6 },
	},
	{ id: "lanes_birch_1", kind: "birch_01", position: [23, -8.2] },
	{ id: "lanes_birch_2", kind: "birch_01", position: [29, -11.4], scale: 0.9 },
];

/** Terraced houses behind the loop road with lawns in front, and trees. */
const terraceHouses: TEntityInput[] = [
	{
		id: "back_terrace",
		kind: "terraced_row_01",
		name: "Shore Road terrace",
		position: [4.5, -17.6],
		props: { houseCount: 6 },
		colors: paint({ walls: "#e8b83a", otherWalls: "#f4f1ea", roof: "#4a4e55" }),
	},
	{ id: "back_broad_tree_1", kind: "round_tree_02", position: [11.4, -17.8], scale: 1 },
	{ id: "back_birch", kind: "birch_01", position: [14.2, -18.6] },
	{ id: "back_broad_tree_2", kind: "round_tree_02", position: [-2.2, -18.2], scale: 0.9 },
];

/**
 * Lighthouse gardens: benches round a still pond, lamps on the paths, flower
 * beds, trees, and the lighthouse keeper's cottage by the headland path.
 */
const POND: TVec2 = [-25.9, -8.8];
const gardens: TEntityInput[] = [
	// Facing the pond from north, south and east (a bench sits facing +Z).
	{ id: "garden_bench_north", kind: "bench_01", position: [POND[0], -12.4] },
	{ id: "garden_bench_south", kind: "bench_01", position: [POND[0], -5.2], rotation: turned(180) },
	{ id: "garden_bench_east", kind: "bench_01", position: [-22.5, POND[1]], rotation: turned(-90) },
	...[0, 1, 2, 3, 4, 5].map((i) => {
		const angle = (i / 6) * Math.PI * 2 + 0.5;
		return {
			id: `garden_bollard_${i}`,
			kind: "bollard_light_01",
			position: [
				Math.round((POND[0] + Math.cos(angle) * 3.4) * 100) / 100,
				Math.round((POND[1] + Math.sin(angle) * 3.4) * 100) / 100,
			] as TVec2,
		};
	}),
	{
		id: "garden_flowers_1",
		kind: "flower_bed_01",
		position: [-29.2, -12.6],
		rotation: turned(90),
		props: { length: 2, width: 0.7 },
	},
	{
		id: "garden_flowers_2",
		kind: "flower_bed_01",
		position: [-22.6, -13.6],
		props: { length: 1.6, width: 0.6 },
		colors: paint({ flowers: "#c06bd8", otherFlowers: "#f7f7f4" }),
	},
	{ id: "garden_tree_1", kind: "round_tree_02", position: [-29.1, -6.2], scale: 1.1 },
	{ id: "garden_tree_2", kind: "round_tree_02", position: [-22.7, -11.6], scale: 0.9 },
	{ id: "garden_birch_1", kind: "birch_01", position: [-28.9, -9.6] },
	{ id: "garden_birch_2", kind: "birch_01", position: [-24.4, -13.7], scale: 0.9 },
	{ id: "garden_reeds", kind: "tall_grass_01", position: [-24, -10.4] },
	{ id: "garden_picnic", kind: "picnic_table_01", position: [-22.8, -5.6], rotation: turned(90) },
	{ id: "garden_bin", kind: "bin_01", position: [-24.4, -5] },
	{
		id: "keepers_cottage",
		kind: "house_01",
		name: "Keeper's cottage",
		position: [-28.4, -3.4],
		colors: paint({ roof: "#2f3a56", door: "#c8553d" }),
		props: { width: 2.2, depth: 1.8 },
	},
];

/** The harbour school east of the fish hall, its yard and a few trees. */
const school: TEntityInput[] = [
	{
		id: "harbour_school",
		kind: "school_01",
		name: "Harbour school",
		position: [21.4, -18.6],
		colors: paint({ walls: "#d9a07a", flag: "#e8b83a" }),
	},
	{ id: "school_tree_1", kind: "round_tree_01", position: [17.2, -17], scale: 1 },
	{ id: "school_tree_2", kind: "round_tree_02", position: [27.8, -18.6], scale: 0.9 },
	{ id: "school_picnic_1", kind: "picnic_table_01", position: [25.6, -19.8] },
	{ id: "school_bench", kind: "bench_01", position: [18.4, -16] },
];

/** A cyclist along the ridge path, past the upper town's doors. */
const ridgeCyclist: TEntityInput[] = [
	{
		id: "ridge_cyclist",
		kind: "bicycle_01",
		name: "Cyclist",
		colors: paint({ riderTop: "#f2c230" }),
		follow: { roadId: RIDGE_PATH_ID, speed: 0.9, startDistance: 10 },
	},
];

// ---------------------------------------------------------------- moods

/** Its look, the same in every mood but for the time of day (ADR-0078). */
const SKY: TSceneInput["sky"] = { starDensity: 0.9 };
const WEATHER: TSceneInput["weather"] = { cloudCover: 0.2 };
const WATER: TSceneInput["water"] = { rippleStrength: 0.45 };
const TILT_SHIFT: TTiltShiftInput = {
	isOn: true,
	blurStrength: 0.45,
	sharpBandHeight: 0.38,
	sharpBandPosition: 0.5,
};
const LIGHTING = { dayLength: 300, sunShadeContrast: 0.75 } satisfies TLightingInput;

/** From golden hour into the night, a day in five minutes while motion plays (ADR-0052). */
const EVENING_PASSES = { ...LIGHTING, time: 18.3, timeSource: "cycle" } satisfies TLightingInput;

const mood = (id: string, name: string, lighting: TLightingInput): TMoodInput => ({
	id,
	name,
	lighting: { ...LIGHTING, ...lighting },
	sky: SKY,
	water: WATER,
	weather: WEATHER,
	tiltShift: TILT_SHIFT,
});

const MOODS = [
	mood("mood_evening", "The evening passes", EVENING_PASSES),
	mood("mood_golden", "Golden hour", { time: 18.3, timeSource: "fixed" }),
	mood("mood_blue", "Blue hour", { time: 19.8, timeSource: "fixed" }),
	mood("mood_night", "Night", { time: 21.5, timeSource: "fixed" }),
];

export const createLanternBayScene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: {
			title: "Lantern Bay",
			subtitle: "An evening on the waterfront",
		},
		theme: "system",
		ground: { width: 60, depth: 52 },
		traffic: { drivingSide: "right" },
		// It opens wearing The evening passes.
		lighting: EVENING_PASSES,
		sky: SKY,
		water: WATER,
		weather: WEATHER,
		camera: { openingViewpointId: "view_bay", lowestElevation: 5, tiltShift: TILT_SHIFT },
		moods: MOODS,
		viewpoints: [
			{
				id: "view_bay",
				name: "From the bay",
				description: "The town across the water, its lights in the bay.",
				target: [-2, -6],
				azimuth: 270,
				elevation: 10,
				span: 38,
				projection: "perspective",
				moodId: "mood_evening",
			},
			{
				id: "view_overview",
				name: "Overview",
				description: "Lantern Bay at a glance, with its evening in numbers.",
				target: [0, -1],
				span: 56,
			},
			{
				id: "view_promenade",
				name: "The promenade",
				description: "Lamps along the beach, the towers behind.",
				target: [-9, 0],
				azimuth: 300,
				elevation: 12,
				span: 13,
				projection: "perspective",
				moodId: "mood_night",
			},
			{
				id: "view_basin",
				name: "Harbour basin",
				description: "Still water mirroring the yachts and the town.",
				target: [9, 2.6],
				azimuth: 285,
				elevation: 14,
				span: 15,
				projection: "perspective",
				moodId: "mood_blue",
			},
			{
				id: "view_gardens",
				name: "Lighthouse gardens",
				description: "The pond mirroring the lamps and the lit towers.",
				target: [-25, -8],
				azimuth: 300,
				elevation: 18,
				span: 15,
				projection: "perspective",
				moodId: "mood_night",
			},
			{
				id: "view_lighthouse",
				name: "Lighthouse point",
				description: "The lighthouse on the headland, its beam sweeping the bay.",
				target: [-26, 6],
				azimuth: 240,
				elevation: 14,
				span: 13,
				projection: "perspective",
				moodId: "mood_night",
			},
			{
				id: "view_upper_town",
				name: "Upper town",
				description: "Lanterns along the ridge, the church spire above the towers.",
				target: [-12, -22],
				azimuth: 300,
				elevation: 34,
				span: 24,
				projection: "perspective",
				moodId: "mood_blue",
			},
			{
				id: "view_lanes",
				name: "Harbour lanes",
				description: "The quay café under its string of lights.",
				target: [25.5, -1.6],
				azimuth: 290,
				elevation: 12,
				span: 12,
				projection: "perspective",
				moodId: "mood_golden",
			},
			{
				id: "view_pier",
				name: "The pier",
				description: "Out along the breakwater to the beacon.",
				target: [17.6, 7],
				azimuth: 215,
				elevation: 16,
				span: 14,
				projection: "perspective",
				moodId: "mood_night",
			},
		],
		data: {
			values: [
				{ key: "evening_visitors", name: "Visitors tonight", value: 3400 },
				{ key: "restaurants_open", name: "Restaurants open", value: 18 },
				{ key: "offices_at_work", name: "Offices at work", value: 35, unit: "%" },
				{ key: "berths", name: "Berths taken", value: "38 / 44" },
				{ key: "boats_in", name: "Boats in tonight", value: 12 },
				{ key: "ferry_next", name: "Next departure", value: 8, unit: " min" },
				{ key: "ferry_passengers", name: "Passengers", value: 42 },
			],
		},
		areas: AREAS,
		roads: ROADS,
		entities: [
			...towers,
			...backHouses,
			...warehouse,
			...promenadeLamps,
			...quayLamps,
			...pier,
			...marina,
			...traffic,
			...nature,
			...promenadeBenches,
			...upperTown,
			...headland,
			...harbourLanes,
			...terraceHouses,
			...ridgeCyclist,
			...gardens,
			...school,
		],
	} satisfies TSceneInput);
