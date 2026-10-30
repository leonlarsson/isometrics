import {
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TFenceInput,
	type TRoadInput,
	type TScene,
	type TSceneInput,
	type TVec2,
} from "#/scene/schema";

import { paint } from "./paint";
import { turned } from "./turned";

/*
 * Brightwater: a small harbour city that shows off most of the editor.
 *
 * The camera looks from the south-east (+X +Z), so the north-west is the back
 * of the picture: the hill and the tallest towers sit there, the sea and the
 * marina in the front-right corner. A river runs from the north edge into the
 * sea and splits downtown (west) from the logistics park (east).
 *
 * Beyond the logistics park to the east lies the old town (a high street with
 * shops, a café, a church, a school and a tram), and beyond the stadium to the
 * west, farmland (fields, a barn, greenhouses, an orchard and a tractor).
 *
 *   Areas: river and bay (one water area), beach, raised hill, plazas, park with a pond, stadium pitch, fields
 *   Roads: ring road (loop), bridge over the river, a flyover that climbs onto
 *          the hill, an embankment trail, a road through a tunnel that widens
 *          at the quay, and a hidden ferry route across the sea
 *   Fences: a railing along the marina, a chain-link fence round the logistics
 *          yard, a stone wall at the lookout, a hedge by the park and a
 *          paddock's rail fence
 *   Data:  labels and detail sheets on the city hall, stadium, ring road traffic,
 *          distribution centre, park, marina and ferry
 */

const RING_ID = "ring_road";
const BRIDGE_ID = "harbour_road";
const HILL_ROAD_ID = "hill_road";
const FERRY_ID = "ferry_route";
const HIGH_STREET_ID = "high_street";
const FARM_TRACK_ID = "farm_track";
const HILL_TRAIL_ID = "hill_trail";

/** Height of the raised hill in the north-west. */
const HILL = 2;

// ---------------------------------------------------------------- areas

const AREAS: TAreaInput[] = [
	{
		// One water area for the river and the bay, so they meet without a seam.
		id: "water",
		name: "River Bright and the bay",
		kind: "water_01",
		points: [
			// North edge, where the river enters
			[5.2, -24],
			[10, -24],
			// East bank, down to the quay
			[9.8, -16],
			[8.6, -9],
			[9.2, -3],
			[10.5, 1.5],
			// Round headland between the river mouth and the marina
			[12.4, 4.8],
			[14, 7.6],
			[15.6, 9.4],
			[17.4, 9.8],
			[19.4, 8.6],
			// Marina and the bay
			[21, 7],
			[24, 6.4],
			[30, 5.6],
			[50, 5.6],
			[50, 24],
			[-8, 24],
			// Coast along Long Beach, then up the west bank
			[-5.5, 21.4],
			[0, 19],
			[6, 17.6],
			[11, 15.4],
			[10.8, 12.8],
			[10, 9.5],
			[7.2, 4],
			[4.8, -2],
			[4.4, -9],
			[5.6, -16],
		],
	},
	{
		// Shares its sea edge and east end with the water's outline.
		id: "beach",
		name: "Long Beach",
		kind: "sand_01",
		points: [
			[-8, 24],
			[-10.6, 24],
			[-8.4, 20],
			[-3, 17],
			[3, 15.6],
			[8, 14.4],
			[10.5, 11.6],
			[10.8, 12.8],
			[11, 15.4],
			[6, 17.6],
			[0, 19],
			[-5.5, 21.4],
		],
	},
	{
		id: "hill",
		name: "Lookout Hill",
		kind: "raised_land_01",
		height: HILL,
		points: [
			[-50, -24],
			[-2, -24],
			[-2.4, -19.6],
			[-5.4, -15.6],
			[-12, -14.6],
			[-20, -15.2],
			[-25.4, -14.2],
			[-30, -14],
			[-50, -13.6],
		],
	},
	{
		id: "civic_square",
		name: "Civic Square",
		kind: "plaza_01",
		points: [
			[-20.6, -10.4],
			[-1.4, -10.4],
			[-1.4, -2],
			[-20.6, -2],
		],
	},
	{
		id: "park",
		name: "Riverside Park",
		kind: "grass_01",
		points: [
			[-20.6, -0.6],
			[-11, -0.6],
			[-10.2, 4],
			[-11, 8.6],
			// Rounded to follow the ring road's corner
			[-19, 8.5],
			[-20.126, 8.136],
			[-20.5, 7],
		],
	},
	{
		id: "pond",
		name: "Duck pond",
		kind: "water_01",
		points: [
			[-18.4, 3.2],
			[-17.2, 1.6],
			[-15, 1.4],
			[-13.6, 2.6],
			[-14, 4.4],
			[-15.8, 5.2],
			[-17.8, 4.8],
		],
	},
	{
		id: "pitch",
		name: "Stadium pitch",
		kind: "grass_01",
		colors: { surface: { color: "#7cc46a" } },
		points: [
			[-26, 14.4],
			[-16, 14.4],
			[-16, 20],
			[-26, 20],
		],
	},
	{
		id: "logistics_yard",
		name: "Logistics yard",
		kind: "plaza_01",
		points: [
			[12.6, -17],
			[29, -17],
			[29, -3.4],
			[11.2, -3.4],
		],
	},
	{
		// Runs along the river's east bank and the marina's edge of the water.
		id: "quay",
		name: "Marina quay",
		kind: "plaza_01",
		points: [
			[10.5, 1.5],
			[50, 1.4],
			[50, 5.6],
			[30, 5.6],
			[24, 6.4],
			[21, 7],
			[19.4, 8.6],
			[17.4, 9.8],
			[15.6, 9.4],
			[14, 7.6],
			[12.4, 4.8],
		],
	},
	{
		id: "wheat_field",
		name: "Wheat field",
		kind: "grass_01",
		colors: { surface: { color: "#d8c46a" } },
		points: [
			[-40.6, -10.4],
			[-35, -10.4],
			[-35, 2],
			[-40.6, 2],
		],
	},
	{
		// Hollow Wood's floor, beyond the farm track.
		id: "hollow_wood",
		name: "Hollow Wood",
		kind: "grass_01",
		colors: { surface: { color: "#7aa35c" } },
		points: [
			[-50, -13.6],
			[-42.4, -13.6],
			[-42.4, 24],
			[-50, 24],
		],
	},
	{
		id: "meadow",
		name: "Meadow",
		kind: "grass_01",
		colors: { surface: { color: "#8fbf5a" } },
		points: [
			[-40.6, 3.6],
			[-35, 3.6],
			[-35, 14.4],
			[-40.6, 14.4],
		],
	},
];

// ---------------------------------------------------------------- roads

const ROADS: TRoadInput[] = [
	{
		id: RING_ID,
		name: "Ring road",
		kind: "road_01",
		loops: true,
		cornerRadius: 4,
		points: [
			[-22, -12],
			[0, -12],
			[0, 10],
			[-22, 10],
		],
	},
	{
		// Leaves the ring road, crosses the river on a bridge, runs through the
		// harbour gate (a tunnel) and widens into a turning area on the quay.
		id: BRIDGE_ID,
		name: "Harbour road",
		kind: "road_01",
		cornerRadius: 2,
		points: [
			[1.2, -1],
			[5.5, -1, 1.3],
			[8.6, -1, 1.3],
			[14.5, -1],
			[26, -1],
			[26, 3.6, 0, 3.8],
		],
	},
	{
		// Climbs from Civic Square over the ring road on pillars, then onto the hill.
		id: HILL_ROAD_ID,
		name: "Hill road",
		kind: "road_01",
		cornerRadius: 4,
		points: [
			[-11, -3],
			[-11, -12, HILL],
			[-11, -17.6, HILL],
			[-27, -17.6, HILL],
		],
	},
	{
		// Walking trail up the west flank of the hill, on an earth bank.
		id: HILL_TRAIL_ID,
		name: "Hill trail",
		kind: "dirt_path_01",
		width: 1.2,
		// A single track: the cyclist rides down the middle.
		traffic: { drivingLane: "centre" },
		cornerRadius: 3,
		heldUpBy: "embankment",
		showsRailings: false,
		points: [
			[-23.2, 2],
			[-27.4, 2],
			[-27.4, -8, 0.8],
			[-26.4, -13.6, HILL],
			[-27, -16, HILL],
		],
	},
	{
		id: "beach_road",
		name: "Beach road",
		kind: "road_01",
		width: 2,
		cornerRadius: 3,
		points: [
			[-4, 11],
			[-4, 14.6],
			[6, 12.6],
		],
	},
	{
		// Invisible route across the bay for the ferry.
		id: FERRY_ID,
		name: "Ferry route",
		kind: "hidden_route_01",
		loops: true,
		cornerRadius: 6,
		// A loop round the bay.
		points: [
			[8.5, 22.5],
			[14, 18.5],
			[17.25, 19.25],
			[19.5, 20],
			[22, 19],
			[23, 14],
			[19.75, 12],
			[16.5, 12],
			[14, 16.5],
			[6, 19.5],
			[2.5, 19.5],
			[0.5, 20.5],
			[1, 22.5],
			[2.5, 23],
		],
	},
	{
		// The old town's high street, from the harbour north past the shops and the church.
		id: HIGH_STREET_ID,
		name: "High street",
		kind: "road_01",
		cornerRadius: 2.5,
		points: [
			[28, -1],
			[36, -1],
			[36, -22],
		],
	},
	{
		// Round the fields, for the tractor.
		id: FARM_TRACK_ID,
		name: "Farm track",
		kind: "dirt_path_01",
		width: 1.2,
		// One track: the tractor drives down the middle.
		traffic: { drivingLane: "centre" },
		loops: true,
		cornerRadius: 2,
		points: [
			[-34, -11.4],
			[-34, 15.4],
			[-41.4, 15.4],
			[-41.4, -11.4],
		],
	},
];

// ---------------------------------------------------------------- fences

const FENCES: TFenceInput[] = [
	{
		// Along the marina's edge of the water, behind the moored yachts.
		id: "marina_railing",
		name: "Marina railing",
		kind: "railing_01",
		points: [
			[40, 5.4],
			[30, 5.4],
			[24, 6.2],
			[21, 6.8],
			[19.3, 8.4],
			[17.4, 9.5],
		],
	},
	{
		id: "yard_fence",
		name: "Yard fence",
		kind: "chain_link_fence_01",
		points: [
			[13, -16.7],
			[28.7, -16.7],
			[28.7, -4.2],
		],
	},
	{
		// Just inside the hill's edge, by the lookout: it stands on the hilltop.
		id: "lookout_wall",
		name: "Lookout wall",
		kind: "stone_wall_01",
		points: [
			[-2.6, -23.6],
			[-2.9, -19.7],
			[-5.8, -16.2],
		],
	},
	// Along the park's edge by Civic Square, with a way in between the two.
	...[
		[-20.2, -17.2],
		[-14.2, -11.4],
	].map(([from, to], i) => ({
		id: `park_hedge_${i + 1}`,
		name: `Park hedge ${i + 1}`,
		kind: "hedge_01" as const,
		points: [
			[from, -0.25],
			[to, -0.25],
		] as TVec2[],
	})),
	{
		id: "paddock_fence",
		name: "Paddock fence",
		kind: "rail_fence_01",
		loops: true,
		points: [
			[-40.3, 3.9],
			[-35.3, 3.9],
			[-35.3, 14.1],
			[-40.3, 14.1],
		],
	},
];

// ---------------------------------------------------------------- entities

const towers: TEntityInput[] = [
	{
		id: "tower_meridian",
		kind: "office_tower_01",
		name: "Meridian Tower",
		position: [-18.8, -8],
		props: { width: 3.4, depth: 3.4, floorCount: 16 },
		details: { description: "The tallest building in Brightwater: offices and a sky bar." },
	},
	{
		id: "tower_north",
		kind: "office_tower_01",
		name: "Northgate offices",
		position: [-3.6, -8.4],
		colors: paint({ facade: "#4a64e0" }),
		props: { width: 3, depth: 3, floorCount: 8 },
	},
	{
		id: "tower_square",
		kind: "apartment_block_01",
		name: "Square apartments",
		position: [-3.6, -3.8],
		// Its balconies to the square.
		rotation: turned(180),
		colors: paint({ walls: "#c9b8e8" }),
		props: { width: 2.8, depth: 2.4, floorCount: 8 },
	},
	{
		id: "tower_park",
		kind: "apartment_block_01",
		name: "Parkside residences",
		position: [-4.2, 2.6],
		// Its balconies over the ring road to the park.
		rotation: turned(-90),
		colors: paint({ walls: "#efd9a0" }),
		props: { width: 3.2, depth: 2.6, floorCount: 10 },
	},
	{
		id: "tower_low",
		kind: "office_tower_01",
		name: "Library",
		position: [-7.6, 6.8],
		colors: paint({ facade: "#f07b4f" }),
		props: { width: 3.6, depth: 2.6, floorCount: 4 },
	},
];

const hillHouses: TEntityInput[] = ["#f07b4f", "#4a64e0", "#3cbf9a", "#e8b83a", "#8a5cf0"].map(
	(color, i) => ({
		id: `hill_house_${i}`,
		kind: "house_01",
		name: `Hill house ${i + 1}`,
		position: [-24 + i * 4, -21] as TVec2,
		altitude: HILL,
		colors: paint({ roof: color }),
		props: { showsChimney: i % 2 === 0 },
	}),
);

const beachHouses: TEntityInput[] = [
	[-12.7, 13.6],
	[-9.6, 15.2],
	[-12.2, 18.2],
].map(([x, z], i) => ({
	id: `beach_house_${i}`,
	kind: "house_01",
	name: `Beach house ${i + 1}`,
	position: [x, z] as TVec2,
	rotation: turned(90),
	colors: paint({ roof: ["#4a64e0", "#3cbf9a", "#f07b4f"][i] }),
}));

const stadium: TEntityInput[] = [
	{
		id: "stand_main",
		kind: "grandstand_01",
		name: "Main stand",
		position: [-21, 13.2],
		props: { length: 10, seatRowCount: 4 },
		label: {
			title: "Match day",
			dataKeys: ["attendance", "seats_filled"],
			offset: [-3, 2.5, 2],
		},
		details: {
			description: "Brightwater FC's home ground. Tonight: the harbour derby.",
			dataKeys: ["attendance", "seats_filled"],
		},
	},
	{
		id: "stand_south",
		kind: "grandstand_01",
		name: "South stand",
		position: [-21, 21.2],
		rotation: turned(180),
		props: { length: 10, seatRowCount: 3, showsRoof: false },
	},
	{
		id: "stand_west",
		kind: "grandstand_01",
		name: "West stand",
		position: [-27.2, 17.2],
		rotation: turned(90),
		props: { length: 5, seatRowCount: 3, showsRoof: false },
	},
	{
		id: "stand_east",
		kind: "grandstand_01",
		name: "East stand",
		position: [-14.8, 17.2],
		rotation: turned(-90),
		props: { length: 5, seatRowCount: 3, showsRoof: false },
	},
];

const logistics: TEntityInput[] = [
	{
		id: "distribution_centre",
		kind: "warehouse_01",
		name: "Distribution centre",
		position: [19, -11],
		props: { width: 10, depth: 6, height: 3, doorCount: 4 },
		label: {
			title: "Parcels today",
			dataKeys: ["parcels_today"],
			offset: [-4, 3, 1],
		},
		details: {
			description:
				"Parcels for the whole city are sorted here; the roof is covered in solar panels.",
			dataKeys: ["parcels_today", "solar_share"],
		},
	},
	{
		id: "truck_depot",
		kind: "depot_01",
		name: "Truck depot",
		position: [27, -12],
		rotation: turned(-90),
		props: { width: 4, depth: 3.4, height: 1.8 },
	},
	{
		id: "loading_dock",
		kind: "beacon_01",
		name: "Loading dock",
		position: [19, -6.4],
		props: { radius: 1.1 },
	},
	{ id: "parcels_a", kind: "parcel_stack_01", position: [15.6, -6.4], props: { parcelCount: 8 } },
	{ id: "parcels_b", kind: "parcel_stack_01", position: [22.4, -6], props: { parcelCount: 5 } },
	...[-7.4, -5.2].map((z, i) => ({
		id: `parked_truck_${i}`,
		kind: "truck_01",
		name: `Parked truck ${i + 1}`,
		position: [26.8, z] as TVec2,
	})),
];

const harbour: TEntityInput[] = [
	{
		id: "harbour_gate",
		kind: "tunnel_01",
		name: "Harbour gate",
		position: [20, -1],
		props: { length: 4, width: 3, height: 1.5, buildingHeight: 1 },
	},
	{
		id: "harbour_office",
		kind: "depot_01",
		name: "Harbour office",
		position: [19, 3.6],
		props: { width: 3.6, depth: 2.4, height: 1.6, showsGarageDoor: false },
		label: {
			title: "Marina",
			dataKeys: ["berths", "boats_in"],
			offset: [5, 1.5, 2.5],
		},
		details: {
			description: "Moorings for 60 boats, a fuel dock and the ferry terminal.",
			dataKeys: ["berths", "boats_in"],
		},
	},
	...[21.2, 23.6, 26, 28.4].map((x, i) => ({
		id: `moored_yacht_${i}`,
		kind: "yacht_01",
		name: `Moored yacht ${i + 1}`,
		position: [x, 8.6] as TVec2,
		rotation: turned(-90),
		props: { length: i === 2 ? 3.6 : 2.6, deckCount: i === 2 ? 2 : 1 },
	})),
	...[
		// Well clear of the ferry route.
		[13.5, 21.6, 30],
		[19.5, 16.5, -20],
	].map(([x, z, rotation], i) => ({
		id: `anchored_yacht_${i}`,
		kind: "yacht_01",
		name: `Anchored yacht ${i + 1}`,
		position: [x, z] as TVec2,
		rotation: turned(rotation),
		props: { length: 2.4, deckCount: 1 },
	})),
	{
		id: "ferry",
		kind: "ferry_01",
		name: "Bay ferry",
		colors: paint({ hull: "#4a64e0", funnel: "#e8b83a" }),
		props: { length: 4.6 },
		follow: { roadId: FERRY_ID, speed: 1.4, startDistance: 13 },
		// Its cabins glow brighter the more passengers it carries: 60 is 100% (ADR-0058).
		lights: { cabins: { data: { strength: { key: "ferry_passengers", valueAtFull: 60 } } } },
		label: {
			title: "Bay ferry",
			dataKeys: ["ferry_next", "ferry_passengers"],
			offset: [2, 2.4, 2],
		},
		details: {
			description: "Crosses the bay from the marina to Long Beach every half hour.",
			dataKeys: ["ferry_next", "ferry_passengers"],
		},
	},
	{
		id: "beach_cafe",
		kind: "cafe_01",
		name: "Beach café",
		position: [2, 17],
		// Facing the beach road, its terrace in front.
		rotation: turned(168),
		colors: paint({ walls: "#f3d98a", awning: "#3cbf9a" }),
		props: { width: 2.6, depth: 1.6 },
	},
	// Its terrace between the café and the beach road: tables and chairs, a parasol beside each.
	...[
		[0.4, 15.2],
		[2.2, 14.9],
		[4, 14.6],
	].flatMap(([x, z], i) => [
		{ id: `beach_table_${i}`, kind: "cafe_table_01", position: [x, z] as TVec2 },
		{
			id: `beach_parasol_${i}`,
			kind: "parasol_01",
			position: [x, z + 0.34] as TVec2,
			colors: paint({ canopy: ["#e2603b", "#3cbf9a", "#f2c230"][i] }),
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
	{
		id: "lighthouse",
		kind: "lighthouse_01",
		name: "Headland lighthouse",
		position: [15.8, 8],
		props: { height: 3.2 },
	},
	...[
		// Out on the bay, clear of the ferry route.
		[28.4, 12.8, -25],
		[34, 16, 15],
		[38, 9, 200],
	].map(([x, z, rotation], i) => ({
		id: `sailing_boat_${i}`,
		kind: "sailing_boat_01",
		name: `Sailing boat ${i + 1}`,
		position: [x, z] as TVec2,
		rotation: turned(rotation),
		colors: paint({ sails: [null, "#f2c230", null][i] }),
		props: { length: [2, 2.4, 1.8][i] },
	})),
];

const traffic: TEntityInput[] = [
	{
		id: "ring_car_1",
		kind: "car_01",
		name: "City car",
		colors: paint({ body: "#e05a4a" }),
		follow: { roadId: RING_ID, speed: 3.2, startDistance: 6 },
		label: {
			title: "Ring road",
			dataKeys: ["ring_speed", "ring_flow"],
			offset: [-2.5, 2.2, 2.5],
		},
		details: {
			description: "Live traffic on the ring road around downtown.",
			dataKeys: ["ring_speed", "ring_flow"],
		},
	},
	{
		id: "ring_car_2",
		kind: "car_01",
		name: "Taxi",
		colors: paint({ body: "#e8b83a" }),
		follow: { roadId: RING_ID, speed: 3, startDistance: 34 },
	},
	{
		id: "ring_van",
		kind: "delivery_van_01",
		name: "Delivery van",
		follow: { roadId: RING_ID, speed: 2.6, startDistance: 60 },
	},
	{
		id: "harbour_truck",
		kind: "truck_01",
		name: "Harbour truck",
		follow: { roadId: BRIDGE_ID, speed: 2.4, startDistance: 13 },
	},
	{
		id: "harbour_van",
		kind: "delivery_van_01",
		name: "Parcel van",
		colors: paint({ stripe: "#3cbf9a" }),
		follow: { roadId: BRIDGE_ID, speed: 2.8, startDistance: 23 },
	},
	{
		id: "hill_car",
		kind: "car_01",
		name: "Hill car",
		colors: paint({ body: "#4a64e0" }),
		follow: { roadId: HILL_ROAD_ID, speed: 2.6, startDistance: 24 },
	},
	{
		id: "beach_car",
		kind: "car_01",
		name: "Parked car",
		position: [3, 11.2],
		rotation: turned(170),
	},
];

const civic: TEntityInput[] = [
	{
		id: "city_hall",
		kind: "office_tower_01",
		name: "City hall",
		position: [-14.4, -6.8],
		// Turned so its long side runs north–south, leaving room for Meridian Tower.
		rotation: turned(90),
		colors: paint({ facade: "#e2cfa8" }),
		props: { width: 5, depth: 3.4, floorCount: 4 },
		label: {
			title: "Brightwater",
			dataKeys: ["population", "air_quality"],
			offset: [-4, 8, -3],
		},
		details: {
			description:
				"Seat of the city council. Brightwater is a harbour city of almost 50,000 people.",
			dataKeys: ["population", "air_quality", "energy_today"],
		},
	},
	...[-18.4, -14.6, -7.4].map((x, i) => ({
		id: `square_lamp_${i}`,
		kind: "street_lamp_01",
		position: [x, -3.4] as TVec2,
	})),
	{
		id: "park_oak",
		kind: "round_tree_01",
		name: "Old oak",
		position: [-12.6, 6.6],
		scale: 1.6,
		label: {
			title: "Riverside Park",
			dataKeys: ["park_visitors"],
			offset: [-2.5, 1.5, 2.5],
		},
		details: {
			description: "The city's park, with a duck pond and the old oak.",
			dataKeys: ["park_visitors"],
		},
	},
];

/** [x, z, size] for round trees. */
const TREES: [number, number, number][] = [
	[-19.4, 0.6, 1.1],
	[-19.6, 7.2, 1],
	[-16.6, 7.4, 1.2],
	[-12, 0.8, 0.9],
	[-15.6, -0.2, 0.8],
	[2.6, -6, 1],
	[2.8, 4, 1.1],
	[1.8, 8.4, 0.9],
	[-8, 12.8, 1],
	[-6.4, 18.8, 0.9],
	[14.2, -20, 1.1],
	[12.6, -14, 1],
	[12.4, 2.4, 0.9],
];

/** [x, z, size, altitude] for pines; the ones on the hill sit at HILL. */
const PINES: [number, number, number, number][] = [
	[-28.4, -22.4, 1.2, HILL],
	[-26, -23, 1, HILL],
	[-22, -23.2, 1.3, HILL],
	[-16.8, -23, 1.1, HILL],
	[-12.4, -23.4, 1.2, HILL],
	[-7.4, -23, 1, HILL],
	[-4.6, -20.4, 1.2, HILL],
	[-17.6, -15.6, 0.9, HILL],
	[-13.2, -15.4, 1, HILL],
	[17, -21.6, 1.2, 0],
	[20.4, -22.4, 1, 0],
	[24, -21.4, 1.3, 0],
	[27.6, -22.6, 1.1, 0],
	[28.4, -19, 1, 0],
	[-28.4, 11.4, 1, 0],
	[-28.6, 22.4, 1.2, 0],
];

const nature: TEntityInput[] = [
	...TREES.map(([x, z, size], i) => ({
		id: `tree_${i}`,
		kind: "round_tree_01",
		position: [x, z] as TVec2,
		scale: size,
	})),
	...PINES.map(([x, z, size, altitude], i) => ({
		id: `pine_${i}`,
		kind: "pine_tree_01",
		position: [x, z] as TVec2,
		altitude,
		scale: size,
	})),
	{
		id: "lookout",
		kind: "beacon_01",
		name: "Lookout point",
		position: [-5.6, -21.2],
		altitude: HILL,
		props: { radius: 0.9 },
		details: { description: "The best view of the bay, at the top of the hill road." },
	},
];

/** A small random of our own, the same every time, for nudging trees in the woods. */
const shake = (seed: number) => {
	const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

/**
 * A wood: trees on a grid across a rectangle, each nudged, sized and picked a
 * little differently (the same every time), never inside each other.
 */
const wood = (
	name: string,
	[x0, z0]: TVec2,
	[x1, z1]: TVec2,
	kinds: readonly string[],
	{ altitude = 0, spacing = 1.8 } = {},
): TEntityInput[] => {
	const trees: TEntityInput[] = [];
	let spot = 0;
	for (let x = x0 + spacing / 2; x < x1; x += spacing) {
		for (let z = z0 + spacing / 2; z < z1; z += spacing) {
			// Seeded by the spot on the grid (not the trees so far, which a gap doesn't count).
			spot += 1;
			const seed = spot * 13 + name.length * 101;
			// Leave a few gaps, so it isn't a plantation.
			if (shake(seed + 7) < 0.12) {
				continue;
			}
			trees.push({
				id: `${name}_${trees.length}`,
				kind: kinds[Math.floor(shake(seed + 3) * kinds.length)],
				position: [
					Math.round((x + (shake(seed) - 0.5) * 0.5) * 100) / 100,
					Math.round((z + (shake(seed + 1) - 0.5) * 0.5) * 100) / 100,
				],
				altitude,
				scale: Math.round((0.8 + shake(seed + 2) * 0.35) * 100) / 100,
			});
		}
	}
	return trees;
};

/** Woods at the edges: Hollow Wood beyond the farm, pines along the hill, a wood behind the old town. */
const woods: TEntityInput[] = [
	...wood(
		"hollow_wood",
		[-50, -12.8],
		[-42.6, 23.6],
		["pine_tree_01", "round_tree_01", "birch_01", "pine_tree_01"],
	),
	...wood("hill_pines", [-50, -23.8], [-31, -15.4], ["pine_tree_01"], { altitude: HILL }),
	...wood("east_wood", [42.6, -23.6], [50, -0.8], ["round_tree_01", "birch_01", "pine_tree_01"]),
];

/** Riverside Park: benches round the duck pond, flower beds, paths lit by bollards, more trees. */
const park: TEntityInput[] = [
	// Facing the pond (front +Z turned towards it).
	{ id: "park_bench_north", kind: "bench_01", position: [-16, 6.3], rotation: turned(180) },
	{ id: "park_bench_east", kind: "bench_01", position: [-12.5, 3.1], rotation: turned(-90) },
	{ id: "park_bench_west", kind: "bench_01", position: [-19.7, 2.6], rotation: turned(90) },
	{ id: "park_picnic", kind: "picnic_table_01", position: [-19.4, 5.6], rotation: turned(90) },
	{ id: "park_bin_1", kind: "bin_01", position: [-15.1, 6.6] },
	{ id: "park_bin_2", kind: "bin_01", position: [-12.4, 1.9] },
	{
		id: "park_flowers_1",
		kind: "flower_bed_01",
		position: [-11.7, 4.4],
		rotation: turned(90),
		props: { length: 1.8, width: 0.7 },
	},
	...[
		[-17.2, 6.4],
		[-13.9, 6.7],
		[-12.2, 2.5],
		[-17.4, 0.6],
		[-20, 4.3],
	].map(([x, z], i) => ({
		id: `park_bollard_${i}`,
		kind: "bollard_light_01",
		position: [x, z] as TVec2,
	})),
	{ id: "park_birch_1", kind: "birch_01", position: [-20.1, 3.4], scale: 1.1 },
	{ id: "park_birch_2", kind: "birch_01", position: [-11.3, 7.9], scale: 0.9 },
	{ id: "park_broad_tree", kind: "round_tree_02", position: [-14.1, 7.9], scale: 1 },
	{ id: "park_bush_1", kind: "bush_01", position: [-18.9, 2], scale: 0.8 },
	{ id: "park_bush_2", kind: "bush_01", position: [-13.3, 4.9], scale: 0.7 },
	{ id: "park_reeds", kind: "tall_grass_01", position: [-17.9, 4.3], scale: 1 },
];

/**
 * The old town east of the logistics park: a high street running north from the
 * harbour, terraced houses and shops on its west side, the church, the school and
 * a block of flats on its east side, old-town lanterns, and the tram up and down it.
 */
const oldTown: TEntityInput[] = [
	// West side, fronts to the street (+X).
	{
		id: "old_town_terrace",
		kind: "terraced_row_01",
		name: "Mill Lane terrace",
		position: [33.2, -19],
		rotation: turned(90),
		props: { houseCount: 4 },
	},
	{
		id: "old_town_grocer",
		kind: "shop_01",
		name: "Corner grocer",
		position: [33.2, -14.6],
		rotation: turned(90),
	},
	{
		id: "old_town_bakery",
		kind: "shop_02",
		name: "Bakery",
		position: [33.2, -12.4],
		rotation: turned(90),
		colors: paint({ walls: "#e3c9a2", awning: "#8a5cf0" }),
	},
	{
		id: "old_town_books",
		kind: "shop_02",
		name: "Bookshop",
		position: [33.2, -10.9],
		rotation: turned(90),
		colors: paint({ walls: "#9cc4d8", awning: "#2f7a5d" }),
		props: { floorCount: 4 },
	},
	{
		id: "old_town_cafe",
		kind: "cafe_01",
		name: "Harbour café",
		position: [33, -4.6],
		rotation: turned(90),
		props: { width: 2.4 },
	},
	// The café's terrace, south of it towards the harbour.
	...[
		[32.6, -2.7],
		[34.2, -2.7],
	].flatMap(([x, z], i) => [
		{ id: `old_town_table_${i}`, kind: "cafe_table_01", position: [x, z] as TVec2 },
		{ id: `old_town_parasol_${i}`, kind: "parasol_01", position: [x + 0.34, z] as TVec2 },
		{ id: `old_town_chair_${i}a`, kind: "chair_01", position: [x, z - 0.32] as TVec2 },
		{
			id: `old_town_chair_${i}b`,
			kind: "chair_01",
			position: [x, z + 0.32] as TVec2,
			rotation: turned(180),
		},
	]),
	{
		id: "old_town_planter",
		kind: "planter_01",
		position: [33.4, -7.2],
		rotation: turned(90),
		props: { length: 1.4 },
	},
	// East side, fronts to the street (-X).
	{
		id: "old_town_church",
		kind: "church_01",
		name: "St Brigid's",
		position: [39.4, -19],
		rotation: turned(-90),
		props: { towerHeight: 4 },
	},
	{
		id: "old_town_school",
		kind: "school_01",
		name: "Harbour school",
		position: [39.2, -12.4],
		rotation: turned(-90),
	},
	{
		id: "old_town_flats",
		kind: "apartment_block_01",
		name: "Quayside flats",
		position: [39.6, -5.6],
		rotation: turned(-90),
		props: { width: 3.6, depth: 2.2, floorCount: 6 },
	},
	// Lanterns down both sides of the street.
	...[-20, -16, -12, -8, -4].flatMap((z, i) => [
		{ id: `old_town_lantern_w${i}`, kind: "street_lamp_02", position: [34.7, z] as TVec2 },
		{ id: `old_town_lantern_e${i}`, kind: "street_lamp_02", position: [37.3, z + 2] as TVec2 },
	]),
	{ id: "old_town_cypress", kind: "cypress_01", position: [41.2, -21.6], scale: 1.1 },
	{ id: "old_town_birch", kind: "birch_01", position: [41.2, -9.2] },
];

/**
 * Farmland west of the stadium: a wheat field and a meadow inside the farm track,
 * the barn and greenhouses beside it, an orchard, and rough ground at the edges.
 */
const farmland: TEntityInput[] = [
	{
		id: "farm_barn",
		kind: "barn_01",
		name: "Hollow Farm barn",
		position: [-31.4, 5.6],
		rotation: turned(-90),
	},
	{ id: "farm_greenhouse_1", kind: "greenhouse_01", position: [-31.6, -0.6] },
	{
		id: "farm_greenhouse_2",
		kind: "greenhouse_01",
		position: [-31.6, -4.2],
		props: { width: 1.8, depth: 3 },
	},
	// The orchard, in rows.
	...[9.4, 11.4, 13.4].flatMap((z, row) =>
		[-32.6, -30.8].map((x, column) => ({
			id: `farm_fruit_tree_${row}_${column}`,
			kind: "fruit_tree_01",
			position: [x, z] as TVec2,
			scale: 0.9,
			colors: paint({ fruit: row === 1 ? "#f2c230" : null }),
		})),
	),
	{ id: "farm_dead_tree", kind: "dead_tree_01", position: [-39.6, 19.4], scale: 1.2 },
	{
		id: "farm_log",
		kind: "log_01",
		position: [-37.6, 19.8],
		rotation: turned(20),
		props: { length: 1.2 },
	},
	{ id: "farm_rocks", kind: "rocks_01", position: [-35.4, 21], props: { rockCount: 4 } },
	...[
		[-41, 18.4],
		[-36.6, 17.6],
		[-33, 19.6],
		[-40.8, 22],
	].map(([x, z], i) => ({
		id: `farm_tall_grass_${i}`,
		kind: "tall_grass_01",
		position: [x, z] as TVec2,
	})),
	{ id: "farm_bush_1", kind: "bush_01", position: [-34.4, 21.8] },
];

/** More traffic: a bus round the ring road, the tram on the high street, a tractor, a cyclist. */
const moreTraffic: TEntityInput[] = [
	{
		id: "ring_bus",
		kind: "bus_01",
		name: "Route 4 bus",
		follow: { roadId: RING_ID, speed: 2.2, startDistance: 20 },
	},
	{
		id: "old_town_tram",
		kind: "tram_01",
		name: "Harbour tram",
		follow: { roadId: HIGH_STREET_ID, speed: 1.6, startDistance: 6 },
	},
	{
		id: "farm_tractor",
		kind: "tractor_01",
		name: "Tractor",
		follow: { roadId: FARM_TRACK_ID, speed: 1.2, startDistance: 4 },
	},
	{
		id: "hill_cyclist",
		kind: "bicycle_01",
		name: "Cyclist",
		colors: paint({ riderTop: "#e2603b" }),
		follow: { roadId: HILL_TRAIL_ID, speed: 1, startDistance: 2 },
	},
];

/** Starter template: a harbour city with a river, a hill, a stadium, a marina and live city data. */
export const createBrightwaterScene = (): TScene => {
	return SceneSchema.parse({
		version: SCENE_VERSION,
		meta: {
			title: "Brightwater",
			subtitle: "City operations at a glance",
		},
		theme: "system",
		ground: { width: 100, depth: 48 },
		traffic: { drivingSide: "right" },
		// Deeper shade than the theme's own balance (ADR-0072).
		lighting: { sunShadeContrast: 0.75 },
		// Stepped through in View mode (◀ ▶), like slides.
		viewpoints: [
			{
				id: "view_overview",
				name: "Overview",
				description: "Brightwater at a glance, with the city's live numbers.",
				target: [0, 0],
				span: 74,
			},
			{
				id: "view_downtown",
				name: "Downtown",
				description: "City hall and the towers inside the ring road.",
				target: [-6, -4],
				azimuth: 300,
				elevation: 38,
				span: 32,
				projection: "perspective",
			},
			{
				id: "view_stadium",
				name: "Stadium",
				description: "Match day: attendance and how full the stands are.",
				target: [-21, 12],
				azimuth: 345,
				elevation: 34,
				span: 24,
			},
			{
				id: "view_old_town",
				name: "Old town",
				description: "The high street: shops, the café terrace, the church and the tram.",
				target: [36, -10],
				azimuth: 300,
				elevation: 32,
				span: 22,
				projection: "perspective",
			},
			{
				id: "view_farmland",
				name: "Farmland",
				description: "Fields, the barn, the greenhouses and Hollow Wood, west of the stadium.",
				target: [-40, 2],
				azimuth: 320,
				elevation: 34,
				span: 32,
			},
			{
				id: "view_marina",
				name: "Marina",
				description: "Berths taken and boats in today.",
				target: [16, 11],
				azimuth: 290,
				elevation: 30,
				span: 22,
				projection: "perspective",
			},
		],
		data: {
			values: [
				{ key: "population", name: "Population", value: 48210 },
				{ key: "air_quality", name: "Air quality", value: "Good" },
				{ key: "energy_today", name: "Energy today", value: 312, unit: " MWh" },
				{ key: "ring_speed", name: "Avg. speed", value: 38, unit: " km/h" },
				{ key: "ring_flow", name: "Cars per hour", value: 1240 },
				{ key: "parcels_today", name: "Parcels today", value: 2340 },
				{ key: "solar_share", name: "Solar share", value: 34, unit: "%" },
				{ key: "attendance", name: "Attendance", value: 18400 },
				{ key: "seats_filled", name: "Seats filled", value: 92, unit: "%" },
				{ key: "berths", name: "Berths taken", value: "41 / 60" },
				{ key: "boats_in", name: "Boats in today", value: 7 },
				{ key: "ferry_next", name: "Next departure", value: 12, unit: " min" },
				{ key: "ferry_passengers", name: "Passengers", value: 86 },
				{ key: "park_visitors", name: "Visitors today", value: 1260 },
			],
		},
		areas: AREAS,
		roads: ROADS,
		fences: FENCES,
		entities: [
			...civic,
			...towers,
			...stadium,
			...logistics,
			...harbour,
			...traffic,
			...hillHouses,
			...beachHouses,
			...nature,
			...park,
			...oldTown,
			...farmland,
			...woods,
			...moreTraffic,
		],
	} satisfies TSceneInput);
};
