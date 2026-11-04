import { round } from "#/lib/math";
import { groundHeightAt, isInsidePolygon } from "#/scene/areas";
import {
	AreaSchema,
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TLightingInput,
	type TMoodInput,
	type TRoadInput,
	type TScene,
	type TSceneInput,
	type TSurfaceKind,
	type TTiltShiftInput,
	type TVec2,
} from "#/scene/schema";

import { type ILaidBlock, inFrame, layBlocks, turnedRect } from "./cityBlocks";
import { paint } from "./paint";
import {
	edgeDistance,
	type ILaidRow,
	type IRowSide,
	type IStreetLine,
	layRowsAlong,
	segmentDistance,
} from "./streetRows";
import { turned } from "./turned";

/*
 * Stockholm: Gamla stan, the old town, and the waters and islands round it,
 * built to show off lights and the day cycle with data: on a two-minute day
 * from half past five, the lanterns in the lanes come on together at dusk,
 * the houses' windows one by one, the palace and the churches are floodlit,
 * Centralbron's traffic turns its headlights on and the ferries their cabins.
 *
 * Traced from an aerial picture of central Stockholm, shapes only: shores,
 * islands and bridges as points on the picture (north up, about 1.28 m to a
 * pixel), turned into world units by `fromPicture` (12.5 m to a unit, centred
 * near Stortorget; x runs east, z south). Gamla stan's streets are laid out on
 * the island in world units, and its houses are laid along them by
 * `layRowsAlong` (streetRows.ts); the mainland's stone blocks are laid on a
 * grid by `layBlocks` (cityBlocks.ts), wherever there's land clear of roads,
 * parks and landmarks. Heights are drawn about one and a half times true, as
 * miniatures are.
 *
 *   Islands: Gamla stan (Stadsholmen), Riddarholmen across its canal,
 *            Helgeandsholmen with the Riksdag, Strömsborg, Skeppsholmen and
 *            Kastellholmen, as raised land with quay edges over one water area
 *   Shores:  Kungsholmen with Stadshuset across Klara sjö, Norrmalm from
 *            Tegelbacken past the Opera and Kungsträdgården to Blasieholmen,
 *            Djurgården's tip, Södermalm's heights above Söder Mälarstrand,
 *            Slussen and Stadsgården
 *   Bridges: Centralbron (traffic, into Söderleden's tunnel), Vasabron,
 *            Riksbron and Stallbron, Norrbro, Strömbron, Riddarholmsbron,
 *            Slussen, Skeppsholmsbron and Kastellholmsbron, raised roads
 *   Water:   Riddarfjärden, Strömmen and Saltsjön; ferries on hidden routes
 *   Data:    example numbers (each says so): ferries, Centralbron's traffic,
 *            the palace's visitors, the Riksdag, Stadshuset
 */

// ---------------------------------------------------------------- the map

/** The picture's pixel over Stortorget, and how many pixels make a world unit (12.5 m). */
const PICTURE_ORIGIN: TVec2 = [945, 470];
const PIXELS_PER_UNIT = 9.77;

const fromPicture = ([x, y]: readonly number[]): TVec2 => [
	round((x - PICTURE_ORIGIN[0]) / PIXELS_PER_UNIT, 2),
	round((y - PICTURE_ORIGIN[1]) / PIXELS_PER_UNIT, 2),
];

const traced = (points: readonly (readonly number[])[]) => points.map(fromPicture);

/** The ground: from Kungsholmen in the west to Kastellholmen, Norrmalm to Södermalm. */
const GROUND: TVec2 = [186, 124];

/** How high the islands' quays stand over the water. */
const ISLAND = 0.2;
/** Squares and gardens on the islands, just over their top. */
const ON_ISLAND = ISLAND + 0.004;
/** Cars are drawn smaller here: the map is a few times smaller than the cars' own scale. */
const CAR = 0.5;

// ---------------------------------------------------------------- shores and islands

/** Riddarfjärden, Klara sjö, Strömmen and Saltsjön: everything between the north shore and Södermalm. */
const WATER = traced([
	[36, 323], // west edge, Norr Mälarstrand
	[116, 304],
	[147, 319], // Stadshuset's garden
	[232, 311],
	[274, 296],
	[284, 278], // Stadshuset's point
	[280, 225],
	[285, 195], // Stadshusbron
	[250, 120], // Klara sjö
	[200, 30],
	[150, -136],
	[205, -136],
	[250, 0],
	[300, 110],
	[330, 180],
	[381, 215], // Tegelbacken
	[451, 205],
	[520, 192],
	[612, 183], // Rosenbad
	[645, 169],
	[706, 190], // Riksbron
	[765, 165],
	[789, 152],
	[864, 112], // Norrbro, Gustav Adolfs torg
	[884, 102],
	[960, 92],
	[1050, 80], // Strömbron
	[1077, 76],
	[1111, 69], // Strömkajen's piers, the Grand Hôtel
	[1136, 75],
	[1153, 94],
	[1144, 133],
	[1175, 138],
	[1201, 120],
	[1196, 147],
	[1220, 144],
	[1238, 179], // Blasieholmen's point, Skeppsholmsbron
	[1277, 215],
	[1303, 218],
	[1340, 190],
	[1365, 140], // Nybroviken
	[1385, 60],
	[1395, -136],
	[1740, -136], // Djurgården's tip
	[1745, 20],
	[1760, 90],
	[1790, 140],
	[1854, 160], // east edge
	[1854, 1076],
	[1560, 1076], // Stadsgården
	[1344, 1010],
	[1289, 978],
	[1252, 945],
	[1134, 895], // Slussen
	[1110, 880],
	[1060, 870],
	[1000, 850], // Söderström
	[900, 838],
	[830, 830],
	[803, 825], // Söder Mälarstrand
	[731, 818],
	[703, 820],
	[682, 810],
	[614, 811],
	[587, 801],
	[459, 802],
	[302, 798],
	[142, 805],
	[36, 800], // west edge
]);

/** Gamla stan: straight along Skeppsbron, the palace in its north-east corner, squared off at Slussen. */
const GAMLA_STAN = traced([
	[700, 310], // Riddarhustorget
	[705, 380],
	[722, 420],
	[745, 470], // Munkbron
	[770, 540],
	[800, 610],
	[830, 660],
	[850, 690], // Kornhamnstorg
	[900, 712],
	[960, 722],
	[1010, 726],
	[1055, 738],
	[1080, 780], // Slussen
	[1095, 835],
	[1125, 823],
	[1153, 768], // Skeppsbron
	[1185, 677],
	[1205, 600],
	[1212, 532],
	[1215, 470],
	[1205, 400],
	[1185, 350],
	[1160, 300],
	[1135, 275],
	[1100, 205], // Strömbron
	[1067, 175],
	[1040, 205], // the palace, Lejonbacken
	[960, 250],
	[880, 284], // Mynttorget
	[823, 303],
	[760, 312],
]);

/** Riddarholmen, across its canal from Gamla stan, Centralbron along it. */
const RIDDARHOLMEN = traced([
	[513, 358], // Birger Jarls torg
	[590, 345],
	[650, 385],
	[700, 460], // Riddarholmskanalen
	[722, 540],
	[715, 575],
	[690, 600],
	[633, 600],
	[600, 573],
	[571, 560],
	[545, 535], // Evert Taubes terrass
	[526, 513],
	[501, 403],
	[504, 367],
]);

const HELGEANDSHOLMEN = traced([
	[762, 245],
	[790, 205],
	[812, 187],
	[850, 165],
	[886, 146],
	[920, 150],
	[950, 170], // Strömparterren
	[962, 200],
	[950, 222],
	[900, 250],
	[840, 272],
	[790, 268],
]);

const STROMSBORG = traced([
	[595, 250],
	[615, 248],
	[618, 268],
	[597, 272],
]);

/** Skeppsholmen: long, lying north-west to south-east, af Chapman at its west quay. */
const SKEPPSHOLMEN = traced([
	[1398, 335], // af Chapman's quay
	[1405, 260],
	[1440, 205], // Skeppsholmsbron
	[1500, 180],
	[1560, 215],
	[1640, 265],
	[1720, 320],
	[1780, 385],
	[1810, 460],
	[1800, 520],
	[1745, 575], // Kastellholmsbron
	[1703, 568],
	[1512, 591],
	[1487, 576],
	[1460, 538],
	[1430, 500],
	[1415, 440],
	[1406, 400],
]);

const KASTELLHOLMEN = traced([
	[1748, 625],
	[1800, 622],
	[1854, 640],
	[1854, 785],
	[1817, 782],
	[1783, 760],
	[1745, 750],
	[1740, 700],
]);

/**
 * Södermalm's heights behind Söder Mälarstrand and Stadsgården, [x, z, lift]: low at Slussen,
 * high over Mariaberget and Katarina.
 */
const SODERMALM_HEIGHT = 1.4;
const SODERMALM: [number, number, number][] = [
	[-93, 38.5, 1],
	[-60, 38, 1.2],
	[-35, 38.3, 1.1],
	[-16, 39.5, 0.6],
	[-6, 43.5, 0.2],
	[5, 46, 0],
	[15, 47.5, 0.4],
	[30, 53.4, 0.9],
	[39.4, 59, 1],
	[49, 62, 1],
	[-93, 62, 1.2],
];
const SODERMALM_OUTLINE = SODERMALM.map(([x, z]): TVec2 => [x, z]);

const SODERMALM_AREA: TAreaInput = {
	id: "sodermalm",
	name: "Södermalm",
	kind: "raised_land_01",
	height: SODERMALM_HEIGHT,
	colors: { surface: { color: "#9d9886" } },
	surface: { kind: "paving_01" },
	points: SODERMALM,
	// Mariaberget and Mosebacke, a little higher still.
	peaks: [
		[-40, 48, 1.5],
		[25, 57, 1.6],
	],
};

/** How high Södermalm's ground stands at a point (0 off it), for what stands on its heights. */
const SODER = AreaSchema.parse(SODERMALM_AREA);
const onSoder = (x: number, z: number) => round(groundHeightAt([SODER], [x, z]), 2);

/** Katarinahissen: its tower by Stadsgårdsleden, its footbridge out level to the heights. */
const KATARINAHISSEN_AT: TVec2 = [21, 47.3];
const KATARINAHISSEN_LANDING: TVec2 = [24, 53];
const KATARINAHISSEN_TOP = round(onSoder(...KATARINAHISSEN_LANDING) + 0.05, 2);

/** A rectangle's corners, for squares and gardens. */
const rect = (x1: number, z1: number, x2: number, z2: number): TVec2[] => [
	[x1, z1],
	[x2, z1],
	[x2, z2],
	[x1, z2],
];

/** Gamla stan's streets run turned with the island: points along Stortorget and along the palace. */
const STORTORGET_MIDDLE: TVec2 = [1.9, 1.3];
const onStortorget = inFrame(STORTORGET_MIDDLE, 25);
const PALACE_MIDDLE: TVec2 = [6.4, -17.6];
const byThePalace = inFrame(PALACE_MIDDLE, 25);

/** Gamla stan's squares. */
const STORTORGET = turnedRect(STORTORGET_MIDDLE, 25, 4.6, 3.6);
const JARNTORGET = rect(8.6, 18.6, 12.4, 22);
// Kornhamnstorg stops short of Munkbroleden.
const KORNHAMNSTORG = rect(-0.8, 19.3, 4, 22.6);
const MYNTTORGET = rect(-8.6, -18, -4.2, -15.4);
/** Slottsbacken: down from Storkyrkan along the palace's south front to Skeppsbron. */
const SLOTTSBACKEN = (
	[
		[-3.6, 5.3],
		[9.4, 5.3],
		[9.4, 8.6],
		[-3.6, 8.6],
	] as TVec2[]
).map(byThePalace);
/** The palace's quay on the water to the north, Lejonbacken. */
const PALACE_QUAY: TVec2[] = [
	byThePalace([-6, -5.2]),
	byThePalace([6.4, -5.2]),
	[10.6, -27.2],
	[1.5, -22.1],
	[-1.4, -20.6],
];

/**
 * What the islands and squares are paved with (ADR-0137): Gamla stan's lanes and squares and
 * Riddarholmen in cobbles, the Riksdag's island and the quays in paving, Skeppsholmen's paths in
 * gravel. Areas not named keep their kind's (a plaza's paving, grass, raised land's earth).
 */
const SURFACES: Record<string, TSurfaceKind> = {
	gamla_stan: "cobbles_01",
	riddarholmen: "cobbles_01",
	helgeandsholmen: "paving_01",
	stromsborg: "paving_01",
	skeppsholmen: "gravel_01",
	stortorget: "cobbles_01",
	jarntorget: "cobbles_01",
	kornhamnstorg: "cobbles_01",
	slottsbacken: "cobbles_01",
	sodermalm: "paving_01",
};

/** Cobbles a little finer than the world's paving's scale would make them: setts, not slabs. */
const surfaceOf = (id: string) =>
	SURFACES[id]
		? {
				surface: {
					kind: SURFACES[id],
					...(SURFACES[id] === "cobbles_01" ? { patternScale: 0.75 } : {}),
				},
			}
		: {};

/** Gardens and parks on the islands. */
const RIDDARHUSET_GARDEN = rect(-21.8, -15.9, -16, -14.6);
const STROMPARTERREN: TVec2[] = [
	[-2.2, -31.8],
	[0.2, -30.4],
	[1.2, -27.7],
	[0.2, -25.8],
	[-2.4, -26.4],
];
const EVERT_TAUBES_TERRASS: TVec2[] = [
	[-42.4, 3.9],
	[-40.2, 3.9],
	[-39.9, 5.8],
	[-41.1, 5.8],
];
const SKEPPSHOLMEN_WEST_PARK: TVec2[] = [
	[48.2, -16],
	[51.5, -17],
	[53.5, -7.5],
	[53.5, 2.5],
	[50.8, 1.5],
	[49, -6],
];
const SKEPPSHOLMEN_EAST_PARK: TVec2[] = [
	[67, -2.6],
	[77, 0.3],
	[84.4, 3.4],
	[82.4, 8.2],
	[67.4, 10.2],
	[63.4, 5.2],
];
const KASTELLHOLMEN_GRASS: TVec2[] = [
	[83, 17],
	[87.4, 16.6],
	[92.4, 18.2],
	[92.4, 31.2],
	[89.4, 31],
	[85.8, 28.8],
	[82.4, 28],
	[82.2, 23.4],
];

/** On the mainland. */
const KUNGSTRADGARDEN = rect(2, -61.6, 8.6, -44);
const KARL_XII_TORG = rect(2, -44, 8.6, -42.4);
const GUSTAV_ADOLFS_TORG = rect(-12, -44.5, -6.2, -40.7);
const STADSHUSET_GARDEN: TVec2[] = [
	[-81.5, -19.2],
	[-69.4, -19.2],
	[-69.2, -18.6],
	[-73, -16.9],
	[-81.6, -16.1],
];
const DJURGARDEN: TVec2[] = [
	[82.2, -61.6],
	[92.6, -61.6],
	[92.6, -32.6],
	[86.7, -34.6],
	[84, -39],
	[82.6, -46],
];
/** Ivar Los park on Mariaberget, trees and no houses. */
const IVAR_LOS_PARK = rect(-48, 39.4, -36, 43.8);

const AREAS: TAreaInput[] = [
	{
		id: "water",
		name: "Riddarfjärden, Strömmen and Saltsjön",
		kind: "water_01",
		points: WATER,
	},
	SODERMALM_AREA,
	...(
		[
			["gamla_stan", "Gamla stan (Stadsholmen)", GAMLA_STAN],
			["riddarholmen", "Riddarholmen", RIDDARHOLMEN],
			["helgeandsholmen", "Helgeandsholmen", HELGEANDSHOLMEN],
			["stromsborg", "Strömsborg", STROMSBORG],
			["skeppsholmen", "Skeppsholmen", SKEPPSHOLMEN],
			["kastellholmen", "Kastellholmen", KASTELLHOLMEN],
		] as const
	).map(
		([id, name, points]): TAreaInput => ({
			id,
			name,
			kind: "raised_land_01",
			height: ISLAND,
			// Cobbles and paving, the quays' stone below.
			colors: { surface: { color: "#a99d89" } },
			...surfaceOf(id),
			points,
		}),
	),
	// Squares and gardens on the islands, over their paving.
	...(
		[
			["stortorget", "Stortorget", "plaza_01", STORTORGET, "#cfc3ad"],
			["jarntorget", "Järntorget", "plaza_01", JARNTORGET, "#cfc3ad"],
			["kornhamnstorg", "Kornhamnstorg", "plaza_01", KORNHAMNSTORG, "#cfc3ad"],
			["mynttorget", "Mynttorget", "plaza_01", MYNTTORGET, "#cfc3ad"],
			["slottsbacken", "Slottsbacken", "plaza_01", SLOTTSBACKEN, "#d3c8b2"],
			["palace_quay", "Lejonbacken", "plaza_01", PALACE_QUAY, "#d3c8b2"],
			["riddarhuset_garden", "Riddarhuset's garden", "grass_01", RIDDARHUSET_GARDEN, null],
			["stromparterren", "Strömparterren", "grass_01", STROMPARTERREN, null],
			["evert_taubes_terrass", "Evert Taubes terrass", "plaza_01", EVERT_TAUBES_TERRASS, "#cfc3ad"],
			["skeppsholmen_park", "Skeppsholmen's park", "grass_01", SKEPPSHOLMEN_WEST_PARK, null],
			[
				"skeppsholmen_east_park",
				"Skeppsholmen's east park",
				"grass_01",
				SKEPPSHOLMEN_EAST_PARK,
				null,
			],
			[
				"kastellholmen_grass",
				"Kastellholmen's rocks and grass",
				"grass_01",
				KASTELLHOLMEN_GRASS,
				null,
			],
		] as const
	).map(
		([id, name, kind, points, color]): TAreaInput => ({
			id,
			name,
			kind,
			height: ON_ISLAND,
			...(color ? { colors: { surface: { color } } } : {}),
			...surfaceOf(id),
			points: points.map(([x, z]): TVec2 => [x, z]),
		}),
	),
	// On the mainland.
	{ id: "kungstradgarden", name: "Kungsträdgården", kind: "grass_01", points: KUNGSTRADGARDEN },
	{ id: "karl_xii_torg", name: "Karl XII:s torg", kind: "plaza_01", points: KARL_XII_TORG },
	{
		id: "gustav_adolfs_torg",
		name: "Gustav Adolfs torg",
		kind: "plaza_01",
		points: GUSTAV_ADOLFS_TORG,
	},
	{
		id: "stadshuset_garden",
		name: "Stadshuset's garden",
		kind: "grass_01",
		points: STADSHUSET_GARDEN,
	},
	{ id: "djurgarden", name: "Djurgården", kind: "grass_01", points: DJURGARDEN },
];

// ---------------------------------------------------------------- roads and bridges

const CENTRALBRON_ID = "centralbron";
const SKEPPSBRON_ID = "skeppsbron";
const MUNKBROLEDEN_ID = "munkbroleden";
/** Strömgatan, in stretches between the bridges that meet it (ADR-0136). */
const STROMGATAN_POINTS: TVec2[][] = [
	[
		[-50.2, -30.2],
		[-43, -31.2],
		[-34, -31.5],
	],
	[
		[-34, -31.5],
		[-30.5, -32.2],
		[-24.5, -31],
	],
	[
		[-24.5, -31],
		[-18.5, -33],
		[-12, -36.5],
		[-6.5, -39],
	],
	[
		[-6.5, -39],
		[1.5, -40.2],
		[8, -41.2],
		[12.3, -41.8],
	],
	[
		[12.3, -41.8],
		[18, -43.2],
		[23, -39],
		[29, -36.5],
		[33.5, -30.5],
		[37, -29],
	],
];
const STROMGATAN_IDS = STROMGATAN_POINTS.map((_, i) => `stromgatan_${i + 1}`);
const SODER_SHORE_ID = "soder_malarstrand";
const STADSGARDEN_ID = "stadsgardsleden";
const DJURGARDEN_FERRY_ID = "djurgarden_ferry_route";
const ARCHIPELAGO_ID = "archipelago_route";
const RIDDARFJARDEN_ID = "riddarfjarden_route";

/** Skeppsbron: along Gamla stan's straight east quay, from Strömbron to Slussen. */
const SKEPPSBRON_POINTS: TVec2[] = [
	[13.5, -27.5],
	[17.2, -21],
	[20.5, -16],
	[23, -11.5],
	[24.8, -6.8],
	[25.8, 0],
	[25.6, 6],
	[24.5, 13],
	[22.5, 21],
	[20, 29.5],
	[18.4, 31],
	[16.6, 35],
];
/** Munkbroleden: from Riddarhustorget down the west quay, round the south to Slussen. */
const MUNKBROLEDEN_POINTS: TVec2[] = [
	[-23.8, -13.3],
	[-21.5, -5.1],
	[-19.2, 0],
	[-16.7, 7.7],
	[-13.5, 14.5],
	[-10.8, 18.9],
	[-7.7, 21.5],
	[-3, 23.3],
	[5.4, 24.6],
	[10.7, 25.8],
	[15.5, 29.8],
	[16.6, 35],
];
const SODER_SHORE_POINTS: TVec2[] = [
	[-92.5, 35.3],
	[-50, 35.4],
	[-30, 36.5],
	[-20, 37.3],
	[-8, 39.2],
	[2, 40.6],
	[8, 41.6],
	[12.5, 42.5],
];

/** A bridge: a raised road, its deck at the heights its points give, on piers. */
const bridge = (
	id: string,
	name: string,
	points: [number, number, number][],
	width: number,
	more: Partial<TRoadInput> = {},
): TRoadInput => ({
	id,
	name,
	kind: "road_01",
	width,
	cornerRadius: 2,
	showsCentreLine: false,
	heldUpBy: "pillars",
	pillarSpacing: 2.5,
	colors: { surface: { color: "#6f6b66" }, embankment: { color: "#9a9184" } },
	points,
	...more,
});

/** A street on the ground. */
const street = (
	id: string,
	name: string,
	points: TVec2[],
	more: Partial<TRoadInput> = {},
): TRoadInput => ({
	id,
	name,
	kind: "road_01",
	width: 1.1,
	cornerRadius: 3,
	showsCentreLine: false,
	colors: { surface: { color: "#6f6b66" } },
	points,
	...more,
});

/** Götgatan: up a ramp from Slussen, then up the heights, a point a unit so it keeps to the ground. */
const GOTGATAN_POINTS: [number, number, number][] = [
	[12.5, 42.5, 0],
	[12.6, 43.5, 0.37],
	[12.8, 44.7, 0.81],
	[12.9, 45.9, 1.25],
	[13, 47, 1.65],
	...Array.from({ length: 14 }, (_, i): [number, number, number] => {
		const z = 47.8 + i;
		return [13.1, z, round(onSoder(13.1, z) + 0.03, 2)];
	}),
];

const ROADS: TRoadInput[] = [
	{
		...street(SKEPPSBRON_ID, "Skeppsbron", [], {
			width: 1,
			colors: { surface: { color: "#5f5b57" } },
		}),
		heldUpBy: "none",
		showsRailings: false,
		points: SKEPPSBRON_POINTS.map(([x, z]): [number, number, number] => [x, z, ISLAND]),
	},
	{
		...street(MUNKBROLEDEN_ID, "Munkbroleden", [], {
			width: 1,
			colors: { surface: { color: "#5f5b57" } },
		}),
		heldUpBy: "none",
		showsRailings: false,
		points: MUNKBROLEDEN_POINTS.map(([x, z]): [number, number, number] => [x, z, ISLAND]),
	},
	// Centralbron: from Tegelbacken over Riddarfjärden's corner, past Riddarholmen and along the
	// canal between it and Gamla stan, over Söderström, and into Söderleden's tunnel under Södermalm.
	bridge(
		CENTRALBRON_ID,
		"Centralbron",
		[
			[-50.2, -30.2, 0],
			[-46.4, -26.2, 0.6],
			[-42.5, -22, 1.2],
			[-34.3, -15.35, 1.5],
			[-29.2, -9.2, 1.5],
			[-23.2, -1, 1.45],
			[-19.75, 9.2, 1.4],
			[-15.9, 22.5, 1.35],
			[-12.6, 33.8, 1.2],
			[-10.4, 39.8, 1],
			[-9.4, 44.6, 1],
		],
		1.6,
		{
			cornerRadius: 6,
			showsCentreLine: true,
			pillarSpacing: 4,
			colors: { surface: { color: "#55524f" }, embankment: { color: "#8c8a86" } },
			// Its buses and lorry keep to it, back and forth, rather than turning off into town.
			traffic: { drivesThroughJunctions: false },
			// Its traffic both ways, as busy as the Centralbron traffic value says (ADR-0112), the cars
			// drawn at the map's scale (ADR-0135); their headlights come on after dark.
			flow: {
				enabled: true,
				vehicleKind: "car_01",
				vehicleCountAlong: 8,
				vehicleCountAgainst: 8,
				vehicleDensity: 1.6,
				vehicleScale: CAR,
				speed: 3.2,
				showsArrows: false,
			},
			data: {
				vehicleDensity: {
					key: "centralbron_traffic",
					valueAtLowSetting: 0,
					valueAtHighSetting: 6000,
					lowSetting: 0,
					highSetting: 3,
				},
			},
		},
	),
	bridge(
		"vasabron",
		"Vasabron",
		[
			[-34, -31.5, 0],
			[-32, -27, 0.5],
			[-28, -20, 0.5],
			[-25.6, -16.2, 0.3],
			[-23.8, -13.3, ISLAND],
		],
		1.2,
	),
	bridge(
		"riksbron",
		"Riksbron and Stallbron",
		[
			[-24.5, -31, 0],
			[-21, -27, 0.45],
			[-17, -24, ISLAND],
			[-15.8, -21.8, ISLAND],
			[-15.3, -19.6, 0.35],
			[-14.7, -15.5, ISLAND],
		],
		0.9,
		{ cornerRadius: 1 },
	),
	bridge(
		"norrbro",
		"Norrbro",
		[
			[-6.5, -39, 0],
			[-6, -35.5, 0.55],
			[-5.2, -31, ISLAND],
			[-3.8, -24.2, ISLAND],
			[-3.4, -21.8, 0.4],
			[-3.1, -19.2, ISLAND],
		],
		1.2,
		{ pillarSpacing: 2 },
	),
	bridge(
		"strombron",
		"Strömbron",
		[
			[13.5, -27.5, ISLAND],
			[12.6, -36, 0.5],
			[12.3, -41.8, 0],
		],
		1.3,
	),
	bridge(
		"riddarholmsbron",
		"Riddarholmsbron",
		[
			// From Riddarholmen under Centralbron to Riddarhustorget, where Vasabron lands too.
			[-30, -6, ISLAND],
			[-26.6, -10, 0.32],
			[-23.8, -13.3, ISLAND],
		],
		0.8,
		{ cornerRadius: 0 },
	),
	// Slussen: from Gamla stan's south over Söderström to Södermalm's shore, its gold bridge on piers.
	bridge(
		"slussen",
		"Slussen",
		[
			[16.6, 35, ISLAND],
			[14.5, 39, 0.6],
			[12.5, 42.5, 0],
		],
		1.4,
		{
			pillarSpacing: 2.2,
			colors: { surface: { color: "#5f5b57" }, embankment: { color: "#c9a93e" } },
		},
	),
	// Götgatan, up from Slussen onto the heights, on the ground all the way.
	bridge("gotgatan", "Götgatan", GOTGATAN_POINTS, 1.2, {
		cornerRadius: 1,
		heldUpBy: "embankment",
		embankmentAngle: 70,
		colors: { surface: { color: "#5f5b57" }, embankment: { color: "#9d9886" } },
	}),
	bridge(
		"skeppsholmsbron",
		"Skeppsholmsbron",
		[
			[37, -29, 0],
			[42, -20, 0.5],
			[48.5, -15, ISLAND],
		],
		0.9,
		{ cornerRadius: 0 },
	),
	bridge(
		"kastellholmsbron",
		"Kastellholmsbron",
		[
			[80, 8.5, ISLAND],
			[81.2, 12.8, 0.35],
			[83.5, 18.2, ISLAND],
		],
		0.6,
		{ cornerRadius: 0 },
	),
	bridge(
		"stadshusbron",
		"Stadshusbron",
		[
			[-84, -31, 0],
			[-70, -30, 0],
			[-65.5, -30, 0.4],
			[-61, -30, 0],
			[-50.2, -30.2, 0],
		],
		1.2,
	),
	// The mainland's waterfront roads.
	...STROMGATAN_POINTS.map(
		(points, i): TRoadInput =>
			street(STROMGATAN_IDS[i], i === 0 ? "Strömgatan" : `Strömgatan (${i + 1})`, points),
	),
	street(SODER_SHORE_ID, "Söder Mälarstrand", SODER_SHORE_POINTS),
	street(STADSGARDEN_ID, "Stadsgårdsleden", [
		[12.5, 42.5],
		[19, 44.6],
		[31.2, 50.1],
		[40.8, 56.8],
		[51.7, 60.4],
		[55, 61.6],
	]),
	// Katarinahissen's footbridge, from the top of its lift out to the heights.
	{
		id: "katarinahissen",
		name: "Katarinahissen's footbridge",
		kind: "road_01",
		width: 0.5,
		cornerRadius: 0,
		showsCentreLine: false,
		heldUpBy: "none",
		colors: { surface: { color: "#3b3f44" } },
		points: [
			[...KATARINAHISSEN_AT, KATARINAHISSEN_TOP],
			[...KATARINAHISSEN_LANDING, KATARINAHISSEN_TOP],
		],
	},
	// The boats' routes, hidden.
	{
		id: DJURGARDEN_FERRY_ID,
		name: "Djurgården ferry",
		kind: "hidden_route_01",
		loops: true,
		cornerRadius: 4,
		points: [
			[21, 33],
			[40, 32],
			[60, 33],
			[85, 38],
			[85, 44],
			[60, 42],
			[40, 40],
			[24, 37],
		],
	},
	{
		id: ARCHIPELAGO_ID,
		name: "Archipelago boats",
		kind: "hidden_route_01",
		loops: true,
		cornerRadius: 4,
		points: [
			[25.5, -29],
			[30, -23],
			[36, -12],
			[37, 5],
			[40, 20],
			[55, 38],
			[85, 48],
			[85, 55],
			[55, 46],
			[33, 25],
			[32, 5],
			[31, -12],
			[27, -25.5],
		],
	},
	{
		id: RIDDARFJARDEN_ID,
		name: "Riddarfjärden boats",
		kind: "hidden_route_01",
		loops: true,
		cornerRadius: 5,
		points: [
			[-66, -12],
			[-50, -6],
			[-50, 15],
			[-60, 28],
			[-85, 28],
			[-88, 10],
			[-80, -8],
		],
	},
];

/** Where roads meet (ADR-0136): the bridges' landings on the quays, and Slussen's two ends. */
const junction = (id: string, ends: [string, "start" | "end"][]) => ({
	id,
	ends: ends.map(([roadId, end]) => ({ roadId, end })),
});

const JUNCTIONS = [
	junction("tegelbacken", [
		[CENTRALBRON_ID, "start"],
		["stadshusbron", "end"],
		[STROMGATAN_IDS[0], "start"],
	]),
	junction("vasabron_north", [
		[STROMGATAN_IDS[0], "end"],
		[STROMGATAN_IDS[1], "start"],
		["vasabron", "start"],
	]),
	junction("riksbron_north", [
		[STROMGATAN_IDS[1], "end"],
		[STROMGATAN_IDS[2], "start"],
		["riksbron", "start"],
	]),
	junction("gustav_adolfs_torg", [
		[STROMGATAN_IDS[2], "end"],
		[STROMGATAN_IDS[3], "start"],
		["norrbro", "start"],
	]),
	junction("strombron_north", [
		[STROMGATAN_IDS[3], "end"],
		[STROMGATAN_IDS[4], "start"],
		["strombron", "end"],
	]),
	junction("blasieholmen", [
		[STROMGATAN_IDS[4], "end"],
		["skeppsholmsbron", "start"],
	]),
	junction("riddarhustorget", [
		["vasabron", "end"],
		[MUNKBROLEDEN_ID, "start"],
		["riddarholmsbron", "end"],
	]),
	junction("slottskajen", [
		["strombron", "start"],
		[SKEPPSBRON_ID, "start"],
	]),
	junction("slussen_north", [
		[SKEPPSBRON_ID, "end"],
		[MUNKBROLEDEN_ID, "end"],
		["slussen", "start"],
	]),
	junction("slussen_south", [
		["slussen", "end"],
		["gotgatan", "start"],
		[SODER_SHORE_ID, "end"],
		[STADSGARDEN_ID, "start"],
	]),
];

// ---------------------------------------------------------------- Gamla stan's streets

/**
 * Gamla stan's streets and lanes, main streets first: the lines its houses are laid along
 * (streetRows.ts), the main streets getting theirs first. They aren't roads: the island's
 * cobbles are its lanes. Only the quays, Skeppsbron and Munkbroleden, where traffic drives, are.
 */
const LANE = { depths: [1.6, 1.2, 0.9], houseWidth: 0.85 } satisfies IRowSide;
const NARROW_LANE = { depths: [1.3, 1, 0.8], houseWidth: 0.8 } satisfies IRowSide;
const QUAY = { depths: [2.2, 1.7, 1.2], houseWidth: 1.05, mostHouses: 7 } satisfies IRowSide;
const SQUARE = { depths: [1.7, 1.3], houseWidth: 0.9 } satisfies IRowSide;

interface IOldTownStreet extends IStreetLine {
	name: string;
	/** How many floors its houses have, and what share face it with a gable. */
	floorCount: number;
	gableShare: number;
	/** Whether its houses look out at the back too (over a quay). */
	hasWindowsAtTheBack?: boolean;
	/** Wall lanterns on its houses after dark, one on every this many rows; 0 for none. */
	lanternEvery: number;
}

const oldTownStreet = (
	id: string,
	name: string,
	points: TVec2[],
	width: number,
	more: Partial<IOldTownStreet> = {},
): IOldTownStreet => ({
	id,
	name,
	points,
	width,
	left: LANE,
	right: LANE,
	floorCount: 4,
	gableShare: 0.25,
	lanternEvery: 0,
	...more,
});

const OLD_TOWN_STREETS: IOldTownStreet[] = [
	// Stortorget's houses first: the stepped gables on its west side face the square.
	oldTownStreet(
		"stortorget_west",
		"Stortorget",
		[onStortorget([-2.5, 1.8]), onStortorget([-2.5, -1.8])],
		0.1,
		{ left: SQUARE, right: undefined, gableShare: 0.9, floorCount: 5, lanternEvery: 1 },
	),
	oldTownStreet(
		"stortorget_south",
		"Stortorget",
		[onStortorget([2.5, 2]), onStortorget([-2.5, 2])],
		0.1,
		{ left: SQUARE, right: undefined, gableShare: 0.5, floorCount: 5 },
	),
	oldTownStreet(
		"stortorget_east",
		"Stortorget",
		[onStortorget([2.5, -1.8]), onStortorget([2.5, 1.8])],
		0.1,
		{ left: SQUARE, right: undefined, gableShare: 0.6, floorCount: 4, lanternEvery: 1 },
	),
	oldTownStreet(
		"vasterlanggatan",
		"Västerlånggatan",
		[
			[-8.4, -15],
			[-7.6, -7.2],
			[-4.1, 1],
			[0.5, 9.2],
			[5.1, 14.8],
			[9.7, 19.4],
		],
		0.55,
		{ floorCount: 5, lanternEvery: 3 },
	),
	oldTownStreet(
		"osterlanggatan",
		"Österlånggatan",
		[
			[11.8, -7.7],
			[14.8, -2],
			[16.2, 3.6],
			[14.7, 11.5],
			[12.4, 17.9],
		],
		0.5,
		{ floorCount: 5, lanternEvery: 3 },
	),
	// Its houses face the water: the merchants' row, tall and broad.
	oldTownStreet("skeppsbron", "Skeppsbron", SKEPPSBRON_POINTS, 1, {
		left: undefined,
		right: QUAY,
		floorCount: 6,
		gableShare: 0.1,
	}),
	oldTownStreet(
		"stora_nygatan",
		"Stora Nygatan",
		[
			[-17.4, -7.2],
			[-11.8, 1],
			[-4.6, 9.7],
			[1, 16.6],
			[2, 19],
		],
		0.6,
		{ floorCount: 5, lanternEvery: 4 },
	),
	// Its houses face the water across the road, and the lanes at their backs.
	oldTownStreet("munkbroleden", "Munkbroleden", MUNKBROLEDEN_POINTS, 1, {
		left: { ...QUAY, depths: [1.6, 1.2] },
		right: undefined,
		floorCount: 5,
		hasWindowsAtTheBack: true,
	}),
	oldTownStreet(
		"lilla_nygatan",
		"Lilla Nygatan",
		[
			[-18.1, -2],
			[-13, 5.6],
			[-8.2, 11.9],
			[-4.3, 17.4],
		],
		0.45,
		{ left: NARROW_LANE, right: NARROW_LANE },
	),
	oldTownStreet(
		"slottsbacken_south",
		"Slottsbacken",
		[byThePalace([9.2, 8.8]), byThePalace([-3.4, 8.8])],
		0.1,
		{ left: QUAY, right: undefined, floorCount: 5, gableShare: 0 },
	),
	oldTownStreet(
		"svartmangatan",
		"Svartmangatan",
		[
			[4.5, 2.8],
			[9, 5],
			[10.5, 11],
			[10.5, 17.5],
		],
		0.45,
		{ lanternEvery: 3 },
	),
	oldTownStreet(
		"kopmangatan",
		"Köpmangatan",
		[
			[4.5, 0],
			[10, -1],
			[15, -1.5],
		],
		0.4,
		{ left: NARROW_LANE, right: NARROW_LANE, lanternEvery: 3 },
	),
	oldTownStreet(
		"storkyrkobrinken",
		"Storkyrkobrinken",
		[
			[-22.5, -10.2],
			[-15, -9.6],
			[-8, -9.2],
			[-5, -9],
		],
		0.5,
		{ left: NARROW_LANE, right: NARROW_LANE },
	),
	// Lanes down to the quays: only gaps between the houses, too narrow for rows of their own.
	...(
		[
			["kakbrinken", "Kåkbrinken", [-4, 0.3], [-0.9, 1.4]],
			["tyska_brinken", "Tyska brinken", [-1.6, 5.2], [3, 6.2]],
			["ferkens_grand", "Ferkens gränd", [13.8, -4], [25, -4.3]],
			["gaddgarsgrand", "Gaddgårdsgränd", [16.1, 4], [25.7, 4]],
			["brunnsgrand", "Brunnsgränd", [15, 10], [25, 10]],
			["drakens_grand", "Drakens gränd", [13.1, 16], [23.6, 16.5]],
			["gasgrand", "Gåsgränd", [-6.5, -5], [-21, -3.5]],
			["ignatiigrand", "Ignatiigränd", [-2, 5], [-17, 6]],
			["schonfeldts_grand", "Schönfeldts gränd", [2, 12], [-13.6, 13.2]],
			["kolmatargrand", "Kolmätargränd", [6, 16.5], [-9.5, 19.5]],
			["jarntorgsgatan", "Järntorgsgatan", [10.6, 22.2], [11.6, 25]],
		] as [string, string, TVec2, TVec2][]
	).map(([id, name, from, to]) =>
		oldTownStreet(id, name, [from, to], 0.4, { left: undefined, right: undefined }),
	),
];

/** Landmarks, the squares and gardens: no houses there. */
const KEEP_OUT: TVec2[][] = [
	turnedRect(PALACE_MIDDLE, 25, 13.8, 10.6), // the palace and its wings
	SLOTTSBACKEN,
	PALACE_QUAY,
	turnedRect([-1.5, -8.4], 115, 3.6, 7), // Storkyrkan
	STORTORGET,
	turnedRect([5.4, 6.9], -65, 4, 6.6), // Tyska kyrkan and its churchyard
	JARNTORGET,
	KORNHAMNSTORG,
	MYNTTORGET,
	rect(-21.8, -15.9, -16, -10.7), // Riddarhuset and its garden
	turnedRect(onStortorget([0.3, -3.5]), 25, 5.4, 2.8), // Börshuset, Stortorget's north side
	turnedRect(byThePalace([5, 10.6]), 25, 4.2, 3.4), // Tessinska palatset
];

// ---------------------------------------------------------------- Gamla stan's houses

/** The old town's colours: ochre, rust red, yellow, pale green, salmon, cream. */
const OLD_TOWN_WALLS = [
	"#d39b3f",
	"#b0523a",
	"#e6c15a",
	"#a9bf98",
	"#dc9a7c",
	"#e8dcc0",
	"#c2703f",
	"#e0b878",
	"#9a5a3c",
	"#e3b6a4",
];
/** Dark sheet-metal roofs, now and then red tiles. */
const OLD_TOWN_ROOFS = ["#45403f", "#3d3a3c", "#4f4846", "#8f4a37", "#45403f"];

const wallsOf = (i: number) => ({
	walls: OLD_TOWN_WALLS[i % OLD_TOWN_WALLS.length],
	secondWalls: OLD_TOWN_WALLS[(i + 3) % OLD_TOWN_WALLS.length],
	thirdWalls: OLD_TOWN_WALLS[(i + 6) % OLD_TOWN_WALLS.length],
	fourthWalls: OLD_TOWN_WALLS[(i + 8) % OLD_TOWN_WALLS.length],
});

const laidRows = layRowsAlong({
	streets: OLD_TOWN_STREETS,
	land: GAMLA_STAN,
	keepOut: KEEP_OUT,
	shoreMargin: 0.25,
	// The blocks' insides, built over with lower back houses.
	courtyards: { depths: [1.4, 1.1], houseWidth: 1, spacing: 1.2 },
});

/** The back houses in the blocks' courtyards: lower, plainer, no lanterns. */
const COURTYARD = oldTownStreet("courtyard", "Courtyard", [], 0, {
	floorCount: 3,
	gableShare: 0.15,
});

const streetOf = (row: ILaidRow) =>
	OLD_TOWN_STREETS.find((candidate) => candidate.id === row.streetId) ?? COURTYARD;

const oldTownHouses: TEntityInput[] = laidRows.map((row, i) => {
	const of = streetOf(row);
	return {
		id: `house_row_${i}`,
		kind: "terraced_row_02",
		name: `${of.name} ${i + 1}`,
		position: row.position,
		altitude: ISLAND,
		rotation: turned(row.turn),
		colors: paint({ ...wallsOf(i * 7), roof: OLD_TOWN_ROOFS[i % OLD_TOWN_ROOFS.length] }),
		props: {
			houseCount: row.houseCount,
			houseWidth: row.side.houseWidth,
			depth: row.depth,
			floorCount: of.floorCount,
			gableShare: of.gableShare,
			hasWindowsAtTheBack: of.hasWindowsAtTheBack ?? false,
			seed: i * 13 + 5,
		},
	};
});

/** Wall lanterns on the houses of the main lanes and round Stortorget, lit together at dusk. */
const wallLanterns: TEntityInput[] = laidRows.flatMap((row, i) => {
	const of = streetOf(row);
	if (of.lanternEvery === 0 || i % of.lanternEvery !== 0) {
		return [];
	}
	return [
		{
			id: `wall_lantern_${i}`,
			kind: "wall_lantern_01",
			// On the wall, the lantern out over the street.
			position: [
				round(row.front[0] + row.facing[0] * 0.13),
				round(row.front[1] + row.facing[1] * 0.13),
			] as TVec2,
			altitude: ISLAND,
			rotation: turned(row.turn),
			props: { height: 0.6 },
		},
	];
});

// ---------------------------------------------------------------- landmarks

/** Example data, as every value here is: say so wherever it's shown in full. */
const EXAMPLE = "Example number, not live data";

/** Where the mainland's landmarks stand, kept clear of the city's blocks. */
const OPERAN: TVec2 = [-2.5, -45.8];
const ARVFURSTENS_PALATS: TVec2 = [-15.8, -44.2];
const ROSENBAD: TVec2 = [-29, -36.5];
const GRAND_HOTEL: TVec2 = [25, -45.5];
const NATIONALMUSEUM: TVec2 = [38.5, -40];
const STADSHUSET: TVec2 = [-75.2, -23.6];
const STADSMUSEET: TVec2 = [1.3, 48.6];
/** Söderleden's tunnel mouth, at the foot of Södermalm's cliff, turned along Centralbron. */
const TUNNEL_MOUTH: TVec2 = [-10.05, 41.45];

const landmarks: TEntityInput[] = [
	{
		id: "kungliga_slottet",
		kind: "palace_01",
		name: "Kungliga slottet",
		position: PALACE_MIDDLE,
		altitude: ISLAND,
		// Its portal to the south, onto Slottsbacken; its wings out east and west.
		rotation: turned(25),
		props: { width: 9.4, depth: 9, floorCount: 5, sideWingLength: 1.8 },
		label: {
			title: "Kungliga slottet",
			dataKeys: ["palace_visitors"],
			offset: [0, 1.6, 0],
		},
		details: {
			description:
				"The royal palace: some six hundred rooms round its courtyard, its fronts floodlit after dark.",
			dataKeys: ["palace_visitors"],
		},
	},
	{
		id: "storkyrkan",
		kind: "church_02",
		name: "Storkyrkan",
		position: [-1.5, -8.4],
		altitude: ISLAND,
		// Its tower to the east, at the top of Slottsbacken.
		rotation: turned(115),
		props: { width: 2.8, depth: 6.2, towerHeight: 4 },
		details: { description: "Stockholm's cathedral, the oldest church in Gamla stan." },
	},
	{
		id: "tyska_kyrkan",
		kind: "church_04",
		name: "Tyska kyrkan",
		position: [5.4, 6.9],
		altitude: ISLAND,
		rotation: turned(-65),
		props: { width: 2.6, depth: 5, towerHeight: 3.4 },
		details: { description: "The German church, its copper spire over the lanes." },
	},
	{
		id: "riddarholmskyrkan",
		kind: "church_03",
		name: "Riddarholmskyrkan",
		position: [-29.7, 1.5],
		altitude: ISLAND,
		rotation: turned(-75),
		props: { width: 2.6, depth: 6.4, towerHeight: 3.2 },
		details: {
			description: "The burial church of Sweden's kings, under its cast-iron spire.",
		},
	},
	{
		id: "stadshuset",
		kind: "city_hall_01",
		name: "Stadshuset",
		position: STADSHUSET,
		props: { width: 9.6, depth: 7.2, floorCount: 4, towerHeight: 7.2 },
		label: {
			title: "Stadshuset",
			dataKeys: ["stadshuset_tours"],
			offset: [3.4, 1, 3],
		},
		details: {
			description: "The city hall, its tower carrying the three crowns over Riddarfjärden.",
			dataKeys: ["stadshuset_tours"],
		},
	},
	{
		id: "riksdagshuset",
		kind: "palace_01",
		name: "Riksdagshuset",
		position: [-10, -26],
		altitude: ISLAND,
		rotation: turned(20),
		colors: paint({ walls: "#cfc8b8", trim: "#ece6d8", plinth: "#a9a294", roof: "#5f6f69" }),
		props: {
			width: 6,
			depth: 4.4,
			floorCount: 4,
			wingDepth: 1.4,
			showsSideWings: false,
			seed: 4,
		},
		// Its lit windows follow how many of its offices are at work.
		lights: {
			windows: { data: { litPaneShare: { key: "riksdag_at_work", valueAtFull: 100 } } },
		},
		label: { title: "Riksdagshuset", dataKeys: ["riksdag_at_work"], offset: [0, 1.4, 0] },
		details: {
			description: "The parliament on Helgeandsholmen: its lit windows follow its offices at work.",
			dataKeys: ["riksdag_at_work"],
		},
	},
	{
		id: "riddarhuset",
		kind: "palace_01",
		name: "Riddarhuset",
		position: [-18.6, -12.6],
		altitude: ISLAND,
		// Its front to the north, over its garden to the water.
		rotation: turned(180),
		colors: paint({ walls: "#a14f38", trim: "#e9dcc2", plinth: "#8a4230", roof: "#4c5a54" }),
		props: {
			width: 4.6,
			depth: 2.4,
			floorCount: 3,
			wingDepth: 1.2,
			showsSideWings: false,
			seed: 3,
		},
	},
	{
		id: "borshuset",
		kind: "palace_01",
		name: "Börshuset",
		position: onStortorget([0.3, -3.5]),
		altitude: ISLAND,
		rotation: turned(25),
		colors: paint({ walls: "#efe6cf", trim: "#f7f2e6", plinth: "#d8cdb4", roof: "#4f5a55" }),
		props: { width: 4.8, depth: 2, floorCount: 3, wingDepth: 0.8, showsSideWings: false, seed: 6 },
	},
	{
		id: "wrangelska_palatset",
		kind: "palace_01",
		name: "Wrangelska palatset",
		position: [-40.9, -5.6],
		altitude: ISLAND,
		rotation: turned(105),
		colors: paint({ walls: "#e3c78f", roof: "#4c5a54" }),
		props: { width: 5.6, depth: 4, floorCount: 3, wingDepth: 1.3, showsSideWings: false, seed: 11 },
	},
	// Riddarholmen's palaces round its church, and Norstedts' brick house at its south end.
	...(
		[
			["stenbockska_palatset", "Stenbockska palatset", -34.3, -6.1, 0, 3.6, 2.6, "#e8d6a6"],
			["gamla_riksdagshuset", "Gamla riksdagshuset", -39, 1.2, 90, 4.4, 3.2, "#e3cfa8"],
			[
				"schering_rosenhanes_palats",
				"Schering Rosenhanes palats",
				-36,
				6.5,
				90,
				3.2,
				2.4,
				"#efd9a4",
			],
			["norstedtshuset", "Norstedtshuset", -29.6, 10.6, 180, 4.6, 2.4, "#9c4b36"],
		] as [string, string, number, number, number, number, number, string][]
	).map(([id, name, x, z, turn, width, depth, walls], i) => ({
		id,
		kind: "palace_01",
		name,
		position: [x, z] as TVec2,
		altitude: ISLAND,
		rotation: turned(turn),
		colors: paint({ walls, roof: "#4c5a54" }),
		props: {
			width,
			depth,
			floorCount: 3 + (i % 2),
			wingDepth: 1,
			showsSideWings: false,
			seed: 20 + i,
		},
	})),
	{
		id: "tessinska_palatset",
		kind: "palace_01",
		name: "Tessinska palatset",
		position: byThePalace([5, 10.6]),
		altitude: ISLAND,
		// Facing the palace across Slottsbacken.
		rotation: turned(205),
		colors: paint({ walls: "#ead7a8", roof: "#4c5a54" }),
		props: { width: 3.6, depth: 2.6, floorCount: 4, wingDepth: 1, showsSideWings: false, seed: 2 },
	},
	{
		id: "operan",
		kind: "palace_01",
		name: "Kungliga Operan",
		position: OPERAN,
		colors: paint({ walls: "#e8d3a6", trim: "#f4ead2", roof: "#7aa892" }),
		props: {
			width: 6.4,
			depth: 4.6,
			floorCount: 3,
			wingDepth: 1.6,
			showsSideWings: false,
			seed: 7,
		},
	},
	{
		id: "arvfurstens_palats",
		kind: "palace_01",
		name: "Arvfurstens palats",
		position: ARVFURSTENS_PALATS,
		colors: paint({ walls: "#e9d9b8", roof: "#4c5a54" }),
		props: { width: 6, depth: 4.6, floorCount: 4, wingDepth: 1.6, showsSideWings: false, seed: 8 },
	},
	{
		id: "rosenbad",
		kind: "palace_01",
		name: "Rosenbad",
		position: ROSENBAD,
		colors: paint({ walls: "#e6d4ae", roof: "#6d8d7f" }),
		props: { width: 6, depth: 5, floorCount: 5, wingDepth: 1.6, showsSideWings: false, seed: 12 },
	},
	{
		id: "grand_hotel",
		kind: "palace_01",
		name: "Grand Hôtel",
		position: GRAND_HOTEL,
		colors: paint({ walls: "#efe6d4", trim: "#faf6ee", roof: "#4f5a55" }),
		props: { width: 7, depth: 4.6, floorCount: 6, wingDepth: 1.6, showsSideWings: false, seed: 13 },
	},
	{
		id: "nationalmuseum",
		kind: "palace_01",
		name: "Nationalmuseum",
		position: NATIONALMUSEUM,
		colors: paint({ walls: "#e6dcc3", roof: "#7aa892" }),
		props: { width: 8, depth: 5, floorCount: 3, wingDepth: 1.6, showsSideWings: false, seed: 14 },
	},
	{
		id: "stadsmuseet",
		kind: "palace_01",
		name: "Stadsmuseet",
		position: STADSMUSEET,
		altitude: onSoder(...STADSMUSEET),
		rotation: turned(180),
		colors: paint({ walls: "#e8c983", roof: "#4f5a55" }),
		props: {
			width: 5.2,
			depth: 3.6,
			floorCount: 3,
			wingDepth: 1.2,
			showsSideWings: false,
			seed: 15,
		},
	},
	{
		// Söderleden's tunnel under Södermalm, where Centralbron's traffic goes in.
		id: "soderleden_tunnel",
		kind: "tunnel_01",
		name: "Söderleden tunnel",
		position: TUNNEL_MOUTH,
		altitude: 0.98,
		rotation: turned(-78.2),
		colors: paint({ walls: "#8c8a86", roof: "#7d7b77" }),
		props: { length: 2.4, width: 1.9, height: 1.1 },
		label: {
			title: "Centralbron",
			dataKeys: ["centralbron_traffic"],
			offset: [0, 1.6, 0],
		},
		details: {
			description: "Traffic over Centralbron, between Norrmalm and Södermalm.",
			dataKeys: ["centralbron_traffic"],
		},
	},
	// Stortorget's well, in the middle of the square.
	{
		id: "stortorget_well",
		kind: "fountain_01",
		name: "Stortorgsbrunnen",
		position: onStortorget([0, 0.2]),
		altitude: ON_ISLAND,
		scale: 0.7,
	},
	// Strömsborg's yellow house on its islet.
	{
		id: "stromsborg_house",
		kind: "house_01",
		name: "Strömsborg",
		position: [-34.7, -21.5],
		altitude: ISLAND,
		colors: paint({ roof: "#9c4a36" }),
		props: { width: 1.4, depth: 1.1, height: 1, roofHeight: 0.6 },
	},
	// Birger Jarls torn on Riddarholmen: a round brick tower with a cone roof.
	{
		id: "birger_jarls_torn",
		kind: "cylinder_01",
		name: "Birger Jarls torn",
		position: [-40.6, -10.4],
		altitude: ISLAND,
		colors: paint({ surface: "#a35a42" }),
		props: { width: 1.3, depth: 1.3, height: 2.6, sideCount: 12 },
	},
	{
		id: "birger_jarls_torn_roof",
		kind: "cone_01",
		name: "Birger Jarls torn's roof",
		position: [-40.6, -10.4],
		altitude: ISLAND + 2.6,
		colors: paint({ surface: "#4c5a54" }),
		props: { width: 1.45, depth: 1.45, height: 1.1 },
	},
	// Kastellet on Kastellholmen: a small brick castle with a round tower and the flag.
	{
		id: "kastellet",
		kind: "box_01",
		name: "Kastellet",
		position: [86, 20.7],
		altitude: ISLAND,
		colors: paint({ surface: "#b85a43" }),
		props: { width: 2.6, depth: 1.8, height: 1.1 },
	},
	{
		id: "kastellet_tower",
		kind: "cylinder_01",
		name: "Kastellet's tower",
		position: [86, 20.7],
		altitude: ISLAND + 1.1,
		colors: paint({ surface: "#c0634a" }),
		props: { width: 1.3, depth: 1.3, height: 1.1, sideCount: 16 },
	},
	{
		id: "kastellet_flag",
		kind: "flagpole_01",
		name: "Kastellet's flag",
		position: [86, 20.7],
		altitude: ISLAND + 2.2,
		props: { height: 1.3, flagWidth: 0.6, design: "nordicCross" },
	},
	// Skeppsholmskyrkan: an eight-sided church under a dome.
	{
		id: "skeppsholmskyrkan",
		kind: "cylinder_01",
		name: "Skeppsholmskyrkan",
		position: [56.5, -11],
		altitude: ISLAND,
		colors: paint({ surface: "#ead9b0" }),
		props: { width: 3, depth: 3, height: 1.7, sideCount: 8 },
	},
	{
		id: "skeppsholmskyrkan_dome",
		kind: "dome_01",
		name: "Skeppsholmskyrkan's dome",
		position: [56.5, -11],
		altitude: ISLAND + 1.7,
		colors: paint({ surface: "#5d6b66" }),
		props: { width: 2.8, depth: 2.8, height: 1.2 },
	},
	// Katarinahissen: the lift up from Slussen to the heights, its footbridge a road (above).
	{
		id: "katarinahissen",
		kind: "box_01",
		name: "Katarinahissen",
		position: KATARINAHISSEN_AT,
		colors: paint({ surface: "#3b3f44" }),
		props: { width: 0.9, depth: 0.9, height: KATARINAHISSEN_TOP },
	},
	// Moderna museet on Skeppsholmen, along the island.
	{
		id: "moderna_museet",
		kind: "depot_01",
		name: "Moderna museet",
		position: [66, -10.2],
		altitude: ISLAND,
		rotation: turned(-41),
		colors: paint({ walls: "#e4dccb", roof: "#8a8f8c" }),
		props: { width: 6, depth: 2.6, height: 1, showsGarageDoor: false },
	},
];

// ---------------------------------------------------------------- the rest of the town

/** Stockholm's stucco: ochre, pale yellow, salmon, grey, beige. */
const CITY_WALLS = ["#d9b77a", "#e8d6a8", "#d99c7f", "#c9c3b5", "#e3cfa8", "#c98f63", "#efe2c4"];

/** A row of houses on the mainland, standing on the ground there. */
const mainlandRow = (
	id: string,
	at: TVec2,
	turn: number,
	houseCount: number,
	more: Record<string, unknown> = {},
	i = 0,
): TEntityInput => ({
	id,
	kind: "terraced_row_02",
	position: at,
	altitude: onSoder(at[0], at[1]),
	rotation: turned(turn),
	colors: paint({
		walls: CITY_WALLS[i % CITY_WALLS.length],
		secondWalls: CITY_WALLS[(i + 2) % CITY_WALLS.length],
		thirdWalls: CITY_WALLS[(i + 4) % CITY_WALLS.length],
		fourthWalls: CITY_WALLS[(i + 5) % CITY_WALLS.length],
		roof: "#4a4545",
	}),
	props: {
		houseCount,
		houseWidth: 1.1,
		depth: 2.2,
		floorCount: 6,
		gableShare: 0.05,
		shopShare: 0.7,
		seed: 300 + i * 17,
		...more,
	},
});

/** The lowest ground under a row on Södermalm's slope, so none of it floats. */
const lowestUnder = (at: TVec2, turn: number, length: number, depth: number) =>
	Math.min(
		...(
			[
				[0, 0],
				[-length / 2, -depth / 2],
				[length / 2, -depth / 2],
				[length / 2, depth / 2],
				[-length / 2, depth / 2],
			] as TVec2[]
		).map((point) => onSoder(...inFrame(at, turn)(point))),
	);

/**
 * The city's stone blocks, on Norrmalm, Kungsholmen and Södermalm's heights: rows of tall
 * houses round a courtyard, each side a row (light to draw, ADR-0143).
 */
const HOUSE_IN_BLOCK = 1.1;
const cityBlock = (block: ILaidBlock, floorCount: number, i: number): TEntityInput[] => {
	const [width, depth] = block.size;
	const at = inFrame(block.centre, block.turn);
	// Back to back where the block is too narrow for a courtyard, their eaves just apart.
	const rowDepth = Math.min(2, depth / 2 - 0.05);
	const more = { floorCount, depth: rowDepth, gableShare: 0.05, floorCountVariation: 0 };
	const across = Math.floor(width / HOUSE_IN_BLOCK);
	const along = Math.floor((depth - 2 * rowDepth) / HOUSE_IN_BLOCK);
	const row = (side: string, local: TVec2, turn: number, count: number, colour: number) => {
		const position = at(local);
		const length = count * HOUSE_IN_BLOCK;
		return {
			...mainlandRow(`city_block_${i}_${side}`, position, block.turn + turn, count, more, colour),
			altitude: lowestUnder(position, block.turn + turn, length, rowDepth),
		};
	};
	return [
		row("south", [0, depth / 2 - rowDepth / 2], 0, across, i),
		row("north", [0, -depth / 2 + rowDepth / 2], 180, across, i + 3),
		...(along > 0
			? [
					row("east", [width / 2 - rowDepth / 2, 0], 90, along, i + 1),
					row("west", [-width / 2 + rowDepth / 2, 0], -90, along, i + 4),
				]
			: []),
	];
};

/** Roads as lines with their half widths, to keep the blocks off them. */
const ROAD_LINES = ROADS.filter((road) => road.kind !== "hidden_route_01").map((road) => ({
	points: road.points.map(([x, z]): TVec2 => [x, z]),
	half: (road.width ?? 1) / 2,
}));

/** The mainland's landmarks and parks: no blocks there. */
const BLOCK_KEEP_OUT: TVec2[][] = [
	turnedRect(OPERAN, 0, 7.6, 6.2),
	turnedRect(ARVFURSTENS_PALATS, 0, 7.2, 6.2),
	turnedRect(ROSENBAD, 0, 7.2, 6.6),
	turnedRect(GRAND_HOTEL, 0, 8.2, 6.2),
	turnedRect(NATIONALMUSEUM, 0, 9.2, 6.6),
	turnedRect(STADSHUSET, 0, 11, 8.6),
	turnedRect(STADSMUSEET, 0, 6.4, 5.2),
	turnedRect(TUNNEL_MOUTH, -78.2, 4, 3.4),
	turnedRect(KATARINAHISSEN_AT, 0, 2, 2),
	KUNGSTRADGARDEN,
	KARL_XII_TORG,
	GUSTAV_ADOLFS_TORG,
	STADSHUSET_GARDEN,
	DJURGARDEN,
	IVAR_LOS_PARK,
];

/** Whether a city block may stand on a point: on land, off the roads, clear of Södermalm's cliffs. */
const isBuildable = (point: TVec2) =>
	Math.abs(point[0]) < GROUND[0] / 2 - 0.3 &&
	Math.abs(point[1]) < GROUND[1] / 2 - 0.3 &&
	!isInsidePolygon(point, WATER) &&
	edgeDistance(point, WATER) > 0.5 &&
	edgeDistance(point, SODERMALM_OUTLINE) > 0.5 &&
	ROAD_LINES.every(({ points, half }) =>
		points.slice(1).every((end, i) => segmentDistance(point, points[i], end) > half + 0.4),
	) &&
	BLOCK_KEEP_OUT.every((zone) => !isInsidePolygon(point, zone));

const BLOCK_SIZE: TVec2 = [6.6, 5.5];
const BLOCK_STREET = 1.3;

const cityBlocks: TEntityInput[] = (
	[
		// Norrmalm, from Klara sjö to Blasieholmen.
		{ origin: [-2, -52], columns: [-8, 6], rows: [-1, 3], floorCount: 7 },
		// Kungsholmen, round Stadshuset.
		{ origin: [-84.6, -43], columns: [0, 1], rows: [-2, 3], floorCount: 6 },
		// Södermalm's heights.
		{ origin: [-83, 50.6], columns: [0, 16], rows: [-1, 1], floorCount: 6 },
	] as const
)
	.flatMap(({ origin, columns, rows, floorCount }) =>
		layBlocks(
			{
				origin: [...origin],
				turn: 0,
				size: BLOCK_SIZE,
				street: BLOCK_STREET,
				columns: [...columns],
				rows: [...rows],
			},
			isBuildable,
		).map((block) => ({ block, floorCount })),
	)
	.flatMap(({ block, floorCount }, i) => cityBlock(block, floorCount, i));

/** The tall houses along Söder Mälarstrand, at the foot of Mariaberget's cliff. */
const soderShoreRows: TEntityInput[] = layRowsAlong({
	streets: [
		{
			id: SODER_SHORE_ID,
			points: SODER_SHORE_POINTS,
			width: 1.1,
			right: { depths: [1.6, 1.3, 1], houseWidth: 1.1, mostHouses: 6 },
		},
	],
	// Between the road and the cliff.
	land: [...SODER_SHORE_POINTS, ...SODERMALM_OUTLINE.slice(0, 6).reverse()],
	// Not under Centralbron.
	keepOut: [turnedRect([-11.5, 38.5], -78.2, 7, 4)],
	shoreMargin: 0.15,
}).map((row, i) =>
	mainlandRow(
		`soder_malarstrand_row_${i}`,
		row.position,
		row.turn,
		row.houseCount,
		{ depth: row.depth, floorCount: 6, floorCountVariation: 1, shopShare: 0.3 },
		i + 2,
	),
);

/** Skeppsholmen's old naval buildings, long and yellow, along the island. */
const skeppsholmenRows: TEntityInput[] = (
	[
		[53, -23.5, 5],
		[60, -20, 6],
		[70, -13, 6],
		[78, -6, 6],
	] as [number, number, number][]
).map(([x, z, houseCount], i) => ({
	...mainlandRow(
		`skeppsholmen_row_${i}`,
		[x, z],
		-41,
		houseCount,
		{ floorCount: 3, houseWidth: 1.2, shopShare: 0 },
		i,
	),
	altitude: ISLAND,
	colors: paint({
		walls: "#e8c983",
		secondWalls: "#e8c983",
		thirdWalls: "#edd59a",
		fourthWalls: "#e2bd74",
		roof: "#9c4a36",
	}),
}));

// ---------------------------------------------------------------- traffic and boats

const CAR_COLOURS = ["#f2f2ee", "#1f2a3c", "#c8102e", "#8a8f94", "#2f5d8a", "#1f1f24", "#d9b44a"];

/** Among Centralbron's flow of cars (on the road itself): red buses and a lorry. */
const centralbronTraffic: TEntityInput[] = [0, 1, 2].map((i) => ({
	id: `centralbron_vehicle_${i}`,
	kind: i === 2 ? "truck_01" : "bus_01",
	name: i === 2 ? "Lorry" : "Red bus",
	scale: 0.42,
	colors: paint(i === 2 ? { cab: "#2f5d8a" } : { body: "#c8102e" }),
	follow: {
		roadId: CENTRALBRON_ID,
		speed: 2.6,
		startDistance: 20 + i * 37,
		drivesTheOtherWay: i === 1,
	},
}));

const otherTraffic: TEntityInput[] = [
	...[0, 1].map((i) => ({
		id: `red_bus_${i}`,
		kind: "bus_01",
		name: "Red bus",
		scale: 0.42,
		colors: paint({ body: "#c8102e" }),
		follow: {
			roadId: i === 0 ? SKEPPSBRON_ID : STROMGATAN_IDS[2],
			speed: 1.6,
			startDistance: 4 + i * 20,
		},
	})),
	...Array.from({ length: 6 }, (_, i) => ({
		id: `city_car_${i}`,
		kind: i % 3 === 2 ? "delivery_van_01" : "car_01",
		scale: CAR,
		colors: paint({ body: CAR_COLOURS[(i + 2) % CAR_COLOURS.length] }),
		follow: {
			roadId: [STROMGATAN_IDS[0], STADSGARDEN_ID, MUNKBROLEDEN_ID][i % 3],
			speed: 2.4 + (i % 2) * 0.5,
			startDistance: 10 + i * 23,
			drivesTheOtherWay: i % 2 === 0,
		},
	})),
];

const boats: TEntityInput[] = [
	{
		id: "djurgarden_ferry",
		kind: "ferry_01",
		name: "Djurgården ferry",
		scale: 0.8,
		colors: paint({ hull: "#1d4f7a", funnel: "#f2c230", decks: "#f4f1ea" }),
		props: { length: 3.4 },
		follow: { roadId: DJURGARDEN_FERRY_ID, speed: 1.4, startDistance: 2 },
		// Its cabins glow brighter the more passengers it carries: 120 is 100%.
		lights: { cabins: { data: { strength: { key: "ferry_passengers", valueAtFull: 120 } } } },
		label: {
			title: "Djurgården ferry",
			dataKeys: ["ferry_next", "ferry_passengers"],
			offset: [0, 1.6, 0],
		},
		details: {
			description: "From Slussen to Djurgården across Saltsjön, all evening.",
			dataKeys: ["ferry_next", "ferry_passengers", "ferry_delay"],
		},
	},
	{
		id: "archipelago_boat",
		kind: "ferry_01",
		name: "Archipelago boat",
		scale: 0.85,
		colors: paint({ hull: "#f4f1ea", funnel: "#1f1f24", decks: "#f4f1ea" }),
		props: { length: 4 },
		follow: { roadId: ARCHIPELAGO_ID, speed: 1.2, startDistance: 30 },
		label: {
			title: "Archipelago boat",
			dataKeys: ["archipelago_next"],
			offset: [0, 1.6, 0],
			showsAsChip: true,
		},
	},
	{
		id: "riddarfjarden_boat",
		kind: "ferry_01",
		name: "Mälaren boat",
		scale: 0.8,
		colors: paint({ hull: "#f4f1ea", funnel: "#c8102e", decks: "#f4f1ea" }),
		props: { length: 3.6 },
		follow: { roadId: RIDDARFJARDEN_ID, speed: 1.1, startDistance: 12 },
	},
	// Moored at Strömkajen, waiting for the archipelago.
	...(
		[
			[22.8, -32.2],
			[27, -31.6],
		] as TVec2[]
	).map((at, i) => ({
		id: `stromkajen_boat_${i}`,
		kind: "ferry_01",
		name: "Archipelago boat (moored)",
		position: at,
		rotation: turned(-4),
		scale: 0.8,
		colors: paint({ hull: "#f4f1ea", funnel: i === 0 ? "#1f1f24" : "#c8102e" }),
		props: { length: 3.6 },
	})),
	// A Baltic ferry at Stadsgården, lit up for the night crossing.
	{
		id: "baltic_ferry",
		kind: "ferry_01",
		name: "Baltic ferry",
		position: [45, 53.2],
		rotation: turned(163),
		colors: paint({ hull: "#c8102e", funnel: "#f4f1ea", decks: "#f4f1ea" }),
		props: { length: 14 },
	},
	// af Chapman, the old full-rigger, moored at Skeppsholmen's west quay with its sails furled.
	{
		id: "af_chapman",
		kind: "sailing_boat_01",
		name: "af Chapman",
		position: [44.6, -6],
		rotation: turned(99),
		scale: 1.1,
		colors: paint({ hull: "#f4f1ea" }),
		props: { length: 6, showsSails: false },
	},
	// Yachts moored in Nybroviken and off Skeppsholmen.
	...(
		[
			[50, -42, 60, 2.2],
			[51.6, -47, 60, 2.6],
			[56.6, -46, 240, 2],
			[76, -22, 160, 2.4],
		] as [number, number, number, number][]
	).map(([x, z, turn, length], i) => ({
		id: `moored_yacht_${i}`,
		kind: "yacht_01",
		position: [x, z] as TVec2,
		rotation: turned(turn),
		scale: 0.6,
		props: { length, deckCount: 1 + (i % 2) },
	})),
	...(
		[
			[-55, -20, 30],
			[-62, 16, 200],
			[-30, 26, 330],
		] as [number, number, number][]
	).map(([x, z, turn], i) => ({
		id: `sailing_boat_${i}`,
		kind: "sailing_boat_01",
		position: [x, z] as TVec2,
		rotation: turned(turn),
		scale: 0.6,
		colors: paint({ sails: ["#f4f1ea", "#f2c230", "#e2603b"][i] }),
		props: { length: 2 },
	})),
];

// ---------------------------------------------------------------- lights

/** Points every `spacing` along a line of [x, z, altitude] points, `offset` to its left (negative: right). */
const along = (points: [number, number, number][], spacing: number, offset: number) => {
	const spots: { at: TVec2; altitude: number; turn: number }[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const [ax, az, ay] = points[i];
		const [bx, bz, by] = points[i + 1];
		const length = Math.hypot(bx - ax, bz - az);
		const count = Math.max(1, Math.round(length / spacing));
		const [dx, dz] = [(bx - ax) / length, (bz - az) / length];
		for (let k = 0; k < count; k++) {
			const t = (k + 0.5) / count;
			spots.push({
				at: [
					round(ax + (bx - ax) * t + dz * offset, 2),
					round(az + (bz - az) * t - dx * offset, 2),
				],
				altitude: round(ay + (by - ay) * t, 2),
				turn: round((Math.atan2(dx, dz) * 180) / Math.PI),
			});
		}
	}
	return spots;
};

const pointsOf = (id: string) =>
	(ROADS.find((road) => road.id === id)?.points ?? []).map(
		([x, z, altitude = 0]): [number, number, number] => [x, z, altitude],
	);

/** Lamps along a road, both sides by turns. */
const lampsAlong = (
	roadId: string,
	kind: string,
	spacing: number,
	offset: number,
	sides: "both" | "left" | "right" = "both",
	more: Partial<TEntityInput> = {},
	/** Which spots get one: all by default. */
	where: (spot: { at: TVec2; altitude: number }) => boolean = () => true,
): TEntityInput[] =>
	[
		...(sides === "right" ? [] : along(pointsOf(roadId), spacing, offset)),
		...(sides === "left" ? [] : along(pointsOf(roadId), spacing, -offset)),
	]
		.filter(where)
		.map((spot, i) => ({
			id: `${roadId}_lamp_${i}`,
			kind,
			position: spot.at,
			altitude: spot.altitude,
			...more,
		}));

const lamps: TEntityInput[] = [
	// Centralbron's lamps, along both sides of the deck.
	...lampsAlong(
		CENTRALBRON_ID,
		"street_lamp_01",
		6,
		0.92,
		"both",
		{ props: { height: 1.1 } },
		// Not into the tunnel.
		(spot) => spot.at[1] < 40,
	),
	// Lanterns on the old bridges' spans.
	...["vasabron", "norrbro", "strombron", "riksbron"].flatMap((id) =>
		lampsAlong(
			id,
			"street_lamp_02",
			2.6,
			0.7,
			"both",
			{ props: { height: 0.9 } },
			(spot) => spot.altitude > ISLAND + 0.05,
		),
	),
	...["skeppsholmsbron", "riddarholmsbron", "kastellholmsbron"].flatMap((id) =>
		lampsAlong(id, "street_lamp_02", 1.6, 0.5, "both", { props: { height: 0.8 } }),
	),
	// Slussen's, over the water.
	...lampsAlong(
		"slussen",
		"street_lamp_02",
		1.6,
		0.85,
		"both",
		{ props: { height: 0.9 } },
		(spot) => spot.altitude > ISLAND + 0.05,
	),
	// Along the quays: Skeppsbron's water side, Munkbroleden's.
	...lampsAlong(SKEPPSBRON_ID, "street_lamp_02", 3, 0.72, "left", { props: { height: 0.95 } }),
	...lampsAlong(MUNKBROLEDEN_ID, "street_lamp_02", 3, 0.72, "right", { props: { height: 0.95 } }),
	// The mainland's waterfronts.
	...STROMGATAN_IDS.flatMap((id) =>
		lampsAlong(id, "street_lamp_01", 5, 0.75, "right", { props: { height: 1.1 } }),
	),
	...[SODER_SHORE_ID, STADSGARDEN_ID].flatMap((id) =>
		lampsAlong(id, "street_lamp_01", 6, 0.75, "left", { props: { height: 1.1 } }),
	),
];

/** Lanterns round Stortorget, on Slottsbacken and the squares, and park lamps in the gardens. */
const squareLamps: TEntityInput[] = [
	...(
		[
			onStortorget([-1.8, -1.3]),
			onStortorget([1.8, -1.3]),
			onStortorget([-1.8, 1.3]),
			onStortorget([1.8, 1.3]),
			byThePalace([-1.5, 5.8]),
			byThePalace([2, 5.8]),
			byThePalace([5.5, 5.8]),
			byThePalace([9, 5.8]),
			[9.2, 19.2],
			[11.8, 21.4],
			[-0.2, 19.9],
			[3.4, 22],
			[-8, -15.9],
			[-4.8, -15.9],
		] as TVec2[]
	).map((at, i) => ({
		id: `square_lantern_${i}`,
		kind: "street_lamp_02",
		position: at,
		altitude: ISLAND,
		props: { height: 0.95 },
	})),
	...[-47, -51, -55, -59].map((z) => ({
		id: `kungstradgarden_lamp_${-z}`,
		kind: "street_lamp_04",
		position: [5.3, z] as TVec2,
	})),
	...(
		[
			[50.2, -10],
			[51.6, -2],
			[70, 4],
			[77, 4],
			[-41.4, 4.6],
			[-0.6, -28.4],
		] as TVec2[]
	).map((at, i) => ({
		id: `park_lamp_${i}`,
		kind: "street_lamp_04",
		position: at,
		altitude: ON_ISLAND,
	})),
];

/** Beacons at the ferry landings: their colour follows the ferry's delay, green on time, red late. */
const beacons: TEntityInput[] = (
	[
		[20.6, 31.2, ISLAND],
		[24.5, -36.3, 0],
		[56, 9.5, ISLAND],
	] as [number, number, number][]
).map(([x, z, altitude], i) => ({
	id: `ferry_beacon_${i}`,
	kind: "beacon_01",
	name: ["Ferry landing, Slussen", "Ferry landing, Strömkajen", "Ferry landing, Skeppsholmen"][i],
	position: [x, z] as TVec2,
	altitude,
	props: { radius: 0.5, pulses: true },
	colors: {
		ring: {
			data: {
				color: {
					key: "ferry_delay",
					valueAtLowColor: 0,
					valueAtHighColor: 10,
					lowColor: "#2bb58c",
					highColor: "#e0483b",
				},
			},
		},
	},
	...(i === 0
		? {
				label: {
					title: "Ferry delay",
					dataKeys: ["ferry_delay"],
					offset: [0, 1.2, 0] as [number, number, number],
				},
			}
		: {}),
}));

// ---------------------------------------------------------------- trees

const trees: TEntityInput[] = [
	// Kungsträdgården's rows of trees, its cherry trees at the south end.
	...[3.2, 7.4].flatMap((x) =>
		[-46, -50, -54, -58].map((z, k) => ({
			id: `kungstradgarden_tree_${x}_${-z}`,
			kind: k === 0 ? "fruit_tree_01" : "round_tree_01",
			position: [x, z] as TVec2,
			scale: 0.9,
		})),
	),
	// Skeppsholmen's parks, Strömparterren, Riddarhuset's garden, Stadshuset's garden, Kastellholmen.
	...(
		[
			[49.5, -13, ON_ISLAND, "round_tree_02"],
			[51, -6, ON_ISLAND, "round_tree_01"],
			[52, 0, ON_ISLAND, "birch_01"],
			[50.4, -15.2, ON_ISLAND, "round_tree_01"],
			[66, 4, ON_ISLAND, "round_tree_02"],
			[72, 6.5, ON_ISLAND, "round_tree_01"],
			[79, 4.5, ON_ISLAND, "birch_01"],
			[74, 1, ON_ISLAND, "round_tree_02"],
			[-0.8, -30, ON_ISLAND, "round_tree_01"],
			[0.2, -27.2, ON_ISLAND, "round_tree_02"],
			[-21, -15.2, ON_ISLAND, "round_tree_02"],
			[-17, -15.3, ON_ISLAND, "round_tree_01"],
			[-79, -17.6, 0, "round_tree_02"],
			[-75, -17.8, 0, "round_tree_01"],
			[-71.5, -18.4, 0, "round_tree_02"],
			[89, 26, ON_ISLAND, "pine_tree_01"],
			[84.5, 25.5, ON_ISLAND, "bush_01"],
			[90.5, 20, ON_ISLAND, "pine_tree_01"],
		] as [number, number, number, string][]
	).map(([x, z, altitude, kind], i) => ({
		id: `tree_${i}`,
		kind,
		position: [x, z] as TVec2,
		altitude,
		scale: 0.85,
	})),
	// Djurgården's tip.
	...(
		[
			[86, -50],
			[89, -42],
			[84.5, -56],
			[90, -56],
			[88, -37],
		] as TVec2[]
	).map(([x, z], i) => ({
		id: `djurgarden_tree_${i}`,
		kind: i % 2 === 0 ? "round_tree_01" : "birch_01",
		position: [x, z] as TVec2,
		scale: 0.9,
	})),
	// Ivar Los park, on Mariaberget.
	...(
		[
			[-46, 40.5],
			[-42, 41.5],
			[-38, 40.8],
			[-44, 43],
			[-39, 43.2],
		] as TVec2[]
	).map(([x, z], i) => ({
		id: `soder_tree_${i}`,
		kind: i % 3 === 0 ? "pine_tree_01" : "birch_01",
		position: [x, z] as TVec2,
		altitude: onSoder(x, z),
		scale: 0.85,
	})),
];

// ---------------------------------------------------------------- data, moods and views

const DATA: TSceneInput["data"] = {
	values: [
		{ key: "ferry_next", name: "Next ferry to Djurgården", value: 7, unit: " min", about: EXAMPLE },
		{ key: "ferry_passengers", name: "Ferry passengers", value: 96, about: EXAMPLE },
		{ key: "ferry_delay", name: "Ferry delay", value: 2, unit: " min", about: EXAMPLE },
		{
			key: "archipelago_next",
			name: "Next boat to the archipelago",
			value: "18:15",
			about: EXAMPLE,
		},
		{
			key: "centralbron_traffic",
			name: "Centralbron traffic",
			value: 3400,
			unit: " vehicles/h",
			about: EXAMPLE,
		},
		{ key: "palace_visitors", name: "Palace visitors today", value: 4870, about: EXAMPLE },
		{
			key: "riksdag_at_work",
			name: "Riksdag offices at work",
			value: 64,
			unit: "%",
			about: EXAMPLE,
		},
		{ key: "stadshuset_tours", name: "Stadshuset tours today", value: 23, about: EXAMPLE },
		{ key: "water_temperature", name: "Water temperature", value: 9, unit: "°C", about: EXAMPLE },
	],
};

const SKY: TSceneInput["sky"] = { starDensity: 0.8 };
const WEATHER: TSceneInput["weather"] = { cloudCover: 0.25 };
const WATER_LOOK: TSceneInput["water"] = { rippleStrength: 0.35, reflectionStrength: 0.7 };
const TILT_SHIFT: TTiltShiftInput = {
	enabled: true,
	blurStrength: 0.35,
	sharpBandHeight: 0.42,
	sharpBandPosition: 0.5,
};
const LIGHTING = { dayLength: 120, sunShadeContrast: 0.7 } satisfies TLightingInput;
/** From half past five into the night: a whole day in two minutes while motion plays. */
const EVENING_PASSES = { ...LIGHTING, time: 17.5, timeSource: "cycle" } satisfies TLightingInput;

const mood = (id: string, name: string, lighting: TLightingInput): TMoodInput => ({
	id,
	name,
	lighting: { ...LIGHTING, ...lighting },
	sky: SKY,
	water: WATER_LOOK,
	weather: WEATHER,
	tiltShift: TILT_SHIFT,
});

const MOODS = [
	mood("mood_evening", "The evening passes", EVENING_PASSES),
	mood("mood_day", "A summer's day", { time: 13, timeSource: "fixed" }),
	mood("mood_dusk", "Dusk", { time: 18.7, timeSource: "fixed" }),
	mood("mood_blue", "Blue hour", { time: 19.6, timeSource: "fixed" }),
	mood("mood_night", "Night", { time: 22.5, timeSource: "fixed" }),
];

const VIEWPOINTS: TSceneInput["viewpoints"] = [
	{
		id: "view_gamla_stan",
		name: "Gamla stan",
		description: "The old town between its waters, the palace at its top.",
		target: [2, 6],
		azimuth: 300,
		elevation: 30,
		span: 80,
		projection: "perspective",
		moodId: "mood_evening",
	},
	{
		id: "view_overview",
		name: "Overview",
		description: "From Stadshuset to Skeppsholmen, Norrmalm to Södermalm.",
		target: [0, 0],
		span: 175,
	},
	{
		id: "view_stortorget",
		name: "Stortorget",
		description: "The old square, its stepped gables lit at blue hour.",
		target: STORTORGET_MIDDLE,
		targetAltitude: ISLAND,
		azimuth: 15,
		elevation: 34,
		span: 13,
		projection: "perspective",
		moodId: "mood_blue",
	},
	{
		id: "view_palace",
		name: "The palace from the water",
		description: "Kungliga slottet floodlit over Strömmen, the Riksdag beside it.",
		target: PALACE_MIDDLE,
		targetAltitude: 1,
		azimuth: 55,
		elevation: 12,
		span: 26,
		projection: "perspective",
		moodId: "mood_dusk",
	},
	{
		id: "view_riddarholmen",
		name: "Riddarholmen at dusk",
		description: "The iron spire against the sky, Centralbron's lights behind.",
		target: [-32, 1],
		targetAltitude: 1.5,
		azimuth: 215,
		elevation: 14,
		span: 22,
		projection: "perspective",
		moodId: "mood_dusk",
	},
	{
		id: "view_stadshuset",
		name: "Stadshuset",
		description: "The city hall's tower and its three crowns over Riddarfjärden.",
		target: [-73, -22],
		targetAltitude: 2.5,
		azimuth: 320,
		elevation: 10,
		span: 20,
		projection: "perspective",
		moodId: "mood_night",
	},
	{
		id: "view_centralbron",
		name: "Centralbron",
		description: "The evening traffic's headlights along the canal.",
		target: [-17, 25],
		targetAltitude: 1,
		azimuth: 255,
		elevation: 16,
		span: 22,
		projection: "perspective",
		moodId: "mood_night",
	},
	{
		id: "view_skeppsbron",
		name: "Skeppsbron from Saltsjön",
		description: "The merchants' houses along the quay, the ferries coming in.",
		target: [24, 6],
		targetAltitude: 1.5,
		azimuth: 350,
		elevation: 12,
		span: 30,
		projection: "perspective",
		moodId: "mood_blue",
	},
	{
		id: "view_slussen",
		name: "Slussen and Södermalm",
		description: "Södermalm's heights over Slussen, Katarinahissen and the Baltic ferry.",
		target: [14, 44],
		targetAltitude: 1.5,
		azimuth: 55,
		elevation: 14,
		span: 34,
		projection: "perspective",
		moodId: "mood_night",
	},
	{
		id: "view_monteliusvagen",
		name: "From Monteliusvägen",
		description:
			"Over Riddarfjärden from Södermalm's heights: Riddarholmen, Stadshuset, the evening.",
		target: [-42, -5],
		targetAltitude: 1,
		azimuth: 262,
		elevation: 12,
		span: 70,
		projection: "perspective",
		moodId: "mood_evening",
	},
];

/** Gamla stan and the waters round it, its evening of lights, with example data. */
export const createStockholmScene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: { title: "Stockholm", subtitle: "Gamla stan's evening, with example data" },
		theme: "system",
		// The city's streets and squares paved, its islands' lanes cobbled (ADR-0137).
		// At this map's scale (12.5 m to a unit) the patterns are drawn at half their size.
		surface: { enabled: true, patternScale: 0.5 },
		ground: {
			width: GROUND[0],
			depth: GROUND[1],
			colors: { surface: { color: "#b3aa98" } },
			surface: { kind: "paving_01" },
		},
		traffic: { drivingSide: "right" },
		lighting: EVENING_PASSES,
		sky: SKY,
		water: WATER_LOOK,
		weather: WEATHER,
		camera: { openingViewpointId: "view_gamla_stan", lowestElevation: 5, tiltShift: TILT_SHIFT },
		moods: MOODS,
		viewpoints: VIEWPOINTS,
		data: DATA,
		areas: AREAS,
		roads: ROADS,
		junctions: JUNCTIONS,
		entities: [
			...landmarks,
			...oldTownHouses,
			...wallLanterns,
			...cityBlocks,
			...soderShoreRows,
			...skeppsholmenRows,
			...lamps,
			...squareLamps,
			...beacons,
			...trees,
			...boats,
			...centralbronTraffic,
			...otherTraffic,
		],
	} satisfies TSceneInput);
