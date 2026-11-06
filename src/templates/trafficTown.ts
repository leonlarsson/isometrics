import {
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TDataBindingInput,
	type TEntityInput,
	type TLightingInput,
	type TMoodInput,
	type TRoadInput,
	type TScene,
	type TSceneInput,
	type TVec2,
} from "#/scene/schema";

import { paint } from "./paint";
import { turned } from "./turned";

/*
 * Traffic town: a small town that shows every part of the traffic simulation,
 * a viewpoint for each, and a tour through them.
 *
 * The camera looks from the south-east (+X +Z), so the north-west is the back
 * of the picture. The River Wend runs from the north edge into a bay in the
 * front-right corner, the town on its west bank, the port on its east.
 *
 *   Junctions: a crossroads with traffic lights (High Street, Bridge Street,
 *     School Lane and Church Street), two Ts (Mill Lane's ends) and one on the
 *     east bank where Harbour Road, a loop cut open, meets Bridge Street.
 *     Corners: Church Street's and Orchard Road's bends. A dead end: School Lane.
 *   Background traffic: flows that drive on through junctions (ADR-0147): cars,
 *     vans, trucks and a bus, on several streets.
 *   A data flow: Freight Road, from the depot to the port, on its own, its width
 *     and lorries from the freight table (example numbers, ADR-0112).
 *   Vehicles that follow a road: the Route 7 bus (select it, follow it, ride
 *     along), and a post van kept to Orchard Road with Drive through junctions off.
 *   Following and overtaking (ADR-0042): the Bypass, a loop round the school,
 *     where a tractor and a lorry hold up faster cars until they can get past.
 *   Heights (ADR-0018): Bridge Street's bridge over the river, the Bypass's
 *     flyover over School Lane on pillars (not joined: it's higher), and its
 *     tunnel under the ridge.
 *   Water: a ferry across the bay on a hidden route.
 *   Lights: the crossroads' signals (ADR-0094), street lamps, lit windows and
 *     headlights, as the evening comes on.
 *
 * Nothing crosses inside a junction at a busy moment if it can help it (there's
 * no giving way yet, ADR-0136): the streets' flows are kept moderate.
 */

const HIGH_STREET_ID = "high_street";
const BRIDGE_STREET_ID = "bridge_street";
const SCHOOL_LANE_ID = "school_lane";
const CHURCH_STREET_ID = "church_street";
const MILL_LANE_ID = "mill_lane";
const ORCHARD_ROAD_ID = "orchard_road";
const HARBOUR_ROAD_ID = "harbour_road";
const FREIGHT_ROAD_ID = "freight_road";
const BYPASS_ID = "bypass";
const FERRY_ID = "ferry_route";

/** The crossroads, where four streets meet at the lights. */
const CROSSROADS: TVec2 = [-14, 2];
/** Mill Lane's two Ts, at High Street and at Church Street. */
const MILL_NORTH: TVec2 = [-30, 2];
const MILL_SOUTH: TVec2 = [-30, 16];
/** Where Bridge Street meets Harbour Road on the east bank. */
const HARBOUR_T: TVec2 = [24, 2];

/** How high the Bypass flies over School Lane, and the ridge it tunnels under. */
const FLYOVER = 2.2;
const RIDGE = 2.4;

/** The freight table's row that Freight Road and the depot follow. */
const FREIGHT_ROW = "Depot → Port";
/** Containers a day on it (an example number), and the most the bindings expect. */
const FREIGHT_CONTAINERS = 420;
const FREIGHT_MOST = 600;

const EXAMPLE = "Example number, not live data";

// ---------------------------------------------------------------- areas

const AREAS: TAreaInput[] = [
	{
		// One water area for the river and the bay, so they meet without a seam.
		id: "water",
		name: "River Wend and the bay",
		kind: "water_01",
		points: [
			[10, -28],
			[17, -28],
			[17.4, -16],
			[16.8, -6],
			[17, 4],
			[17.8, 10.5],
			[19.5, 13.6],
			[23, 15.4],
			[40, 15.6],
			[40, 28],
			[1, 28],
			[1.6, 24],
			[3.2, 19.6],
			[6.2, 15.8],
			[8.8, 12.6],
			[9.8, 6],
			[10, -4],
			[9.6, -16],
		],
	},
	{
		id: "ridge",
		name: "The ridge",
		kind: "raised_land_01",
		height: RIDGE,
		colors: { surface: { color: "#8fae5f" } },
		points: [
			[-30, -28],
			[-20, -28],
			[-20, -21.6],
			[-30, -21.6],
		],
	},
	{
		id: "market_square",
		name: "Market Square",
		kind: "plaza_01",
		points: [
			[-11.4, 5],
			[-1.6, 5],
			[-1.6, 13],
			[-11.4, 13],
		],
	},
	{
		id: "mill_green",
		name: "Mill Green",
		kind: "grass_01",
		points: [
			[-36.4, 4.6],
			[-35.2, 3.6],
			[-31.6, 3.6],
			[-31.6, 14.4],
			[-35.2, 14.4],
			[-36.4, 13.4],
		],
	},
	{
		id: "playing_field",
		name: "Playing field",
		kind: "grass_01",
		colors: { surface: { color: "#7cc46a" } },
		points: [
			[-9, -22.6],
			[1.6, -22.6],
			[1.6, -13.4],
			[-9, -13.4],
		],
	},
	{
		// Gardens along the bay, behind Church Street's houses.
		id: "quay_gardens",
		name: "Quay Gardens",
		kind: "grass_01",
		points: [
			[-40, 21.8],
			[-4.4, 21.8],
			[-4.4, 28],
			[-40, 28],
		],
	},
	{
		id: "east_meadow",
		name: "East meadow",
		kind: "grass_01",
		colors: { surface: { color: "#8fbf5a" } },
		points: [
			[18, -28],
			[33.6, -28],
			[33.6, -8.6],
			[18, -8.6],
			[17.4, -16],
		],
	},
	{
		// Shares its edge with the bay's shore.
		id: "port_quay",
		name: "Port quay",
		kind: "plaza_01",
		points: [
			[18.4, 11.4],
			[40, 11.4],
			[40, 15.6],
			[23, 15.4],
			[19.5, 13.6],
		],
	},
	{
		id: "ferry_quay",
		name: "Ferry quay",
		kind: "plaza_01",
		points: [
			[-4, 17.4],
			[4.9, 17.4],
			[3.2, 19.6],
			[1.6, 24],
			[-4, 24],
		],
	},
];

// ---------------------------------------------------------------- roads

/** A street of the network with its background traffic: a flow that drives on through junctions. */
const street = (
	id: string,
	name: string,
	points: TRoadInput["points"],
	traffic: { vehicleKind: string; along: number; against: number; speed: number },
	more: Partial<TRoadInput> = {},
): TRoadInput => ({
	id,
	name,
	kind: "road_01",
	points,
	cornerRadius: 4,
	flow: {
		enabled: true,
		drivesThroughJunctions: true,
		vehicleKind: traffic.vehicleKind,
		vehicleCountAlong: traffic.along,
		vehicleCountAgainst: traffic.against,
		speed: traffic.speed,
	},
	...more,
});

/** Freight Road's width and how busy it is, from its row's containers a day (ADR-0109). */
const FREIGHT_WIDTH: TDataBindingInput = {
	key: "row.containers",
	valueAtLowSetting: 0,
	valueAtHighSetting: FREIGHT_MOST,
	lowSetting: 1.2,
	highSetting: 3.2,
};
const FREIGHT_DENSITY: TDataBindingInput = {
	key: "row.containers",
	valueAtLowSetting: 0,
	valueAtHighSetting: FREIGHT_MOST,
	lowSetting: 0.4,
	highSetting: 2.4,
};
/** A binding's setting for a value, as it draws it, so the stored setting matches the data. */
const settingFor = (binding: TDataBindingInput, value: number) => {
	const low = binding.lowSetting ?? 0;
	const high = binding.highSetting ?? 1;
	const share = value / (binding.valueAtHighSetting ?? 100);
	return Math.round((low + share * (high - low)) * 100) / 100;
};

const ROADS: TRoadInput[] = [
	street(HIGH_STREET_ID, "High Street", [MILL_NORTH, CROSSROADS], {
		vehicleKind: "car_01",
		along: 2,
		against: 2,
		speed: 2.6,
	}),
	// Over the river on a bridge, to the east bank and Harbour Road.
	street(
		BRIDGE_STREET_ID,
		"Bridge Street",
		[
			[...CROSSROADS, 0],
			[2, 2, 0],
			[8, 2, 1.1],
			[19, 2, 1.1],
			[...HARBOUR_T, 0],
		],
		{ vehicleKind: "car_01", along: 3, against: 3, speed: 2.8 },
	),
	// The dead end: up to the school, under the Bypass's flyover.
	street(
		SCHOOL_LANE_ID,
		"School Lane",
		[CROSSROADS, [-14, -18]],
		{ vehicleKind: "car_01", along: 1, against: 1, speed: 2.2 },
		{ width: 2.2 },
	),
	street(CHURCH_STREET_ID, "Church Street", [CROSSROADS, [-14, 16], MILL_SOUTH], {
		vehicleKind: "delivery_van_01",
		along: 2,
		against: 1,
		speed: 2.4,
	}),
	street(MILL_LANE_ID, "Mill Lane", [MILL_NORTH, MILL_SOUTH], {
		vehicleKind: "bus_01",
		along: 1,
		against: 1,
		speed: 2,
	}),
	// Round Mill Green, its two corners between Mill Lane's two Ts.
	{
		id: ORCHARD_ROAD_ID,
		name: "Orchard Road",
		kind: "road_01",
		width: 2.2,
		cornerRadius: 3,
		points: [MILL_NORTH, [-38, 2], [-38, 16], MILL_SOUTH],
	},
	// A loop round the harbour warehouse, cut open where Bridge Street meets it: both its ends are at the T.
	street(
		HARBOUR_ROAD_ID,
		"Harbour Road",
		[HARBOUR_T, [24, -6], [31, -6], [31, 10], [24, 10], HARBOUR_T],
		{ vehicleKind: "truck_01", along: 1, against: 1, speed: 2.2 },
		{ cornerRadius: 2.5 },
	),
	// The data flow: one way from the depot to the port, on its own (no junction), its arrows showing which way.
	{
		id: FREIGHT_ROAD_ID,
		name: "Freight Road",
		kind: "road_01",
		width: settingFor(FREIGHT_WIDTH, FREIGHT_CONTAINERS),
		showsCentreLine: false,
		// Darker than the town's streets, so it reads as a road of its own.
		colors: { surface: { color: "#5f5b57" } },
		points: [
			[36, -19],
			[36, 12],
		],
		dataRow: { tableKey: "freight", rowKey: FREIGHT_ROW },
		flow: {
			enabled: true,
			vehicleKind: "truck_01",
			vehicleCountAlong: 4,
			vehicleCountAgainst: 0,
			vehicleDensity: settingFor(FREIGHT_DENSITY, FREIGHT_CONTAINERS),
			speed: 2.2,
		},
		data: { width: FREIGHT_WIDTH, vehicleDensity: FREIGHT_DENSITY },
	},
	// A loop round the school: up over School Lane on pillars, and under the ridge.
	{
		id: BYPASS_ID,
		name: "The Bypass",
		kind: "road_01",
		loops: true,
		cornerRadius: 5,
		heldUpBy: "pillars",
		// Spaced so that the two by School Lane stand either side of it, never in it.
		pillarSpacing: 5.25,
		points: [
			[-36, -25, 0],
			[5, -25, 0],
			[5, -11, 0],
			[-3, -11, 0],
			[-10, -11, FLYOVER],
			[-18, -11, FLYOVER],
			[-25, -11, 0],
			[-36, -11, 0],
		],
	},
	// Invisible route across the bay for the ferry, from the town's quay to the port's.
	{
		id: FERRY_ID,
		name: "Ferry route",
		kind: "hidden_route_01",
		loops: true,
		cornerRadius: 1.2,
		points: [
			[6, 20.6],
			[21.6, 16.8],
			[22.4, 18.6],
			[6.6, 22.6],
		],
	},
];

const junction = (id: string, ends: [string, "start" | "end"][]) => ({
	id,
	ends: ends.map(([roadId, end]) => ({ roadId, end })),
});

/** Where the streets meet: the road going through a T or the crossroads is two roads (ADR-0136). */
const JUNCTIONS = [
	junction("crossroads", [
		[HIGH_STREET_ID, "end"],
		[BRIDGE_STREET_ID, "start"],
		[SCHOOL_LANE_ID, "start"],
		[CHURCH_STREET_ID, "start"],
	]),
	junction("mill_lane_north", [
		[HIGH_STREET_ID, "start"],
		[MILL_LANE_ID, "start"],
		[ORCHARD_ROAD_ID, "start"],
	]),
	junction("mill_lane_south", [
		[MILL_LANE_ID, "end"],
		[ORCHARD_ROAD_ID, "end"],
		[CHURCH_STREET_ID, "end"],
	]),
	junction("harbour_t", [
		[BRIDGE_STREET_ID, "end"],
		[HARBOUR_ROAD_ID, "start"],
		[HARBOUR_ROAD_ID, "end"],
	]),
];

// ---------------------------------------------------------------- entities

const lamp = (id: string, [x, z]: TVec2, kind = "street_lamp_01"): TEntityInput => ({
	id,
	kind,
	position: [x, z],
});

/** A signal at a corner of the crossroads, facing the traffic coming in on its right. */
const signal = (id: string, position: TVec2, facing: number, headStart: number): TEntityInput => ({
	id,
	kind: "traffic_light_01",
	name: "Traffic light",
	position,
	rotation: turned(facing),
	props: { secondsPerCycle: 20, cycleHeadStartSeconds: headStart },
});

/** The crossroads' lights: east–west and north–south take opposite turns. */
const signals: TEntityInput[] = [
	signal("signal_west", [-15.9, 3.9], -90, 0),
	signal("signal_east", [-12.1, 0.1], 90, 0),
	signal("signal_north", [-15.9, 0.1], 180, 10),
	signal("signal_south", [-12.1, 3.9], 0, 10),
];

const house = (
	id: string,
	position: TVec2,
	facing: number,
	roof: string,
	more: Partial<TEntityInput> = {},
): TEntityInput => ({
	id,
	kind: "house_01",
	position,
	rotation: turned(facing),
	colors: paint({ roof }),
	...more,
});

const ROOFS = ["#c0563f", "#4a64e0", "#3cbf9a", "#e8b83a", "#8a5cf0", "#d77a4a"];

/** High Street and the streets off it: shops to the north, houses to the south. */
const highStreet: TEntityInput[] = [
	{
		id: "corner_shop",
		kind: "shop_01",
		name: "Corner shop",
		position: [-26.6, -1.2],
		colors: paint({ walls: "#e9d8b4", awning: "#2f7a5d" }),
	},
	{
		id: "bakery",
		kind: "shop_02",
		name: "Bakery",
		position: [-24.6, -1.35],
		colors: paint({ walls: "#e3c9a2", awning: "#c0563f" }),
	},
	{ id: "high_street_terrace", kind: "terraced_row_02", position: [-21.4, -0.95] },
	{
		id: "corner_cafe",
		kind: "cafe_01",
		name: "Corner café",
		position: [-17.6, -1.2],
		colors: paint({ awning: "#e8b83a" }),
	},
	{
		id: "town_offices",
		kind: "office_tower_01",
		name: "Town offices",
		position: [-21.5, -5.6],
		colors: paint({ facade: "#4a64e0" }),
		props: { floorCount: 8 },
	},
	{
		id: "mill_flats",
		kind: "apartment_block_01",
		name: "Mill flats",
		position: [-26.4, -5.4],
		colors: paint({ walls: "#efd9a0" }),
		props: { floorCount: 5 },
	},
	// Across the street, their fronts to it.
	...[-26.6, -23, -19.4].map((x, i) =>
		house(`high_street_house_${i}`, [x, 5.6], 180, ROOFS[i], {
			props: { showsChimney: i !== 1 },
		}),
	),
	// West of Mill Lane, by Orchard Road.
	house("orchard_house_0", [-37.6, -1.4], 0, ROOFS[3]),
	house("orchard_house_1", [-34, -1.4], 0, ROOFS[4], { props: { showsChimney: false } }),
];

/** Bridge Street: offices, flats and the petrol station to the north; the bus stop, square and town hall to the south. */
const bridgeStreet: TEntityInput[] = [
	{
		id: "bridge_house",
		kind: "office_tower_01",
		name: "Bridge House",
		position: [-9.8, -2.3],
		props: { floorCount: 11 },
	},
	{
		id: "northgate_offices",
		kind: "office_tower_01",
		name: "Northgate offices",
		position: [-8.5, -6.6],
		colors: paint({ facade: "#f07b4f" }),
		props: { floorCount: 6 },
	},
	{
		id: "bridge_flats",
		kind: "apartment_block_01",
		name: "Bridge Street flats",
		position: [-5.2, -1.9],
		colors: paint({ walls: "#c9b8e8" }),
	},
	{
		id: "newsagent",
		kind: "shop_01",
		name: "Newsagent",
		position: [-1.6, -1.2],
		colors: paint({ walls: "#9cc4d8", awning: "#4a64e0" }),
	},
	{
		id: "petrol_station",
		kind: "petrol_station_01",
		name: "Petrol station",
		position: [2.4, -2.6],
	},
	{
		id: "route_7_stop",
		kind: "bus_stop_01",
		name: "Market Square stop",
		position: [-8.5, 3.95],
		rotation: turned(180),
	},
	{
		id: "market_fountain",
		kind: "fountain_01",
		name: "Market fountain",
		position: [-6.4, 9.2],
	},
	{
		id: "market_bench_west",
		kind: "bench_01",
		position: [-9.2, 9.2],
		rotation: turned(90),
	},
	{
		id: "market_bench_east",
		kind: "bench_01",
		position: [-3.6, 9.2],
		rotation: turned(-90),
	},
	...(
		[
			[-10.6, 5.8],
			[-2.4, 5.8],
			[-10.6, 12.4],
			[-2.4, 12.4],
		] as TVec2[]
	).map((spot, i) => lamp(`market_lantern_${i}`, spot, "street_lamp_02")),
	{
		id: "town_hall",
		kind: "city_hall_01",
		name: "Town hall",
		position: [3.6, 9.2],
	},
];

/** Church Street and the houses along it, St Anne's in the block between the streets. */
const churchStreet: TEntityInput[] = [
	{
		id: "st_annes",
		kind: "church_01",
		name: "St Anne's",
		position: [-24, 12.4],
	},
	house("church_house_0", [-27.4, 13.2], 0, ROOFS[5]),
	house("church_house_1", [-20, 13.2], 0, ROOFS[1], { props: { showsChimney: false } }),
	// South of Church Street, their fronts to it, the bay behind.
	...[-36, -32.4, -28.8, -25.2, -21.6, -18, -14.4, -10.8].map((x, i) =>
		house(`south_house_${i}`, [x, 19.6], 180, ROOFS[i % ROOFS.length], {
			props: { showsChimney: i % 2 === 0 },
		}),
	),
];

/** Mill Green, inside Orchard Road: a playground and trees. */
const millGreen: TEntityInput[] = [
	{ id: "green_swings", kind: "swings_01", position: [-34, 8] },
	{ id: "green_slide", kind: "slide_01", position: [-33.4, 10.8], rotation: turned(90) },
	{ id: "green_bench", kind: "bench_01", position: [-32.4, 5.4], rotation: turned(-90) },
	{ id: "green_oak", kind: "round_tree_02", position: [-35, 12.6], scale: 1.1 },
	{ id: "green_birch", kind: "birch_01", position: [-32.6, 13.4] },
	{ id: "green_tree", kind: "round_tree_01", position: [-35.2, 5.6] },
	...(
		[
			[-32.2, 8.6],
			[-35.8, 9.6],
		] as TVec2[]
	).map((spot, i) => lamp(`green_lamp_${i}`, spot, "street_lamp_04")),
];

/** Inside the Bypass: the school at the end of School Lane, its playing field, houses. */
const bypassSide: TEntityInput[] = [
	{
		id: "school",
		kind: "school_01",
		name: "Ridge school",
		position: [-14, -21],
	},
	...[-29.6, -26, -22.4].map((x, i) =>
		house(`bypass_house_${i}`, [x, -15.2], 0, ROOFS[(i + 2) % ROOFS.length]),
	),
	{ id: "field_goal_tree_0", kind: "round_tree_01", position: [-7.6, -12.9] },
	{ id: "field_goal_tree_1", kind: "round_tree_01", position: [0.4, -12.9] },
	{ id: "field_birch", kind: "birch_01", position: [2.6, -18] },
];

/** The east bank: the harbour warehouse inside Harbour Road, the works, the depot and the port. */
const eastBank: TEntityInput[] = [
	{
		id: "harbour_warehouse",
		kind: "warehouse_01",
		name: "Harbour warehouse",
		position: [27.5, 2],
		rotation: turned(90),
		props: { width: 7.5, depth: 4, height: 2.6, doorCount: 3 },
	},
	{ id: "warehouse_parcels_0", kind: "parcel_stack_01", position: [27.5, -3.6] },
	{
		id: "warehouse_parcels_1",
		kind: "parcel_stack_01",
		position: [27.5, 7.6],
		props: { parcelCount: 5 },
	},
	{
		id: "boatworks",
		kind: "factory_01",
		name: "Boatworks",
		position: [25, -14],
	},
	{
		id: "depot",
		kind: "depot_01",
		name: "Freight depot",
		position: [36, -22.6],
		dataRow: { tableKey: "freight", rowKey: FREIGHT_ROW },
		label: {
			title: "Freight to the port",
			dataKeys: ["row.containers"],
			offset: [0, 1.2, 0],
		},
		details: {
			description:
				"Freight Road shows its row of the freight table: the more containers a day, the wider the road and the more lorries on it, their arrows from the depot to the port. Example numbers.",
			dataKeys: ["row.containers"],
		},
	},
	// The container yard along the east edge, and on the quay.
	...[-14, -11.6, -9.2, 3, 5.4].map((z, i) => ({
		id: `yard_container_${i}`,
		kind: "shipping_container_01",
		position: [39.2, z] as TVec2,
		rotation: turned(90),
		colors: paint({ container: ["#c0563f", "#4a64e0", "#2f9e6f", "#e8b83a", "#c0563f"][i] }),
	})),
	...(
		[
			[26.5, 13.4, 0, "#4a64e0"],
			[28.4, 13.4, 0, "#e8b83a"],
			[26.5, 13.4, 0.7, "#c0563f"],
			[26.5, 14.3, 0, "#2f9e6f"],
		] as [number, number, number, string][]
	).map(([x, z, altitude, color], i) => ({
		id: `quay_container_${i}`,
		kind: "shipping_container_01",
		position: [x, z] as TVec2,
		altitude,
		colors: paint({ container: color }),
	})),
	{
		id: "cargo_ship",
		kind: "cargo_ship_01",
		name: "Cargo ship",
		position: [32.5, 17.6],
	},
	...(
		[
			[22.3, -3],
			[22.3, 6.5],
			[32.7, -1],
			[32.7, 7],
			[27.5, -7.7],
			[27.5, 11.8],
		] as TVec2[]
	).map((spot, i) => lamp(`harbour_lamp_${i}`, spot)),
];

/** Street lamps along the town's streets, at the kerb, clear of the buildings. */
const streetLamps: TEntityInput[] = (
	[
		// High Street
		[-26, 0.4],
		[-20.5, 0.4],
		[-23.2, 3.6],
		[-17.8, 3.6],
		// Bridge Street
		[-7.4, 0.4],
		[-1.2, 0.4],
		[-4.5, 3.6],
		[0.5, 3.6],
		// School Lane
		[-15.7, -4],
		[-12.4, -15.5],
		// Church Street
		[-12.3, 7],
		[-12.3, 11.5],
		[-22.2, 17.7],
		[-26.4, 17.7],
		// Mill Lane
		[-28.3, 9],
	] as TVec2[]
).map((spot, i) => lamp(`street_lamp_${i}`, spot));

/** The ferry quay, where the ferry crosses from. */
const ferryQuay: TEntityInput[] = [
	{ id: "quay_bench_0", kind: "bench_01", position: [-1.6, 21.2], rotation: turned(-90) },
	{ id: "quay_lamp_0", kind: "street_lamp_02", position: [1.4, 18.4] },
	{ id: "quay_lamp_1", kind: "street_lamp_02", position: [-2.6, 23.2] },
	{ id: "quay_sign", kind: "signpost_01", position: [-3, 18.6] },
];

/** [x, z, size] for round trees; [x, z, size, altitude] for pines. */
const TREES: [number, number, number][] = [
	// Behind High Street's shops
	[-17.6, -5.5, 1],
	[-30.2, -6.2, 1.1],
	[-37.8, -6, 1],
	[-34.4, -6.6, 0.9],
	// Behind Bridge Street
	[-4, -6.6, 1],
	[-0.8, -7.2, 0.9],
	[3.6, -7, 1.1],
	// The west bank
	[7.6, -1.6, 1],
	[7.8, -6.4, 0.9],
	[8, -15, 1.1],
	[8.2, -20.4, 1],
	[8, -25.6, 0.9],
	// The block behind St Anne's
	[-17.4, 9.6, 1],
	[-26.6, 9.6, 0.9],
	// Quay Gardens, along the bay
	[-36, 23.6, 1.1],
	[-31, 24.6, 1],
	[-26, 23.4, 1.2],
	[-21, 24.8, 1],
	[-16, 23.4, 1.1],
	[-11, 24.6, 1],
	[-7, 23.2, 0.9],
	// The east bank
	[19.6, -24, 1.1],
	[22.4, -26, 1],
	[19.2, -18.4, 0.9],
	[20, -10.6, 1],
	[30.4, -24, 1.1],
	[31, -18.4, 1],
	[19.6, 8, 0.9],
];

const PINES: [number, number, number, number][] = [
	// On the ridge, over the tunnel
	[-29, -27.3, 1.1, RIDGE],
	[-26.5, -27, 1, RIDGE],
	[-23.5, -27.3, 1.2, RIDGE],
	[-21, -26.9, 1, RIDGE],
	[-28.2, -22.6, 1, RIDGE],
	[-24.6, -22.4, 1.2, RIDGE],
	[-21.2, -22.7, 0.9, RIDGE],
	// Along the bay's edge
	[-38.6, 26.6, 1, 0],
	[-33.6, 26.8, 1.1, 0],
	[-28.4, 26.6, 0.9, 0],
	[-23.4, 26.9, 1, 0],
	[-18.4, 26.6, 1.1, 0],
	[-13.4, 26.8, 1, 0],
	[-8.6, 26.6, 0.9, 0],
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
		id: "ridge_tunnel",
		kind: "tunnel_01",
		name: "Ridge tunnel",
		position: [-25, -25],
		props: { length: 12, width: 3.2, height: 1.5 },
	},
];

/** Vehicles that follow a road: placed one by one, to select, follow, ride along with or keep to a road. */
const vehicles: TEntityInput[] = [
	{
		id: "route_7_bus",
		kind: "bus_01",
		name: "Route 7 bus",
		colors: paint({ body: "#2f9e6f", roof: "#f2efe6" }),
		follow: { roadId: BRIDGE_STREET_ID, speed: 1.8, startDistance: 5 },
		label: {
			title: "Route 7 bus",
			tag: "ride along",
			dataKeys: ["bus_next_stop", "bus_passengers"],
			offset: [0, 1.4, 0],
		},
		details: {
			description:
				"It drives on through the junctions, picking its way at each. Select it (or open this card) and choose Ride along to see the town from its seat, or Follow with the camera to keep it in view.",
			dataKeys: ["bus_next_stop", "bus_passengers"],
		},
	},
	{
		id: "post_van",
		kind: "delivery_van_01",
		name: "Post van",
		colors: paint({ body: "#d6402f", stripe: "#f2c230" }),
		// Its own setting: it keeps to Orchard Road, turning round at its junctions as at dead ends.
		follow: {
			roadId: ORCHARD_ROAD_ID,
			speed: 1.8,
			startDistance: 8,
			drivesThroughJunctions: false,
		},
		details: {
			description:
				"Drive through junctions onto other roads is off in its Motion tab, so it keeps to Orchard Road, turning round at each end.",
		},
	},
	// The Bypass: a tractor and a lorry with faster cars behind them, overtaking when the way is clear.
	{
		id: "bypass_tractor",
		kind: "tractor_01",
		name: "Tractor",
		follow: { roadId: BYPASS_ID, speed: 0.9, startDistance: 30 },
	},
	{
		id: "bypass_car_0",
		kind: "car_01",
		name: "Hatchback",
		colors: paint({ body: "#e05a4a" }),
		follow: { roadId: BYPASS_ID, speed: 2.8, startDistance: 24 },
	},
	{
		id: "bypass_car_1",
		kind: "car_01",
		name: "Estate car",
		colors: paint({ body: "#4a64e0" }),
		follow: { roadId: BYPASS_ID, speed: 3.2, startDistance: 18 },
	},
	{
		id: "bypass_van",
		kind: "delivery_van_01",
		name: "Builder's van",
		colors: paint({ body: "#f2efe6", stripe: "#3cbf9a" }),
		follow: { roadId: BYPASS_ID, speed: 2.5, startDistance: 12 },
	},
	{
		id: "bypass_lorry",
		kind: "truck_01",
		name: "Lorry",
		colors: paint({ cab: "#2f7a5d" }),
		follow: { roadId: BYPASS_ID, speed: 1.5, startDistance: 70, drivesTheOtherWay: true },
	},
	{
		id: "bypass_car_2",
		kind: "car_01",
		name: "Taxi",
		colors: paint({ body: "#e8b83a" }),
		follow: { roadId: BYPASS_ID, speed: 3, startDistance: 76, drivesTheOtherWay: true },
	},
	{
		id: "bypass_car_3",
		kind: "car_01",
		name: "Coupé",
		colors: paint({ body: "#8a5cf0" }),
		follow: { roadId: BYPASS_ID, speed: 2.6, startDistance: 50, drivesTheOtherWay: true },
	},
	{
		id: "ferry",
		kind: "ferry_01",
		name: "Bay ferry",
		scale: 0.55,
		colors: paint({ hull: "#4a64e0", funnel: "#e8b83a" }),
		follow: { roadId: FERRY_ID, speed: 1.2, startDistance: 4 },
	},
];

// ---------------------------------------------------------------- data, moods and views

const DATA: TSceneInput["data"] = {
	values: [
		{ key: "bus_next_stop", name: "Next stop", value: "Market Square", about: EXAMPLE },
		{ key: "bus_passengers", name: "Passengers", value: 23, about: EXAMPLE },
	],
	tables: [
		{
			key: "freight",
			name: "Freight",
			keyColumn: "route",
			columns: [
				{ key: "route", name: "Route" },
				{ key: "from", name: "From" },
				{ key: "to", name: "To" },
				{ key: "containers", name: "Containers a day", about: EXAMPLE },
			],
			rows: [{ route: FREIGHT_ROW, from: "Depot", to: "Port", containers: FREIGHT_CONTAINERS }],
		},
	],
};

const LIGHTING = { dayLength: 300, sunShadeContrast: 0.7 } satisfies TLightingInput;
/** From five in the afternoon into the night: a day in five minutes while motion plays. */
const EVENING_COMES = { ...LIGHTING, time: 17, timeSource: "cycle" } satisfies TLightingInput;

const mood = (id: string, name: string, lighting: TLightingInput): TMoodInput => ({
	id,
	name,
	lighting: { ...LIGHTING, ...lighting },
});

const MOODS = [
	mood("mood_evening", "The evening comes", EVENING_COMES),
	mood("mood_day", "Afternoon", { time: 14, timeSource: "fixed" }),
	mood("mood_dusk", "Dusk", { time: 19.2, timeSource: "fixed" }),
	mood("mood_night", "Night", { time: 22.5, timeSource: "fixed" }),
];

/** One for each part of the traffic, in the order the tour steps through them (ADR-0139). */
const VIEWPOINTS: TSceneInput["viewpoints"] = [
	{
		id: "view_overview",
		name: "Traffic town",
		description:
			"The whole town as the evening comes on: its streets, the Bypass, the river and the port.",
		target: [0, 0],
		elevation: 36,
		span: 60,
		moodId: "mood_evening",
	},
	{
		id: "view_crossroads",
		name: "The crossroads",
		description:
			"Four roads meet at the lights, each joined at a junction: High Street, Bridge Street, School Lane and Church Street. Mill Lane's T beyond.",
		target: [-15, 2],
		azimuth: 305,
		elevation: 36,
		span: 22,
		projection: "perspective",
		moodId: "mood_day",
	},
	{
		id: "view_background_traffic",
		name: "Background traffic",
		description:
			"Cars, vans, trucks and a bus drive on through the junctions at random: each street's flow, with nothing to place.",
		target: [-20, 7],
		azimuth: 320,
		elevation: 46,
		span: 32,
		moodId: "mood_day",
	},
	{
		id: "view_bus",
		name: "The Route 7 bus",
		description:
			"Its stop on Bridge Street. Select the bus, or open its card, and choose Ride along to see the town from it.",
		target: [-8.5, 3.4],
		azimuth: 265,
		elevation: 16,
		span: 11,
		projection: "perspective",
		moodId: "mood_day",
	},
	{
		id: "view_data_flow",
		name: "The data flow",
		description:
			"Freight Road keeps to itself: its width and lorries follow the freight table (example numbers), its arrows from the depot to the port.",
		target: [33, -4],
		azimuth: 330,
		elevation: 38,
		span: 30,
		moodId: "mood_day",
	},
	{
		id: "view_overtaking",
		name: "Overtaking on the Bypass",
		description:
			"A tractor and a lorry hold up the cars behind them, until the way ahead is clear to overtake.",
		target: [-9, -21],
		azimuth: 300,
		elevation: 30,
		span: 22,
		projection: "perspective",
		moodId: "mood_day",
	},
	{
		id: "view_tunnel",
		name: "The tunnel",
		description: "The Bypass runs under the ridge, pines on top.",
		target: [-19.5, -25],
		targetAltitude: 1,
		azimuth: 15,
		elevation: 16,
		span: 13,
		projection: "perspective",
		moodId: "mood_day",
	},
	{
		id: "view_flyover",
		name: "The flyover",
		description:
			"The Bypass climbs over School Lane on pillars, a ramp either side. It isn't joined to it: it crosses over.",
		target: [-14, -11],
		targetAltitude: 1,
		azimuth: 70,
		elevation: 22,
		span: 16,
		projection: "perspective",
		moodId: "mood_day",
	},
	{
		id: "view_bridge",
		name: "The bridge and the ferry",
		description:
			"Bridge Street crosses the river at dusk; the ferry crosses the bay on a hidden route.",
		target: [12, 9],
		azimuth: 320,
		elevation: 26,
		span: 26,
		projection: "perspective",
		moodId: "mood_dusk",
	},
	{
		id: "view_night",
		name: "Headlights after dark",
		description:
			"Street lamps, lit windows, the signals at the crossroads and every vehicle's headlights.",
		target: [-8, 2],
		elevation: 40,
		span: 40,
		moodId: "mood_night",
	},
];

/** Starter template: a small town that shows every part of the traffic simulation. */
export const createTrafficTownScene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: { title: "Traffic town", subtitle: "Every part of the traffic, as the evening comes on" },
		theme: "system",
		ground: { width: 80, depth: 56 },
		traffic: { drivingSide: "right" },
		// It opens wearing The evening comes.
		lighting: EVENING_COMES,
		camera: {
			openingViewpointId: "view_overview",
			lowestElevation: 5,
			tour: { enabled: true, holdSeconds: 7 },
		},
		moods: MOODS,
		viewpoints: VIEWPOINTS,
		onScreen: {
			legend: [
				{
					label: "Freight Road",
					meaning: "wider and busier for more containers a day (example numbers)",
				},
			],
		},
		data: DATA,
		areas: AREAS,
		roads: ROADS,
		junctions: JUNCTIONS,
		entities: [
			...signals,
			...highStreet,
			...bridgeStreet,
			...churchStreet,
			...millGreen,
			...bypassSide,
			...eastBank,
			...streetLamps,
			...ferryQuay,
			...nature,
			...vehicles,
		],
	} satisfies TSceneInput);
