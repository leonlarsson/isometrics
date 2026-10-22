import {
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TRoadInput,
	type TScene,
	type TVec2,
} from "#/scene/schema";

/*
 * Brightwater: a small harbour city that shows off most of the editor.
 *
 * The camera looks from the south-east (+X +Z), so the north-west is the back
 * of the picture: the hill and the tallest towers sit there, the sea and the
 * marina in the front-right corner. A river runs from the north edge into the
 * sea and splits downtown (west) from the logistics park (east).
 *
 *   Areas: river and bay (one water area), beach, raised hill, plazas, park with a pond, stadium pitch
 *   Roads: ring road (loop), bridge over the river, a flyover that climbs onto
 *          the hill, an embankment trail, a road through a tunnel that widens
 *          at the quay, and a hidden ferry route across the sea
 *   Data:  labels and detail sheets on the city hall, stadium, ring road traffic,
 *          distribution centre, park, marina and ferry
 */

const RING_ID = "ring_road";
const BRIDGE_ID = "harbour_road";
const HILL_ROAD_ID = "hill_road";
const FERRY_ID = "ferry_route";

/** Height of the raised hill in the north-west. */
const HILL = 2;

// ---------------------------------------------------------------- areas

const AREAS: TAreaInput[] = [
	{
		// One water area for the river and the bay, so they meet without a seam.
		id: "water",
		name: "River Bright and the bay",
		type: "water",
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
			[30, 24],
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
		type: "sand",
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
		type: "land",
		height: HILL,
		points: [
			[-30, -24],
			[-2, -24],
			[-2.4, -19.6],
			[-5.4, -15.6],
			[-12, -14.6],
			[-20, -15.2],
			[-25.4, -14.2],
			[-30, -14],
		],
	},
	{
		id: "civic_square",
		name: "Civic Square",
		type: "plaza",
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
		type: "grass",
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
		type: "water",
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
		type: "grass",
		color: "#7cc46a",
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
		type: "plaza",
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
		type: "plaza",
		points: [
			[10.5, 1.5],
			[30, 1.4],
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
];

// ---------------------------------------------------------------- roads

const ROADS: TRoadInput[] = [
	{
		id: RING_ID,
		name: "Ring road",
		style: "asphalt",
		closed: true,
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
		style: "asphalt",
		cornerRadius: 3,
		points: [
			[1.2, -1],
			[3, -1, 1.3],
			[10.6, -1, 1.3],
			[13, -1],
			[26, -1],
			[26, 3.6, 0, 3.8],
		],
	},
	{
		// Climbs from Civic Square over the ring road on pillars, then onto the hill.
		id: HILL_ROAD_ID,
		name: "Hill road",
		style: "asphalt",
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
		id: "hill_trail",
		name: "Hill trail",
		style: "dirt",
		width: 1.2,
		cornerRadius: 3,
		supports: "embankment",
		railings: false,
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
		style: "asphalt",
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
		style: "hidden",
		closed: true,
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
];

// ---------------------------------------------------------------- entities

const towers: TEntityInput[] = [
	{
		id: "tower_meridian",
		kind: "tower",
		name: "Meridian Tower",
		position: [-18.8, -8],
		props: { width: 3.4, depth: 3.4, floors: 16 },
		details: { description: "The tallest building in Brightwater: offices and a sky bar." },
	},
	{
		id: "tower_north",
		kind: "tower",
		name: "Northgate offices",
		position: [-3.6, -8.4],
		color: "#4a64e0",
		props: { width: 3, depth: 3, floors: 8 },
	},
	{
		id: "tower_square",
		kind: "tower",
		name: "Square apartments",
		position: [-3.6, -3.8],
		color: "#8a5cf0",
		props: { width: 2.8, depth: 2.8, floors: 9 },
	},
	{
		id: "tower_park",
		kind: "tower",
		name: "Parkside residences",
		position: [-4.2, 2.6],
		color: "#e8b83a",
		props: { width: 3.2, depth: 3.2, floors: 11 },
	},
	{
		id: "tower_low",
		kind: "tower",
		name: "Library",
		position: [-7.6, 6.8],
		color: "#f07b4f",
		props: { width: 3.6, depth: 2.6, floors: 4 },
	},
];

const hillHouses: TEntityInput[] = ["#f07b4f", "#4a64e0", "#3cbf9a", "#e8b83a", "#8a5cf0"].map(
	(color, i) => ({
		id: `hill_house_${i}`,
		kind: "house",
		name: `Hill house ${i + 1}`,
		position: [-24 + i * 4, -21] as TVec2,
		elevation: HILL,
		color,
		props: { chimney: i % 2 === 0 },
	}),
);

const beachHouses: TEntityInput[] = [
	[-13, 13.6],
	[-9.6, 15.2],
	[-12.2, 18.2],
].map(([x, z], i) => ({
	id: `beach_house_${i}`,
	kind: "house",
	name: `Beach house ${i + 1}`,
	position: [x, z] as TVec2,
	rotation: 90,
	color: ["#4a64e0", "#3cbf9a", "#f07b4f"][i],
}));

const stadium: TEntityInput[] = [
	{
		id: "stand_main",
		kind: "grandstand",
		name: "Main stand",
		position: [-21, 13.2],
		props: { length: 10, rows: 4 },
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
		kind: "grandstand",
		name: "South stand",
		position: [-21, 21.2],
		rotation: 180,
		props: { length: 10, rows: 3, roof: false },
	},
	{
		id: "stand_west",
		kind: "grandstand",
		name: "West stand",
		position: [-27.2, 17.2],
		rotation: 90,
		props: { length: 5, rows: 3, roof: false },
	},
	{
		id: "stand_east",
		kind: "grandstand",
		name: "East stand",
		position: [-14.8, 17.2],
		rotation: -90,
		props: { length: 5, rows: 3, roof: false },
	},
];

const logistics: TEntityInput[] = [
	{
		id: "distribution_centre",
		kind: "warehouse",
		name: "Distribution centre",
		position: [19, -11],
		props: { width: 10, depth: 6, height: 3, doors: 4 },
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
		kind: "shed",
		name: "Truck depot",
		position: [27, -12],
		rotation: -90,
		props: { width: 4, depth: 3.4, height: 1.8 },
	},
	{
		id: "loading_dock",
		kind: "beacon",
		name: "Loading dock",
		position: [19, -6.4],
		props: { radius: 1.1 },
	},
	{ id: "parcels_a", kind: "parcels", position: [15.6, -6.4], props: { count: 8 } },
	{ id: "parcels_b", kind: "parcels", position: [22.4, -6], props: { count: 5 } },
	...[-7.4, -5.2].map((z, i) => ({
		id: `parked_truck_${i}`,
		kind: "truck",
		name: `Parked truck ${i + 1}`,
		position: [26.8, z] as TVec2,
	})),
];

const harbour: TEntityInput[] = [
	{
		id: "harbour_gate",
		kind: "tunnel",
		name: "Harbour gate",
		position: [20, -1],
		props: { length: 4, width: 3, height: 1.5, building: 1 },
	},
	{
		id: "harbour_office",
		kind: "shed",
		name: "Harbour office",
		position: [19, 3.6],
		props: { width: 3.6, depth: 2.4, height: 1.6, garageDoor: false },
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
		kind: "yacht",
		name: `Moored yacht ${i + 1}`,
		position: [x, 8.6] as TVec2,
		rotation: -90,
		props: { length: i === 2 ? 3.6 : 2.6, decks: i === 2 ? 2 : 1 },
	})),
	...[
		// Well clear of the ferry route.
		[13.5, 21.6, 30],
		[19.5, 16.5, -20],
	].map(([x, z, rotation], i) => ({
		id: `anchored_yacht_${i}`,
		kind: "yacht",
		name: `Anchored yacht ${i + 1}`,
		position: [x, z] as TVec2,
		rotation,
		props: { length: 2.4, decks: 1 },
	})),
	{
		id: "ferry",
		kind: "yacht",
		name: "Bay ferry",
		color: "#ffffff",
		accent: "#4a64e0",
		props: { length: 4, decks: 2 },
		follow: { roadId: FERRY_ID, speed: 1.4, offset: 13 },
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
		kind: "shed",
		name: "Beach café",
		position: [2, 17],
		rotation: -12,
		color: "#e8b83a",
		props: { width: 2.4, depth: 1.8, height: 1.2, garageDoor: false },
	},
];

const traffic: TEntityInput[] = [
	{
		id: "ring_car_1",
		kind: "car",
		name: "City car",
		color: "#e05a4a",
		follow: { roadId: RING_ID, speed: 3.2, offset: 6 },
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
		kind: "car",
		name: "Taxi",
		color: "#e8b83a",
		follow: { roadId: RING_ID, speed: 3, offset: 34 },
	},
	{
		id: "ring_van",
		kind: "van",
		name: "Delivery van",
		follow: { roadId: RING_ID, speed: 2.6, offset: 60 },
	},
	{
		id: "harbour_truck",
		kind: "truck",
		name: "Harbour truck",
		follow: { roadId: BRIDGE_ID, speed: 2.4, offset: 13 },
	},
	{
		id: "harbour_van",
		kind: "van",
		name: "Parcel van",
		accent: "#3cbf9a",
		follow: { roadId: BRIDGE_ID, speed: 2.8, offset: 23 },
	},
	{
		id: "hill_car",
		kind: "car",
		name: "Hill car",
		color: "#4a64e0",
		follow: { roadId: HILL_ROAD_ID, speed: 2.6, offset: 24 },
	},
	{ id: "beach_car", kind: "car", name: "Parked car", position: [3, 11.2], rotation: 170 },
];

const civic: TEntityInput[] = [
	{
		id: "city_hall",
		kind: "tower",
		name: "City hall",
		position: [-14.4, -6.8],
		// Turned so its long side runs north–south, leaving room for Meridian Tower.
		rotation: 90,
		color: "#e2cfa8",
		props: { width: 5, depth: 3.4, floors: 4 },
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
		kind: "lamp",
		position: [x, -3.4] as TVec2,
	})),
	{
		id: "park_oak",
		kind: "tree",
		name: "Old oak",
		position: [-12.6, 6.6],
		props: { size: 1.6 },
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

/** [x, z, size, elevation] for pines; the ones on the hill sit at HILL. */
const PINES: [number, number, number, number][] = [
	[-28.4, -22.4, 1.2, HILL],
	[-26, -23, 1, HILL],
	[-22, -23.2, 1.3, HILL],
	[-16.8, -23, 1.1, HILL],
	[-12.4, -23.4, 1.2, HILL],
	[-7.4, -22.6, 1, HILL],
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
		kind: "tree",
		position: [x, z] as TVec2,
		props: { size },
	})),
	...PINES.map(([x, z, size, elevation], i) => ({
		id: `pine_${i}`,
		kind: "pine",
		position: [x, z] as TVec2,
		elevation,
		props: { size },
	})),
	{
		id: "lookout",
		kind: "beacon",
		name: "Lookout point",
		position: [-5.6, -21.2],
		elevation: HILL,
		props: { radius: 0.9 },
		details: { description: "The best view of the bay, at the top of the hill road." },
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
		ground: { width: 60, depth: 48, color: null },
		driving: "right",
		data: [
			{ key: "population", label: "Population", value: 48210 },
			{ key: "air_quality", label: "Air quality", value: "Good" },
			{ key: "energy_today", label: "Energy today", value: 312, unit: " MWh" },
			{ key: "ring_speed", label: "Avg. speed", value: 38, unit: " km/h" },
			{ key: "ring_flow", label: "Cars per hour", value: 1240 },
			{ key: "parcels_today", label: "Parcels today", value: 2340 },
			{ key: "solar_share", label: "Solar share", value: 34, unit: "%" },
			{ key: "attendance", label: "Attendance", value: 18400 },
			{ key: "seats_filled", label: "Seats filled", value: 92, unit: "%" },
			{ key: "berths", label: "Berths taken", value: "41 / 60" },
			{ key: "boats_in", label: "Boats in today", value: 7 },
			{ key: "ferry_next", label: "Next departure", value: 12, unit: " min" },
			{ key: "ferry_passengers", label: "Passengers", value: 86 },
			{ key: "park_visitors", label: "Visitors today", value: 1260 },
		],
		areas: AREAS,
		roads: ROADS,
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
		],
	});
};
