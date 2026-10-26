import {
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TRoadInput,
	type TScene,
	type TVec2,
} from "#/scene/schema";

import { paint } from "./paint";

/*
 * Lantern Bay: a waterfront that shows off the look (ADR-0072 to ADR-0077),
 * best with Preferences → Graphics → Ultra. Its day runs from golden hour into
 * night while motion plays.
 *
 * The camera looks from the south (+Z), so the north is the back of the
 * picture: houses on a hill there, lit towers inside the waterfront loop road,
 * a promenade of lamps along the beach, and the bay in front. A breakwater
 * pier with a beacon closes off a mirror-calm harbour basin, full of moored
 * yachts, from the rippling bay, where a ferry crosses.
 *
 *   Areas: the bay, the calm harbour basin, a beach, the promenade, the pier, the hill
 *   Roads: the waterfront loop, and a hidden ferry route across the bay
 *   Data:  the town's evening, the offices still at work, the marina and the ferry
 */

const LOOP_ID = "waterfront_loop";
const FERRY_ID = "ferry_route";

/** Height of the hill at the back, and of the breakwater pier. */
const HILL = 1.6;
const PIER = 0.5;

// ---------------------------------------------------------------- areas

const AREAS: TAreaInput[] = [
	{
		id: "bay",
		name: "Lantern Bay",
		type: "water_01",
		points: [
			[-22, 4],
			[-12, 3.2],
			[-2, 4.2],
			[2, 6],
			[17, 6],
			[17, 1],
			[22, 1],
			[22, 18],
			[-22, 18],
		],
	},
	{
		// Sheltered by the pier: still enough to mirror the yachts and the town.
		id: "basin",
		name: "Harbour basin",
		type: "water_01",
		rippleStrength: 0.06,
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
		type: "sand_01",
		points: [
			[-22, 1.6],
			[2, 1.6],
			[2, 6],
			[-2, 4.2],
			[-12, 3.2],
			[-22, 4],
		],
	},
	{
		id: "promenade",
		name: "Promenade",
		type: "plaza_01",
		points: [
			[-22, -1.6],
			[17, -1.6],
			[17, 0],
			[2, 0],
			[2, 1.6],
			[-22, 1.6],
		],
	},
	{
		id: "pier",
		name: "Breakwater",
		type: "raised_land_01",
		height: PIER,
		points: [
			[17, -1.6],
			[18.4, -1.6],
			[18.4, 13],
			[17, 13],
		],
	},
	{
		id: "hill",
		name: "Lantern Hill",
		type: "raised_land_01",
		height: HILL,
		points: [
			[-22, -18],
			[-5, -18],
			[-6.5, -15.4],
			[-22, -15.4],
		],
	},
	{
		id: "square",
		name: "Tower square",
		type: "plaza_01",
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
		style: "road_01",
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
		style: "hidden_route_01",
		loops: true,
		cornerRadius: 3,
		points: [
			[-14, 9],
			[10, 9.5],
			[12, 15.5],
			[-16, 15.5],
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
		windows: { data: { litPanes: { key: "offices_at_work", valueAtFull: 100 } } },
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

const hillHouses: TEntityInput[] = [
	"#f07b4f",
	"#4a64e0",
	"#3cbf9a",
	"#e8b83a",
	"#8a5cf0",
	"#e05a4a",
].map((roof, i) => ({
	id: `hill_house_${i}`,
	kind: "house_01",
	name: `Hill house ${i + 1}`,
	position: [-20.4 + i * 2.6, -16.6] as TVec2,
	elevation: HILL,
	colors: paint({ roof }),
}));

const warehouse: TEntityInput[] = [
	{
		id: "fish_hall",
		kind: "warehouse_01",
		name: "Fish hall",
		position: [18.5, -11],
		props: { width: 6.4, depth: 4, height: 2.6, doorCount: 3, showSolarPanels: true },
	},
	{ id: "hall_truck", kind: "truck_01", name: "Fish truck", position: [17, -6.4], rotation: 90 },
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
		elevation: PIER,
	})),
	{
		id: "pier_beacon",
		kind: "beacon_01",
		name: "Pier beacon",
		position: [17.7, 12.4],
		elevation: PIER,
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
		props: { width: 2.6, depth: 1.6, height: 1.2, showGarageDoor: false },
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
		rotation: -90,
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
		rotation,
		props: { length: 2.6, deckCount: 1 },
	})),
	// Out in the bay, clear of the ferry line.
	...[
		[-8, 12.2, 30],
		[4, 12.6, -20],
		[-18, 12, 12],
	].map(([x, z, rotation], i) => ({
		id: `bay_yacht_${i}`,
		kind: "yacht_01",
		name: `Bay yacht ${i + 1}`,
		position: [x, z] as TVec2,
		rotation,
		colors: paint({ stripe: ["#e05a4a", "#2bb58c", "#e8b83a"][i] }),
		props: { length: 2.8, deckCount: 2 },
	})),
	{
		id: "ferry",
		kind: "yacht_01",
		name: "Bay ferry",
		colors: paint({ hull: "#ffffff", stripe: "#e8b83a" }),
		props: { length: 4.4, deckCount: 2 },
		follow: { roadId: FERRY_ID, speed: 1.3, offset: 6 },
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
		kind: "depot_01",
		name: "Beach café",
		position: [-6, 2.8],
		rotation: -8,
		colors: paint({ walls: "#f07b4f" }),
		props: { width: 2.4, depth: 1.6, height: 1.1, showGarageDoor: false },
	},
];

const traffic: TEntityInput[] = [
	{
		id: "loop_car_1",
		kind: "car_01",
		name: "Taxi",
		colors: paint({ body: "#e8b83a" }),
		follow: { roadId: LOOP_ID, speed: 3, offset: 4 },
	},
	{
		id: "loop_car_2",
		kind: "car_01",
		name: "Red car",
		colors: paint({ body: "#e05a4a" }),
		follow: { roadId: LOOP_ID, speed: 3.3, offset: 30 },
	},
	{
		id: "loop_van",
		kind: "delivery_van_01",
		name: "Delivery van",
		follow: { roadId: LOOP_ID, speed: 2.6, offset: 52 },
	},
	{
		id: "loop_car_3",
		kind: "car_01",
		name: "Blue car",
		colors: paint({ body: "#4a64e0" }),
		follow: { roadId: LOOP_ID, speed: 2.9, offset: 72 },
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
		props: { size: 0.9 + (i % 3) * 0.15 },
	})),
	...[
		[-21, -15.9],
		[-14.4, -15.8],
		[-7.6, -16.6],
		[-19, -17.6],
		[-10.4, -17.6],
	].map(([x, z], i) => ({
		id: `pine_${i}`,
		kind: "pine_tree_01",
		position: [x, z] as TVec2,
		elevation: HILL,
		props: { size: 0.9 + (i % 2) * 0.3 },
	})),
];

export const createLanternBayScene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: {
			title: "Lantern Bay",
			subtitle: "An evening on the waterfront",
		},
		theme: "system",
		ground: { width: 44, depth: 36, color: null },
		drivingSide: "right",
		// From golden hour into the night, a day in five minutes while motion plays (ADR-0052).
		lighting: { time: 18.3, timeSource: "cycle", dayLength: 300, sunShadeContrast: 0.75 },
		sky: { cloudCover: 0.2, starDensity: 0.9 },
		water: { rippleStrength: 0.45 },
		camera: {
			openingViewpointId: "view_bay",
			lowestElevation: 5,
			tiltShiftOn: true,
			tiltShiftBlur: 0.45,
			tiltShiftFocus: 0.38,
		},
		viewpoints: [
			{
				id: "view_bay",
				name: "From the bay",
				description: "The town across the water, its lights in the bay.",
				target: [-2, -4],
				azimuth: 270,
				elevation: 10,
				span: 30,
				projection: "perspective",
			},
			{
				id: "view_overview",
				name: "Overview",
				description: "Lantern Bay at a glance, with its evening in numbers.",
				target: [0, -1],
				span: 40,
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
			},
		],
		data: [
			{ key: "evening_visitors", label: "Visitors tonight", value: 3400 },
			{ key: "restaurants_open", label: "Restaurants open", value: 18 },
			{ key: "offices_at_work", label: "Offices at work", value: 35, unit: "%" },
			{ key: "berths", label: "Berths taken", value: "38 / 44" },
			{ key: "boats_in", label: "Boats in tonight", value: 12 },
			{ key: "ferry_next", label: "Next departure", value: 8, unit: " min" },
			{ key: "ferry_passengers", label: "Passengers", value: 42 },
		],
		areas: AREAS,
		roads: ROADS,
		entities: [
			...towers,
			...hillHouses,
			...warehouse,
			...promenadeLamps,
			...quayLamps,
			...pier,
			...marina,
			...traffic,
			...nature,
		],
	});
