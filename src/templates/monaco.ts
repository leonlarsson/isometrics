import {
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TRoadPoint,
	type TScene,
	type TSceneInput,
	type TVec2,
} from "#/scene/schema";

import { paint } from "./paint";

/**
 * Everything here is traced from the official Monaco Grand Prix map (2000 × 1414 px),
 * in map pixels. `fromMap` turns them into world units: 22 px per unit, with the
 * board centred on map pixel (1155, 540). X runs east, Z south.
 */
const MAP_PX_PER_UNIT = 22;
const MAP_CENTRE: TVec2 = [1155, 540];

const round = (value: number) => Math.round(value * 100) / 100;

const fromMap = ([x, y]: TVec2): TVec2 => [
	round((x - MAP_CENTRE[0]) / MAP_PX_PER_UNIT),
	round((y - MAP_CENTRE[1]) / MAP_PX_PER_UNIT),
];

const outline = (points: TVec2[]) => points.map(fromMap);

const TRACK_ID = "circuit";

/** Centre line of the Circuit de Monaco as [map x, map y, height], in race order. */
const TRACK_ON_MAP: [number, number, number][] = [
	[696, 636, 0], // 19 Antony Noghès
	[690, 606, 0], // start / finish straight
	[698, 574, 0],
	[718, 543, 0],
	[752, 508, 0],
	[792, 476, 0],
	[840, 436, 0],
	[888, 404, 0],
	[930, 376, 0],
	[980, 352, 0.1],
	[1032, 338, 0.2],
	[1072, 333, 0.3], // 1 Sainte Dévote
	[1125, 360, 0.5], // 2 Beau Rivage, climbing
	[1175, 390, 0.7],
	[1225, 415, 0.9],
	[1300, 437, 1.1],
	[1375, 470, 1.4],
	[1450, 505, 1.7],
	[1505, 527, 1.9], // 3 Massenet
	[1552, 530, 2],
	[1572, 515, 2.1],
	[1577, 478, 2.25],
	[1588, 440, 2.4], // 4 Casino
	[1650, 432, 2.4],
	[1705, 430, 2.3],
	[1775, 420, 2.1], // 5 Mirabeau Haute: past the Casino, then sharp right and down
	[1742, 468, 1.8],
	// 6 Grand Hotel hairpin: a tight U around a planted island (see HAIRPIN_ISLAND).
	[1735, 495, 1.55],
	[1739, 517, 1.5],
	[1763, 527, 1.45],
	[1787, 517, 1.45],
	[1791, 495, 1.45],
	[1792, 472, 1.45],
	[1808, 452, 1.4], // 7 Mirabeau Bas
	[1845, 468, 1.1], // the long sweep down to Portier
	[1868, 500, 0.8],
	[1895, 530, 0.5], // 8 Portier
	[1872, 553, 0.3],
	[1800, 578, 0.1],
	[1745, 585, 0],
	[1700, 588, 0], // 9 tunnel, under the Fairmont
	[1600, 593, 0],
	[1520, 591, 0],
	[1455, 580, 0],
	[1400, 562, 0],
	[1340, 537, 0],
	[1310, 540, 0],
	[1287, 552, 0], // 10 Nouvelle Chicane
	[1252, 520, 0], // 11
	[1240, 496, 0],
	[1190, 465, 0],
	[1140, 435, 0],
	[1095, 412, 0],
	[1060, 390, 0], // 12 Tabac
	[1018, 386, 0],
	[968, 396, 0],
	[925, 415, 0], // 13 Louis Chiron
	[900, 440, 0],
	[895, 468, 0], // 14
	[872, 496, 0],
	[840, 520, 0], // 15 Piscine
	[808, 537, 0],
	[784, 547, 0], // 16
	[762, 568, 0],
	[750, 600, 0], // 17
	[754, 630, 0],
	[776, 660, 0], // 18 La Rascasse
	[744, 672, 0],
	[716, 658, 0],
];

const TRACK: TRoadPoint[] = TRACK_ON_MAP.map(([x, y, height]) => [...fromMap([x, y]), height]);

/** Heights of the raised ground. */
const HILLSIDE = 1.2;
const CASINO_PLATEAU = 2.1;
/** The terrace the hairpin sits on, and its island (just proud of the road). */
const HAIRPIN_TERRACE = 1.35;
const HAIRPIN_ISLAND_TOP = 1.5;

/** Centre of the hairpin's island, in map px. */
const HAIRPIN_ISLAND: TVec2 = [1763, 497];
const HAIRPIN_ISLAND_RADIUS = 12;
const ROCK = 2.5;

/** Direction the piers run out from Quai Antoine Ier into the harbour (map px, unit length). */
const PIER_DIRECTION: TVec2 = [0.62, -0.78];
/** Rotation (degrees) that lines a part's length up with the piers. */
const ALONG_PIERS = 51.5;

/** A pier: a strip of quay running out into the harbour from `base` (map px). */
const pier = (id: string, base: TVec2, length: number, width = 14): TAreaInput => {
	const [dx, dy] = PIER_DIRECTION;
	const [nx, ny] = [-dy, dx];
	const half = width / 2;
	const tip: TVec2 = [base[0] + dx * length, base[1] + dy * length];
	return {
		id,
		name: "Pier",
		type: "plaza_01",
		// Timber, so the piers read as piers rather than white lines on the water.
		color: "#a8916f",
		points: outline([
			[base[0] - nx * half, base[1] - ny * half],
			[tip[0] - nx * half, tip[1] - ny * half],
			[tip[0] + nx * half, tip[1] + ny * half],
			[base[0] + nx * half, base[1] + ny * half],
		]),
	};
};

/** Bases of the piers on the Quai Antoine Ier waterfront (map px). */
const PIERS: TVec2[] = [
	[873, 681],
	[918, 717],
	[963, 753],
];

// ------------------------------------------------------------------- land & water

const AREAS: TAreaInput[] = [
	{
		id: "water",
		name: "Port Hercule & the sea",
		type: "water_01",
		points: outline([
			[1000, 414], // north quay, below Tabac
			[1090, 422],
			[1185, 497],
			[1222, 556], // Nouvelle Chicane
			[1300, 580],
			[1390, 598], // Yacht Club de Monaco
			[1470, 640],
			[1560, 668], // below the Fairmont
			[1700, 658],
			[1785, 632],
			[1850, 642], // Le Petit Portier
			[1925, 628],
			[1925, 914],
			[990, 914],
			[990, 775],
			[810, 630], // Quai Antoine Ier, by La Rascasse
			[806, 598],
			[822, 572],
			[855, 553], // Piscine
			[888, 530],
			[915, 500],
			[922, 462],
			[948, 432], // Louis Chiron
		]),
	},
	{
		// The F1 paddock's quay, between the harbour and Avenue de la Quarantaine.
		id: "quai_antoine",
		name: "Quai Antoine Ier",
		type: "plaza_01",
		points: outline([
			[785, 668],
			[810, 630],
			[990, 775],
			[990, 818],
			[955, 815],
		]),
	},
	{
		id: "terminal",
		name: "Digue & cruise terminal",
		type: "plaza_01",
		points: outline([
			[990, 790],
			[1100, 826],
			[1535, 834],
			[1540, 868],
			[1100, 874],
			[990, 884],
		]),
	},
	...PIERS.map((base, i) => pier(`pier_${i + 1}`, base, 200)),
	{
		// Monaco-Ville, with the Prince's Palace.
		id: "the_rock",
		name: "The Rock",
		type: "raised_land_01",
		height: ROCK,
		points: outline([
			[385, 592],
			[470, 610],
			[560, 650],
			[640, 690],
			[700, 722],
			[780, 760],
			[880, 800],
			[950, 840],
			[985, 885],
			[990, 914],
			[385, 914],
		]),
	},
	{
		// Monte-Carlo, on the hill above Beau Rivage and Casino Square.
		id: "hillside",
		name: "Monte-Carlo hillside",
		type: "raised_land_01",
		height: HILLSIDE,
		points: outline([
			[385, 166],
			[1925, 166],
			[1925, 380],
			[1820, 405],
			[1700, 395],
			[1600, 400],
			[1560, 460],
			[1555, 505], // Hôtel de Paris
			[1510, 500],
			[1480, 445],
			[1400, 420],
			[1300, 385],
			[1200, 350],
			[1100, 300],
			[1000, 295],
			[900, 330],
			[800, 380],
			[700, 430],
			[600, 450],
			[385, 450],
		]),
	},
	{
		// Inside the Casino / Mirabeau loop: the Casino and its terraces.
		id: "casino_plateau",
		name: "Casino Square",
		type: "raised_land_01",
		height: CASINO_PLATEAU,
		points: outline([
			[1597, 454],
			[1712, 452],
			[1712, 505],
			[1705, 540],
			[1600, 540],
			[1594, 500],
		]),
	},
	{
		// Mirabeau and the hairpin, on a terrace with retaining walls below the Casino.
		id: "hairpin_terrace",
		name: "Mirabeau terrace",
		type: "raised_land_01",
		height: HAIRPIN_TERRACE,
		points: outline([
			[1714, 452],
			[1760, 432],
			[1800, 438],
			[1812, 470],
			[1808, 520],
			[1800, 545],
			[1708, 545],
			[1714, 505],
		]),
	},
	{
		id: "hairpin_island",
		name: "Hairpin island",
		type: "grass_01",
		height: HAIRPIN_ISLAND_TOP,
		points: outline(
			Array.from({ length: 10 }, (_, i): TVec2 => {
				const angle = (i / 10) * Math.PI * 2;
				return [
					HAIRPIN_ISLAND[0] + Math.cos(angle) * HAIRPIN_ISLAND_RADIUS,
					HAIRPIN_ISLAND[1] + Math.sin(angle) * HAIRPIN_ISLAND_RADIUS,
				];
			}),
		),
	},
];

// ------------------------------------------------------------------- objects

const LIVERIES: [string, string][] = [
	["#d5232f", "#f2c230"],
	["#bfc4c9", "#2bb5a8"],
	["#f08a24", "#2a6fdb"],
	["#1f2a6b", "#e2283a"],
	["#1e6b4f", "#e9e3c8"],
	["#2f7be0", "#f7f7f4"],
	["#f36bb0", "#1f1f24"],
	["#f2f2f2", "#1f1f24"],
];

/** Race cars are scaled down so the track reads as a track, not a car park. */
const CAR_SIZE = 0.6;

const cars: TEntityInput[] = LIVERIES.map(([color, accent], i) => ({
	id: `car_${i + 1}`,
	kind: "race_car_01",
	name: `Car ${[16, 1, 4, 63, 14, 23, 10, 77][i]}`,
	colors: paint({ livery: color, details: accent }),
	scale: CAR_SIZE,
	// The pack runs nose to tail at one speed, so nobody drives through anybody.
	follow: { roadId: TRACK_ID, speed: 5, offset: 40 - i * 2.5 },
	// Rain lights on while it rains (the Rain value), day or night (ADR-0058).
	lights: { rain: { data: { on: { key: "rain" } } } },
	...(i === 0
		? {
				label: {
					title: "P1",
					dataKeys: ["leader", "gap"],
					offset: [0, 1.4, 0] as [number, number, number],
				},
				details: {
					description: "Leading the race.",
					dataKeys: ["leader", "gap", "fastest_lap"],
				},
			}
		: {}),
}));

/** Team hospitality units in the F1 paddock on Quai Antoine Ier. */
const paddock: TEntityInput[] = (
	[
		[832, 678],
		[867, 707],
		[902, 736],
		[937, 766],
	] as TVec2[]
).map((spot, i) => ({
	id: `paddock_${i + 1}`,
	kind: "depot_01",
	name: `Team hospitality ${i + 1}`,
	position: fromMap(spot),
	rotation: -38.8,
	colors: paint({ walls: LIVERIES[i][0], roof: LIVERIES[i][1] }),
	props: { width: 1.4, depth: 1.1, height: 0.9, garageDoor: false },
}));

/** Monte-Carlo's towers on the hillside. */
const city: TEntityInput[] = (
	[
		[440, 240, 8],
		[540, 330, 6],
		[620, 220, 10],
		[720, 300, 7],
		[820, 230, 12],
		[930, 250, 9],
		[1030, 210, 14],
		[1150, 230, 11],
		[1260, 290, 8],
		[1300, 200, 13],
		[1370, 330, 10],
		[1470, 340, 9],
		[1500, 220, 11],
		[1600, 330, 12],
		[1700, 220, 9],
		[1720, 320, 8],
		[1840, 320, 10],
		[1880, 220, 13],
	] as [number, number, number][]
).map(([x, y, floors], i) => ({
	id: `building_${i}`,
	kind: "office_tower_01",
	position: fromMap([x, y]),
	elevation: HILLSIDE,
	colors: paint({ facade: ["#e9d8b8", "#d9c3a5", "#f1e4cf", "#c9d6e0"][i % 4], grid: "#fbf7ef" }),
	props: { width: 2.4, depth: 2.4, floors },
}));

/** Lower ground: La Condamine, the old town on the Rock, and the block above Portier. */
const lowCity: TEntityInput[] = (
	[
		[440, 520, 5, 0],
		[545, 505, 4, 0],
		[620, 555, 6, 0],
		[500, 575, 4, 0],
		[560, 730, 2, ROCK],
		[630, 790, 3, ROCK],
		[470, 770, 2, ROCK],
		[760, 840, 2, ROCK],
		[1898, 425, 9, 0], // apartments above Mirabeau Bas
	] as [number, number, number, number][]
).map(([x, y, floors, elevation], i) => ({
	id: `low_building_${i}`,
	kind: "office_tower_01",
	position: fromMap([x, y]),
	elevation,
	colors: paint({ facade: ["#f1e4cf", "#e9d8b8", "#efd9c0", "#d9c3a5"][i % 4], grid: "#fbf7ef" }),
	props: { width: 2.2, depth: 2.2, floors },
}));

/** Yachts moored along the piers, and a few bigger ones on the outer quay. */
const yachts: TEntityInput[] = [
	...PIERS.flatMap(([bx, by], p) =>
		[60, 140].flatMap((along, k) =>
			[1, -1].map((side) => {
				const [dx, dy] = PIER_DIRECTION;
				const spot: TVec2 = [bx + dx * along - dy * 24 * side, by + dy * along + dx * 24 * side];
				return {
					id: `yacht_${p}_${k}_${side === 1 ? "a" : "b"}`,
					kind: "yacht_01",
					position: fromMap(spot),
					rotation: ALONG_PIERS + (side === 1 ? 0 : 180),
					colors: paint({ stripe: (p + k) % 3 === 0 ? "#1f1f24" : null }),
					props: { length: 1.8 + ((p * 2 + k + (side === 1 ? 0 : 1)) % 3) * 0.6, decks: 1 + k },
				};
			}),
		),
	),
	...(
		[
			[1190, 806, 4, 3],
			[1330, 810, 3.4, 2],
			[1460, 812, 4.6, 3],
			[1230, 650, 2.6, 2],
		] as [number, number, number, number][]
	).map(([x, y, length, decks], i) => ({
		id: `superyacht_${i}`,
		kind: "yacht_01",
		position: fromMap([x, y]),
		colors: paint({ stripe: i % 2 === 0 ? "#1f1f24" : null }),
		props: { length, decks },
	})),
];

const trees: TEntityInput[] = (
	[
		[...HAIRPIN_ISLAND, HAIRPIN_ISLAND_TOP],
		[1612, 468, CASINO_PLATEAU],
		[1612, 522, CASINO_PLATEAU],
		[1700, 530, CASINO_PLATEAU],
		[430, 830, ROCK],
		[560, 820, ROCK],
		[700, 800, ROCK],
		[850, 870, ROCK],
		[410, 650, ROCK],
		[660, 520, 0],
	] as [number, number, number][]
).map(([x, y, elevation], i) => ({
	id: `tree_${i}`,
	kind: i % 2 === 0 ? "round_tree_01" : "pine_tree_01",
	position: fromMap([x, y]),
	elevation,
	props: { size: 0.9 },
}));

/** The Circuit de Monaco around Port Hercule, with live race data. */
export const createMonacoScene = (): TScene => {
	const input: TSceneInput = {
		version: 1,
		meta: { title: "Monaco street circuit", subtitle: "Live race overview" },
		theme: "system",
		ground: { width: 70, depth: 34, color: null },
		driving: "right",
		data: [
			{ key: "lap", label: "Lap", value: "42 / 78" },
			{ key: "leader", label: "Leader", value: "Car 16" },
			{ key: "gap", label: "Gap to P2", value: "+1.8 s" },
			{ key: "fastest_lap", label: "Fastest lap", value: "1:12.909" },
			{ key: "top_speed", label: "Top speed", value: 291, unit: " km/h" },
			{ key: "spectators", label: "Spectators", value: 37800 },
			{ key: "track_temp", label: "Track temp", value: 41, unit: "°C" },
			{ key: "pit_stops", label: "Pit stops", value: 11 },
			// Set to "yes" and every car's rain light comes on, like in a real wet race.
			{ key: "rain", label: "Rain", value: "no" },
		],
		areas: AREAS,
		roads: [
			{
				id: TRACK_ID,
				name: "Circuit de Monaco",
				style: "road_01",
				closed: true,
				width: 1.2,
				cornerRadius: 1,
				// Race tarmac, darker than a town road, with no centre line.
				color: "#9c988f",
				markings: false,
				lane: "centre",
				// The climb from Sainte Dévote to the Casino sits on the hillside.
				supports: "embankment",
				railings: false,
				points: TRACK,
			},
			{
				id: "sea_lane",
				name: "Sea lane",
				style: "hidden_route_01",
				points: [fromMap([1580, 885]), fromMap([1910, 760])],
			},
		],
		entities: [
			{
				id: "pool",
				kind: "zone_01",
				name: "Stade Nautique Rainier III (swimming pool)",
				position: fromMap([850, 480]),
				rotation: 38.5,
				colors: paint({ fill: "#5fd0ea" }),
				props: { width: 1.3, depth: 0.9, shape: "rect" },
			},
			{
				id: "fairmont",
				kind: "tunnel_01",
				name: "Tunnel (under the Fairmont)",
				position: fromMap([1610, 588]),
				rotation: 1.5,
				colors: paint({ walls: "#d9d4c7", roof: "#e9d5c4" }),
				props: { length: 12, width: 2.4, height: 1.2, building: 2.2 },
				label: { title: "Top speed", dataKeys: ["top_speed"], offset: [0, 1, 3] },
			},
			{
				id: "casino",
				kind: "depot_01",
				name: "Casino de Monte-Carlo",
				position: fromMap([1665, 495]),
				elevation: CASINO_PLATEAU,
				rotation: 180,
				colors: paint({ walls: "#f3e7cf", roof: "#c9a15a" }),
				props: { width: 3.4, depth: 2, height: 2.4, garageDoor: false },
				label: { title: "Track temp", dataKeys: ["track_temp"], offset: [0, 1.4, 0] },
			},
			{
				id: "hotel_de_paris",
				kind: "depot_01",
				name: "Hôtel de Paris",
				position: fromMap([1533, 470]),
				elevation: HILLSIDE,
				colors: paint({ walls: "#efe2c8", roof: "#9c8b6f" }),
				props: { width: 2, depth: 1.4, height: 2.2, garageDoor: false },
			},
			{
				id: "palace",
				kind: "depot_01",
				name: "Prince's Palace",
				position: fromMap([480, 680]),
				elevation: ROCK,
				rotation: -20,
				colors: paint({ walls: "#f0e3cc", roof: "#c96a4a" }),
				props: { width: 4, depth: 2.4, height: 1.6, garageDoor: false },
			},
			{
				id: "start_line",
				kind: "beacon_01",
				name: "Start / finish",
				position: fromMap([816, 456]),
				props: { radius: 0.8, pulse: true },
				label: { title: "Lap", dataKeys: ["lap"], offset: [3, 1.2, 3] },
				details: {
					description: "Start / finish line on Boulevard Albert Ier.",
					dataKeys: ["lap", "fastest_lap", "pit_stops"],
				},
			},
			{
				id: "grandstand_straight",
				kind: "grandstand_01",
				name: "Grandstand (start straight)",
				position: fromMap([747, 461]),
				rotation: 38.5,
				props: { length: 5, rows: 3 },
				label: { title: "Spectators", dataKeys: ["spectators"], offset: [0, 1.5, 0] },
			},
			{
				id: "grandstand_condamine",
				kind: "grandstand_01",
				name: "Grandstand (La Condamine)",
				position: fromMap([845, 391]),
				rotation: 33.5,
				colors: paint({ seats: "#e2603b" }),
				props: { length: 4, rows: 3 },
			},
			{
				id: "grandstand_rascasse",
				kind: "grandstand_01",
				name: "Grandstand (La Rascasse)",
				position: fromMap([713, 699]),
				rotation: 153.4,
				colors: paint({ seats: "#2bb58c" }),
				props: { length: 3, rows: 2, roof: false },
			},
			...paddock,
			...city,
			...lowCity,
			...yachts,
			{
				id: "cruiser",
				kind: "yacht_01",
				name: "Cruising yacht",
				props: { length: 3.6, decks: 2 },
				follow: { roadId: "sea_lane", speed: 0.8, offset: 4 },
			},
			...trees,
			...cars,
		],
	};
	return SceneSchema.parse(input);
};
