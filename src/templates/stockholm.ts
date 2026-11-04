import { round } from "#/lib/math";
import { groundHeightAt } from "#/scene/areas";
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

import { paint } from "./paint";
import { type ILaidRow, type IRowSide, type IStreetLine, layRowsAlong } from "./streetRows";
import { turned } from "./turned";

/*
 * Stockholm: Gamla stan, the old town, and the waters and islands round it,
 * built to show off lights and the day cycle with data: on a two-minute day
 * from half past five, the lanterns in the lanes come on together at dusk,
 * the houses' windows one by one, the palace and the churches are floodlit,
 * Centralbron's traffic turns its headlights on and the ferries their cabins.
 *
 * Traced from a map of central Stockholm, shapes only: shores, islands and
 * landmarks as latitude and longitude, turned into world units by `fromMap`
 * (12.5 m to a unit, centred near Stortorget; x runs east, z south). Gamla
 * stan's streets are laid out on the island in world units, and its houses are
 * laid along them by `layRowsAlong` (streetRows.ts). Heights are drawn about
 * one and a half times true, as miniatures are.
 *
 *   Islands: Gamla stan (Stadsholmen), Riddarholmen, Helgeandsholmen with the
 *            Riksdag, Strömsborg, Skeppsholmen and Kastellholmen, as raised
 *            land with quay edges over one water area
 *   Shores:  Kungsholmen with Stadshuset, Norrmalm from Tegelbacken past the
 *            Opera and Kungsträdgården to Blasieholmen, Södermalm's heights
 *            above Söder Mälarstrand, Slussen and Stadsgården
 *   Bridges: Centralbron (traffic, into Söderleden's tunnel), Vasabron,
 *            Riksbron and Stallbron, Norrbro, Strömbron, Riddarholmsbron,
 *            Slussen, Skeppsholmsbron and Kastellholmsbron, raised roads
 *   Water:   Riddarfjärden, Strömmen and Saltsjön; ferries on hidden routes
 *   Data:    example numbers (each says so): ferries, Centralbron's traffic,
 *            the palace's visitors, the Riksdag, Stadshuset
 */

// ---------------------------------------------------------------- the map

/** Latitude and longitude, in degrees. */
type TLatLon = readonly [number, number];

const METRES_PER_UNIT = 12.5;
/** The map's middle: by Stortorget. */
const ORIGIN: TLatLon = [59.325, 18.071];
const METRES_PER_DEGREE_NORTH = 111_200;
const METRES_PER_DEGREE_EAST = 111_320 * Math.cos((ORIGIN[0] * Math.PI) / 180);

const fromMap = ([lat, lon]: TLatLon): TVec2 => [
	round(((lon - ORIGIN[1]) * METRES_PER_DEGREE_EAST) / METRES_PER_UNIT, 2),
	round((-(lat - ORIGIN[0]) * METRES_PER_DEGREE_NORTH) / METRES_PER_UNIT, 2),
];

const outline = (points: readonly TLatLon[]) => points.map(fromMap);

/** The ground: from Stadshuset in the west to Skeppsholmen's east end, Norrmalm to Södermalm. */
const GROUND: TVec2 = [180, 124];

/** How high the islands' quays stand over the water. */
const ISLAND = 0.2;
/** Squares and gardens on the islands, just over their top. */
const ON_ISLAND = ISLAND + 0.004;
/** Cars are drawn smaller here: the map is a few times smaller than the cars' own scale. */
const CAR = 0.5;

// ---------------------------------------------------------------- shores and islands

/** Riddarfjärden, Strömmen and Saltsjön: everything between the north shore and Södermalm. */
const WATER = outline([
	[59.3262, 18.0512], // west edge, Norr Mälarstrand
	[59.3264, 18.0535],
	[59.3265, 18.0556], // Stadshuset's garden
	[59.3267, 18.0567],
	[59.3276, 18.0575], // Stadshusbron
	[59.329, 18.0582], // Klara sjö
	[59.33197, 18.0584],
	[59.33197, 18.06],
	[59.33, 18.0602],
	[59.3292, 18.0608], // Tegelbacken
	[59.329, 18.0626],
	[59.3293, 18.0652], // Rosenbad
	[59.3295, 18.068], // Strömgatan
	[59.3296, 18.0705], // Gustav Adolfs torg
	[59.3297, 18.0725], // the Opera
	[59.3299, 18.0737], // Karl XII:s torg
	[59.3292, 18.0745], // Blasieholmen
	[59.3289, 18.076], // Strömkajen, the Grand Hôtel
	[59.3288, 18.0785], // Nationalmuseum
	[59.3285, 18.0805], // Skeppsholmsbron
	[59.3292, 18.0815], // Nybroviken
	[59.3305, 18.0828],
	[59.33197, 18.083],
	[59.33197, 18.0852],
	[59.3313, 18.0862], // Strandvägen
	[59.3311, 18.0908], // east edge
	[59.319, 18.0908],
	[59.319, 18.086], // Stadsgårdskajen
	[59.3192, 18.08], // Stadsgården
	[59.3195, 18.075],
	[59.3197, 18.072], // Slussen
	[59.3202, 18.069], // Söderström
	[59.3207, 18.065], // Söder Mälarstrand
	[59.3205, 18.06],
	[59.3203, 18.0512], // west edge
]);

const GAMLA_STAN = outline([
	[59.3266, 18.0664], // Riddarhuset's corner, by Centralbron
	[59.3271, 18.0676],
	[59.32735, 18.069], // Mynttorget
	[59.3274, 18.0702], // Lejonbacken
	[59.32765, 18.0712], // the palace, by Norrbro
	[59.3277, 18.0733],
	[59.32735, 18.0747], // Strömbron
	[59.3262, 18.0753], // Skeppsbron
	[59.3246, 18.0754],
	[59.323, 18.0748],
	[59.3217, 18.0738],
	[59.32085, 18.0723], // Slussen
	[59.3209, 18.0702],
	[59.3217, 18.0686], // Kornhamnstorg
	[59.3231, 18.0673], // Munkbron
	[59.3247, 18.0668],
	[59.3258, 18.0665],
]);

const RIDDARHOLMEN = outline([
	[59.3264, 18.0644], // Birger Jarls torg
	[59.3262, 18.0656], // Riddarholmsbron
	[59.3242, 18.066],
	[59.323, 18.0658],
	[59.3225, 18.0645],
	[59.3232, 18.0625], // Evert Taubes terrass
	[59.3245, 18.062],
	[59.3256, 18.0626],
]);

const HELGEANDSHOLMEN = outline([
	[59.3281, 18.0662],
	[59.3286, 18.0672],
	[59.32875, 18.0692],
	[59.3286, 18.071],
	[59.3282, 18.0717], // Strömparterren, under Norrbro
	[59.3279, 18.0708],
	[59.32775, 18.0685],
	[59.3278, 18.0668],
]);

const STROMSBORG = outline([
	[59.32862, 18.06525],
	[59.32862, 18.06555],
	[59.32838, 18.06555],
	[59.32838, 18.06525],
]);

const SKEPPSHOLMEN = outline([
	[59.3278, 18.0807], // Skeppsholmsbron
	[59.3276, 18.085],
	[59.3262, 18.088],
	[59.3242, 18.0868],
	[59.324, 18.084],
	[59.325, 18.0805], // af Chapman's quay
	[59.3263, 18.0796],
]);

const KASTELLHOLMEN = outline([
	[59.3236, 18.0858],
	[59.3238, 18.088],
	[59.3228, 18.0888],
	[59.3224, 18.0866],
]);

/** Södermalm's heights over its shore: lower at Slussen, high over Mariaberget and Katarina. */
const SODERMALM_HEIGHT = 1.4;
const SODERMALM: [number, number, number][] = [
	[-90, 45.4, 1],
	[-55, 44.4, 1.2],
	[-30, 43.8, 1.1],
	[-17, 46.6, 0.6],
	[-6, 50.6, 0],
	[8, 51.8, -0.3],
	[18, 54.6, 0.6],
	[40, 55.4, 0.9],
	[65, 55.4, 0.8],
	[90, 55.2, 0.8],
	[90, 62, 1.2],
	[-90, 62, 1.2],
];

const SODERMALM_AREA: TAreaInput = {
	id: "sodermalm",
	name: "Södermalm",
	kind: "raised_land_01",
	height: SODERMALM_HEIGHT,
	colors: { surface: { color: "#9d9886" } },
	surface: { kind: "paving_01" },
	points: SODERMALM,
	// Mosebacke and Mariaberget, a little higher still.
	peaks: [
		[28, 58.5, 1.6],
		[-40, 52, 1.5],
	],
};

/** How high Södermalm's ground stands at a point (0 off it), for what stands on its heights. */
const SODER = AreaSchema.parse(SODERMALM_AREA);
const onSoder = (x: number, z: number) => round(groundHeightAt([SODER], [x, z]), 2);

/** Katarinahissen's top, where its footbridge sets off level for the heights. */
const KATARINAHISSEN_TOP = round(onSoder(16.6, 57.8) + 0.05, 2);

/** A rectangle's corners, for squares and gardens. */
const rect = (x1: number, z1: number, x2: number, z2: number): TVec2[] => [
	[x1, z1],
	[x2, z1],
	[x2, z2],
	[x1, z2],
];

/** Gamla stan's squares. */
const STORTORGET = rect(-3.9, -2.2, 0.7, 1.6);
const JARNTORGET = rect(-0.6, 19.6, 3.6, 23.2);
const KORNHAMNSTORG = rect(-9.4, 25.6, -5.6, 29.4);
const MYNTTORGET = rect(-10.4, -20.2, -5, -16.6);
const SLOTTSBACKEN: TVec2[] = [
	[1.4, -10.8],
	[17.6, -10.8],
	[18, -7.6],
	[1.4, -7.6],
];
/** The palace's quay on the water to the north, Lejonbacken. */
const PALACE_QUAY: TVec2[] = [
	[-3.4, -21.2],
	[15.6, -21.2],
	[14.8, -23.4],
	[-2.6, -22.6],
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

const AREAS: TAreaInput[] = [
	{ id: "water", name: "Riddarfjärden, Strömmen and Saltsjön", kind: "water_01", points: WATER },
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
			[
				"riddarhuset_garden",
				"Riddarhuset's garden",
				"grass_01",
				[
					[-18, -14.6],
					[-15.4, -17.6],
					[-13.6, -18.4],
					[-13.6, -14.6],
				],
				null,
			],
			[
				"stromparterren",
				"Strömparterren",
				"grass_01",
				outline([
					[59.3283, 18.0705],
					[59.3282, 18.0716],
					[59.3279, 18.0709],
				]),
				null,
			],
			[
				"evert_taubes_terrass",
				"Evert Taubes terrass",
				"plaza_01",
				rect(-38.2, 12.2, -33.8, 16),
				"#cfc3ad",
			],
			["skeppsholmen_park", "Skeppsholmen's park", "grass_01", rect(46, -24, 66, -6), null],
			[
				"kastellholmen_grass",
				"Kastellholmen's rocks and grass",
				"grass_01",
				rect(70.2, 13.2, 77.4, 19.4),
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
	{
		id: "kungstradgarden",
		name: "Kungsträdgården",
		kind: "grass_01",
		points: rect(8.6, -62, 14.8, -46.6),
	},
	{
		id: "karl_xii_torg",
		name: "Karl XII:s torg",
		kind: "plaza_01",
		points: rect(8.6, -46.6, 14.2, -44.8),
	},
	{
		id: "gustav_adolfs_torg",
		name: "Gustav Adolfs torg",
		kind: "plaza_01",
		points: rect(-4.6, -48.4, 0.2, -43.6),
	},
	{
		id: "stadshuset_garden",
		name: "Stadshuset's garden",
		kind: "grass_01",
		points: outline([
			[59.32735, 18.0532],
			[59.32715, 18.0568],
			[59.3267, 18.0567],
			[59.3265, 18.0556],
			[59.3264, 18.0535],
		]),
	},
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

const street = (
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
	street(
		"stortorget_west",
		"Stortorget",
		[
			[-4.1, 1.6],
			[-4.1, -2.2],
		],
		0.1,
		{
			left: SQUARE,
			right: undefined,
			gableShare: 0.9,
			floorCount: 5,
			lanternEvery: 1,
		},
	),
	street(
		"stortorget_south",
		"Stortorget",
		[
			[0.9, 1.8],
			[-3.9, 1.8],
		],
		0.1,
		{
			left: SQUARE,
			right: undefined,
			gableShare: 0.5,
			floorCount: 5,
		},
	),
	street(
		"stortorget_east",
		"Stortorget",
		[
			[0.9, -2.2],
			[0.9, 1.6],
		],
		0.1,
		{
			left: SQUARE,
			right: undefined,
			gableShare: 0.6,
			floorCount: 4,
			lanternEvery: 1,
		},
	),
	street(
		"vasterlanggatan",
		"Västerlånggatan",
		[
			[-7.6, -15.6],
			[-6.9, -8],
			[-6.3, 0],
			[-5.7, 8],
			[-3.8, 15],
			[-0.6, 19.6],
		],
		0.55,
		{ floorCount: 5, lanternEvery: 3 },
	),
	street(
		"osterlanggatan",
		"Österlånggatan",
		[
			[11.4, -7.4],
			[12.4, -2],
			[12.6, 4.4],
			[10.6, 11.8],
			[6.8, 17.8],
			[3.6, 20.4],
		],
		0.5,
		{ floorCount: 5, lanternEvery: 3 },
	),
	street(
		"skeppsbron",
		"Skeppsbron",
		[
			[16.4, -19.6],
			[18.3, -10.4],
			[18.6, 3],
			[16.2, 17],
			[12, 28],
			[6.8, 33.4],
		],
		1,
		// Its houses face the water: the merchants' row, tall and broad.
		{ left: undefined, right: QUAY, floorCount: 6, gableShare: 0.1 },
	),
	street(
		"stora_nygatan",
		"Stora Nygatan",
		[
			[-12.8, -10.8],
			[-11.6, 24.4],
		],
		0.6,
		{ floorCount: 5, lanternEvery: 4 },
	),
	street(
		"munkbroleden",
		"Munkbroleden",
		[
			[-19.5, -9.4],
			[-18, 3],
			[-15.9, 16],
			[-11, 27],
			[-5.2, 33.8],
		],
		1,
		// Its houses face the water across the road, and the lane at their backs.
		{
			left: { ...QUAY, depths: [1.6, 1.2] },
			right: undefined,
			floorCount: 5,
			hasWindowsAtTheBack: true,
		},
	),
	street(
		"lilla_nygatan",
		"Lilla Nygatan",
		[
			[-16.2, -9.6],
			[-15.4, 4],
			[-14.4, 14],
		],
		0.45,
		{ left: NARROW_LANE, right: NARROW_LANE },
	),
	street(
		"slottsbacken_south",
		"Slottsbacken",
		[
			[17.8, -7.4],
			[1.8, -7.4],
		],
		0.1,
		{ left: QUAY, right: undefined, floorCount: 5, gableShare: 0 },
	),
	street(
		"prastgatan",
		"Prästgatan",
		[
			[-4.2, -4.4],
			[-4.4, 1],
			[-3.7, 7.5],
			[-1.9, 14.2],
		],
		0.4,
		{ left: NARROW_LANE, right: NARROW_LANE },
	),
	street(
		"svartmangatan",
		"Svartmangatan",
		[
			[1.2, 2],
			[4.2, 6],
			[5.2, 15.4],
			[4, 19.4],
		],
		0.45,
		{ lanternEvery: 3 },
	),
	street(
		"kopmangatan",
		"Köpmangatan",
		[
			[1.1, -1.2],
			[11.8, -2.4],
		],
		0.4,
		{ left: NARROW_LANE, right: NARROW_LANE, lanternEvery: 3 },
	),
	street(
		"storkyrkobrinken",
		"Storkyrkobrinken",
		[
			[-18.4, -11.4],
			[-12.8, -10.6],
			[-7.2, -9.4],
		],
		0.5,
		{ left: NARROW_LANE, right: NARROW_LANE },
	),
	street(
		"tyska_brinken",
		"Tyska brinken",
		[
			[-5.9, 4.8],
			[-3.9, 5.1],
			[4.5, 5.3],
		],
		0.4,
		{ left: NARROW_LANE, right: NARROW_LANE },
	),
	street(
		"jarntorgsgatan",
		"Järntorgsgatan",
		[
			[1.6, 23.4],
			[3.6, 29.6],
			[5.2, 33.2],
		],
		0.6,
		{ floorCount: 5 },
	),
	// Lanes down to the quays: only gaps between the houses, too narrow for rows of their own.
	...(
		[
			[
				"kakbrinken",
				"Kåkbrinken",
				[
					[-6.3, -0.6],
					[-4.2, -0.4],
				],
			],
			[
				"ferkens_grand",
				"Ferkens gränd",
				[
					[12.6, 1.6],
					[18.6, 1.8],
				],
			],
			[
				"gaddgarsgrand",
				"Gaddgårdsgränd",
				[
					[11.6, 9],
					[17.6, 9.6],
				],
			],
			[
				"brunnsgrand",
				"Brunnsgränd",
				[
					[9, 14.8],
					[16.6, 15.8],
				],
			],
			[
				"drakens_grand",
				"Drakens gränd",
				[
					[5.4, 19.6],
					[13.4, 24.4],
				],
			],
			[
				"gasgrand",
				"Gåsgränd",
				[
					[-6.6, -3.5],
					[-19.2, -3.4],
				],
			],
			[
				"ignatiigrand",
				"Ignatiigränd",
				[
					[-5.9, 6.5],
					[-18.4, 6.6],
				],
			],
			[
				"schonfeldts_grand",
				"Schönfeldts gränd",
				[
					[-4.6, 12.3],
					[-16.6, 12],
				],
			],
			[
				"kolmatargrand",
				"Kolmätargränd",
				[
					[-2.8, 17.4],
					[-13.4, 19.6],
				],
			],
			[
				"bollhusgrand",
				"Bollhusgränd",
				[
					[11.4, -7.4],
					[12.2, -10.6],
				],
			],
		] as const
	).map(([id, name, points]) =>
		street(
			id,
			name,
			points.map(([x, z]): TVec2 => [x, z]),
			0.4,
			{
				left: undefined,
				right: undefined,
			},
		),
	),
];

/** Landmarks, the squares and gardens: no houses there. */
const KEEP_OUT: TVec2[][] = [
	rect(-5.2, -21.4, 10.6, -10.6), // the palace and its wings
	SLOTTSBACKEN,
	PALACE_QUAY,
	rect(-5.6, -8.8, 1.6, -4.6), // Storkyrkan
	STORTORGET,
	rect(-2, 6.2, 4.2, 10.8), // Tyska kyrkan and its churchyard
	JARNTORGET,
	KORNHAMNSTORG,
	MYNTTORGET,
	rect(-18.6, -18.6, -13, -11.4), // Riddarhuset and its garden
	rect(-4.4, -4.6, 1.2, -2.2), // Börshuset, Stortorget's north side
	rect(7.4, -7.2, 11.4, -3.6), // Tessinska palatset
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
const COURTYARD = street("courtyard", "Courtyard", [], 0, {
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

// ---------------------------------------------------------------- roads and bridges

const CENTRALBRON_ID = "centralbron";
const SKEPPSBRON_ID = "skeppsbron";
/** Strömgatan, in stretches between the bridges that meet it (ADR-0136). */
const STROMGATAN_POINTS: TVec2[][] = [
	[
		[-47, -45],
		[-38, -40.6],
		[-27, -42],
		[-23, -42.4],
	],
	[
		[-23, -42.4],
		[-13.4, -43.4],
	],
	[
		[-13.4, -43.4],
		[-0.4, -43.4],
	],
	[
		[-0.4, -43.4],
		[6.8, -44.2],
		[13, -46],
		[16.2, -40.6],
		[21.4, -38.8],
	],
	[
		[21.4, -38.8],
		[34, -37.4],
		[43.6, -34.8],
	],
];
const STROMGATAN_IDS = STROMGATAN_POINTS.map((_, i) => `stromgatan_${i + 1}`);
const SODER_SHORE_ID = "soder_malarstrand";
const STADSGARDEN_ID = "stadsgardsleden";
const MUNKBROLEDEN_ID = "munkbroleden";
const DJURGARDEN_FERRY_ID = "djurgarden_ferry_route";
const ARCHIPELAGO_ID = "archipelago_route";
const RIDDARFJARDEN_ID = "riddarfjarden_route";

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

const ROADS: TRoadInput[] = [
	{
		id: SKEPPSBRON_ID,
		name: "Skeppsbron",
		kind: "road_01",
		width: 1,
		cornerRadius: 3,
		showsCentreLine: false,
		heldUpBy: "none",
		showsRailings: false,
		colors: { surface: { color: "#5f5b57" } },
		points: [
			[15.6, -20.6, ISLAND],
			[18.3, -10.4, ISLAND],
			[18.6, 3, ISLAND],
			[16.2, 17, ISLAND],
			[12, 28, ISLAND],
			[6.8, 33.4, ISLAND],
			[5.6, 35.2, ISLAND],
		],
	},
	{
		id: MUNKBROLEDEN_ID,
		name: "Munkbroleden",
		kind: "road_01",
		width: 1,
		cornerRadius: 3,
		showsCentreLine: false,
		heldUpBy: "none",
		showsRailings: false,
		colors: { surface: { color: "#5f5b57" } },
		// From Riddarhustorget down the west quay, round the tip to Slussen.
		points: [
			[-19.6, -12.2, ISLAND],
			[-18, 3, ISLAND],
			[-15.9, 16, ISLAND],
			[-11, 27, ISLAND],
			[-5.2, 33.8, ISLAND],
			[1.5, 35.8, ISLAND],
			[5.6, 35.2, ISLAND],
		],
	},
	// Centralbron: from Tegelbacken over Riddarholmen's corner, along the canal between it and
	// Gamla stan, over Söderström, and into Söderleden's tunnel under Södermalm.
	bridge(
		CENTRALBRON_ID,
		"Centralbron",
		[
			[-47, -45, 0],
			[-41, -42.4, 0.4],
			[-35.4, -37.4, 1.3],
			[-29.2, -24, 1.5],
			[-25.6, -13, 1.5],
			[-22.6, -3, 1.45],
			[-21.6, 9, 1.4],
			[-20.2, 21, 1.35],
			[-17.6, 33, 1.2],
			[-15.6, 42, 1],
			[-14.8, 49, 1],
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
			[-23, -42.4, 0],
			[-23.4, -37.6, 0.5],
			[-23.6, -30, 0.55],
			[-22.6, -21.5, 0.5],
			[-19.6, -12.2, ISLAND],
		],
		1.2,
	),
	bridge(
		"riksbron",
		"Riksbron and Stallbron",
		[
			[-13.4, -43.4, 0],
			[-13.3, -37.2, 0.5],
			[-13.1, -32, ISLAND],
			[-12.8, -25.2, ISLAND],
			[-12.4, -22.6, 0.35],
			[-11.8, -19, ISLAND],
		],
		0.9,
		{ cornerRadius: 1 },
	),
	bridge(
		"norrbro",
		"Norrbro",
		[
			[-0.4, -43.4, 0],
			[0, -36.6, 0.55],
			[0.5, -30.4, 0.6],
			[1, -25.2, 0.5],
			[1.6, -22.4, ISLAND],
		],
		1.2,
		{ pillarSpacing: 2 },
	),
	bridge(
		"strombron",
		"Strömbron",
		[
			[15.6, -20.6, ISLAND],
			[18.2, -27, 0.5],
			[20.4, -34.6, 0.35],
			[21.4, -38.8, 0],
		],
		1.3,
	),
	bridge(
		"riddarholmsbron",
		"Riddarholmsbron",
		[
			// From Riddarholmen under Centralbron to Riddarhustorget, where Vasabron lands too.
			[-24.8, -8.4, ISLAND],
			[-22.4, -10.2, 0.32],
			[-19.6, -12.2, ISLAND],
		],
		0.8,
		{ cornerRadius: 0 },
	),
	// Slussen: from Gamla stan's tip over Söderström to Södermalm's shore, its gold bridge on piers.
	bridge(
		"slussen",
		"Slussen",
		[
			[5.6, 35.2, ISLAND],
			[5.2, 40.6, 0.6],
			[4.8, 47.6, 0.3],
			[4.7, 49.6, 0],
		],
		1.4,
		{
			pillarSpacing: 2.2,
			colors: { surface: { color: "#5f5b57" }, embankment: { color: "#c9a93e" } },
		},
	),
	// Götgatan, up from Slussen onto the heights.
	bridge(
		"gotgatan",
		"Götgatan",
		[
			[4.7, 49.6, 0],
			[5.4, 56, onSoder(5.4, 56)],
			[6, 61.6, onSoder(6, 61.6)],
		],
		1.2,
		{
			heldUpBy: "embankment",
			embankmentAngle: 70,
			colors: { surface: { color: "#5f5b57" }, embankment: { color: "#9d9886" } },
		},
	),
	bridge(
		"skeppsholmsbron",
		"Skeppsholmsbron",
		[
			[43.6, -34.8, 0],
			[43.8, -29, 0.45],
			[44.2, -23.2, ISLAND],
		],
		0.9,
		{ cornerRadius: 0 },
	),
	bridge(
		"kastellholmsbron",
		"Kastellholmsbron",
		[
			[68.6, 6.4, ISLAND],
			[68.9, 9.6, 0.35],
			[69.4, 12.8, ISLAND],
		],
		0.6,
		{ cornerRadius: 0 },
	),
	bridge(
		"stadshusbron",
		"Stadshusbron",
		[
			[-63.6, -28.6, 0],
			[-57.4, -33.4, 0.4],
			[-51.2, -38.8, 0],
			[-47, -45, 0],
		],
		1.2,
	),
	// The mainland's waterfront roads.
	...STROMGATAN_POINTS.map(
		(points, i): TRoadInput => ({
			id: STROMGATAN_IDS[i],
			name: i === 0 ? "Strömgatan" : `Strömgatan (${i + 1})`,
			kind: "road_01",
			width: 1.1,
			cornerRadius: 3,
			showsCentreLine: false,
			colors: { surface: { color: "#6f6b66" } },
			points,
		}),
	),
	{
		id: SODER_SHORE_ID,
		name: "Söder Mälarstrand",
		kind: "road_01",
		width: 1.1,
		cornerRadius: 3,
		showsCentreLine: false,
		colors: { surface: { color: "#6f6b66" } },
		points: [
			[-89, 43.4],
			[-30, 41.6],
			[-17, 42],
			[-8, 45.2],
			[2, 48.4],
			[4.7, 49.6],
		],
	},
	{
		id: STADSGARDEN_ID,
		name: "Stadsgårdsleden",
		kind: "road_01",
		width: 1.1,
		cornerRadius: 3,
		showsCentreLine: false,
		colors: { surface: { color: "#6f6b66" } },
		points: [
			[4.7, 49.6],
			[18, 50.6],
			[40, 52.6],
			[68, 54.3],
			[89, 54.3],
		],
	},
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
			[12.6, 52, KATARINAHISSEN_TOP],
			[16.6, 57.8, KATARINAHISSEN_TOP],
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
			[10.6, 33.4],
			[22, 34.4],
			[40, 28.6],
			[62, 26.4],
			[84, 22.6],
			[86, 30],
			[62, 34],
			[40, 36.6],
			[22, 38.6],
			[12.4, 36.6],
		],
	},
	{
		id: ARCHIPELAGO_ID,
		name: "Archipelago boats",
		kind: "hidden_route_01",
		loops: true,
		cornerRadius: 4,
		points: [
			[24.5, -32.6],
			[29, -24],
			[32, -10],
			[33, 6],
			[42, 20],
			[60, 30.6],
			[86, 37],
			[86, 43],
			[58, 41],
			[38, 29],
			[27, 8],
			[25, -14],
		],
	},
	{
		id: RIDDARFJARDEN_ID,
		name: "Riddarfjärden boats",
		kind: "hidden_route_01",
		loops: true,
		cornerRadius: 5,
		points: [
			[-60, -14],
			[-48, -4],
			[-46, 14],
			[-56, 32],
			[-80, 34],
			[-86, 14],
			[-76, -6],
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

// ---------------------------------------------------------------- landmarks

/** Example data, as every value here is: say so wherever it's shown in full. */
const EXAMPLE = "Example number, not live data";

const landmarks: TEntityInput[] = [
	{
		id: "kungliga_slottet",
		kind: "palace_01",
		name: "Kungliga slottet",
		position: [2.7, -16],
		altitude: ISLAND,
		props: { width: 9.4, depth: 9, floorCount: 5, sideWingLength: 2.2 },
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
		position: [-2, -6.7],
		altitude: ISLAND,
		// Its tower to the east, up Slottsbacken from the water.
		rotation: turned(90),
		props: { width: 2.8, depth: 6.2, towerHeight: 4 },
		details: { description: "Stockholm's cathedral, the oldest church in Gamla stan." },
	},
	{
		id: "tyska_kyrkan",
		kind: "church_04",
		name: "Tyska kyrkan",
		position: [1.2, 8.5],
		altitude: ISLAND,
		rotation: turned(-90),
		props: { width: 2.6, depth: 5, towerHeight: 3.4 },
		details: { description: "The German church, its copper spire over the lanes." },
	},
	{
		id: "riddarholmskyrkan",
		kind: "church_03",
		name: "Riddarholmskyrkan",
		position: [-30.4, 2.7],
		altitude: ISLAND,
		rotation: turned(-90),
		props: { width: 2.6, depth: 6.4, towerHeight: 3.2 },
		details: {
			description: "The burial church of Sweden's kings, under its cast-iron spire.",
		},
	},
	{
		id: "stadshuset",
		kind: "city_hall_01",
		name: "Stadshuset",
		position: [-72.7, -23.6],
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
		position: [-5.6, -28.8],
		altitude: ISLAND,
		colors: paint({ walls: "#cfc8b8", trim: "#ece6d8", plinth: "#a9a294", roof: "#5f6f69" }),
		props: {
			width: 8.4,
			depth: 5.2,
			floorCount: 4,
			wingDepth: 1.6,
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
		id: "riksdagshuset_west",
		kind: "palace_01",
		name: "Riksdagshuset (west building)",
		position: [-16.2, -28.4],
		altitude: ISLAND,
		colors: paint({ walls: "#d8d0bd", trim: "#efe9dc", plinth: "#b3aa98", roof: "#5f6f69" }),
		props: { width: 5.2, depth: 4, floorCount: 4, wingDepth: 1.3, showsSideWings: false, seed: 9 },
	},
	{
		id: "riddarhuset",
		kind: "palace_01",
		name: "Riddarhuset",
		position: [-15.8, -13.2],
		altitude: ISLAND,
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
		position: [-1.6, -3.4],
		altitude: ISLAND,
		colors: paint({ walls: "#efe6cf", trim: "#f7f2e6", plinth: "#d8cdb4", roof: "#4f5a55" }),
		props: { width: 4.8, depth: 2, floorCount: 3, wingDepth: 0.8, showsSideWings: false, seed: 6 },
	},
	{
		id: "wrangelska_palatset",
		kind: "palace_01",
		name: "Wrangelska palatset",
		position: [-35.4, -4.6],
		altitude: ISLAND,
		rotation: turned(90),
		colors: paint({ walls: "#e3c78f", roof: "#4c5a54" }),
		props: { width: 5.6, depth: 4, floorCount: 3, wingDepth: 1.3, showsSideWings: false, seed: 11 },
	},
	// Riddarholmen's palaces round its church, and Norstedts' brick house at its south end.
	...(
		[
			["stenbockska_palatset", "Stenbockska palatset", -26.4, -5.4, 0, 3.6, 2.6, "#e8d6a6"],
			["hessensteinska_palatset", "Hessensteinska palatset", -25.6, 9.6, 90, 3.4, 2.4, "#d9b77a"],
			["gamla_riksdagshuset", "Gamla riksdagshuset", -37, 5.6, 90, 4.4, 3.2, "#e3cfa8"],
			[
				"schering_rosenhanes_palats",
				"Schering Rosenhanes palats",
				-35.8,
				10.4,
				90,
				3.2,
				2.4,
				"#efd9a4",
			],
			["norstedtshuset", "Norstedtshuset", -33.4, 17.2, 180, 4.6, 2.4, "#9c4b36"],
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
		position: [9.4, -5.4],
		altitude: ISLAND,
		colors: paint({ walls: "#ead7a8", roof: "#4c5a54" }),
		props: { width: 3.6, depth: 2.6, floorCount: 4, wingDepth: 1, showsSideWings: false, seed: 2 },
	},
	{
		id: "operan",
		kind: "palace_01",
		name: "Kungliga Operan",
		position: [3.8, -47.6],
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
		position: [-8.6, -47.6],
		colors: paint({ walls: "#e9d9b8", roof: "#4c5a54" }),
		props: { width: 6, depth: 4.6, floorCount: 4, wingDepth: 1.6, showsSideWings: false, seed: 8 },
	},
	{
		id: "rosenbad",
		kind: "palace_01",
		name: "Rosenbad",
		position: [-25.4, -46.4],
		colors: paint({ walls: "#e6d4ae", roof: "#6d8d7f" }),
		props: { width: 6, depth: 5, floorCount: 5, wingDepth: 1.6, showsSideWings: false, seed: 12 },
	},
	{
		id: "grand_hotel",
		kind: "palace_01",
		name: "Grand Hôtel",
		position: [22.6, -42],
		colors: paint({ walls: "#efe6d4", trim: "#faf6ee", roof: "#4f5a55" }),
		props: { width: 7, depth: 4.6, floorCount: 6, wingDepth: 1.6, showsSideWings: false, seed: 13 },
	},
	{
		id: "nationalmuseum",
		kind: "palace_01",
		name: "Nationalmuseum",
		position: [33.6, -40.8],
		colors: paint({ walls: "#e6dcc3", roof: "#7aa892" }),
		props: { width: 8, depth: 5, floorCount: 3, wingDepth: 1.6, showsSideWings: false, seed: 14 },
	},
	{
		id: "stadsmuseet",
		kind: "palace_01",
		name: "Stadsmuseet",
		position: [-3.4, 56],
		altitude: onSoder(-3.4, 56),
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
		position: [-15.1, 46.8],
		altitude: 0.98,
		rotation: turned(-83.5),
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
	// Strömsborg's yellow house on its islet.
	// Stortorget's well, in the middle of the square.
	{
		id: "stortorget_well",
		kind: "fountain_01",
		name: "Stortorgsbrunnen",
		position: [-1.6, -0.3],
		altitude: ON_ISLAND,
		scale: 0.7,
	},
	{
		id: "stromsborg_house",
		kind: "house_01",
		name: "Strömsborg",
		position: [-25.5, -31.1],
		altitude: ISLAND,
		colors: paint({ roof: "#9c4a36" }),
		props: { width: 1.4, depth: 1.1, height: 1, roofHeight: 0.6 },
	},
	// Birger Jarls torn on Riddarholmen: a round brick tower with a cone roof.
	{
		id: "birger_jarls_torn",
		kind: "cylinder_01",
		name: "Birger Jarls torn",
		position: [-31.6, -10.2],
		altitude: ISLAND,
		colors: paint({ surface: "#a35a42" }),
		props: { width: 1.3, depth: 1.3, height: 2.6, sideCount: 12 },
	},
	{
		id: "birger_jarls_torn_roof",
		kind: "cone_01",
		name: "Birger Jarls torn's roof",
		position: [-31.6, -10.2],
		altitude: ISLAND + 2.6,
		colors: paint({ surface: "#4c5a54" }),
		props: { width: 1.45, depth: 1.45, height: 1.1 },
	},
	// Kastellet on Kastellholmen: a small brick castle with a round tower and the flag.
	{
		id: "kastellet",
		kind: "box_01",
		name: "Kastellet",
		position: [74.6, 16.8],
		altitude: ISLAND,
		colors: paint({ surface: "#b85a43" }),
		props: { width: 2.6, depth: 1.8, height: 1.1 },
	},
	{
		id: "kastellet_tower",
		kind: "cylinder_01",
		name: "Kastellet's tower",
		position: [74.6, 16.8],
		altitude: ISLAND + 1.1,
		colors: paint({ surface: "#c0634a" }),
		props: { width: 1.3, depth: 1.3, height: 1.1, sideCount: 16 },
	},
	{
		id: "kastellet_flagpole",
		kind: "cylinder_01",
		name: "Kastellet's flagpole",
		position: [74.6, 16.8],
		altitude: ISLAND + 2.2,
		colors: paint({ surface: "#e9e6de" }),
		props: { width: 0.05, depth: 0.05, height: 1.3, sideCount: 6 },
	},
	{
		id: "kastellet_flag",
		kind: "box_01",
		name: "Kastellet's flag",
		position: [74.95, 16.8],
		altitude: ISLAND + 3.05,
		colors: paint({ surface: "#2a5aa8" }),
		props: { width: 0.6, depth: 0.03, height: 0.38 },
	},
	{
		id: "kastellet_flag_cross_across",
		kind: "box_01",
		name: "Kastellet's flag (cross)",
		position: [74.95, 16.8],
		altitude: ISLAND + 3.2,
		colors: paint({ surface: "#f2c230" }),
		props: { width: 0.6, depth: 0.04, height: 0.07 },
	},
	{
		id: "kastellet_flag_cross_up",
		kind: "box_01",
		name: "Kastellet's flag (cross, upright)",
		position: [74.88, 16.8],
		altitude: ISLAND + 3.05,
		colors: paint({ surface: "#f2c230" }),
		props: { width: 0.07, depth: 0.04, height: 0.38 },
	},
	// Skeppsholmskyrkan: an eight-sided church under a dome.
	{
		id: "skeppsholmskyrkan",
		kind: "cylinder_01",
		name: "Skeppsholmskyrkan",
		position: [56.4, -11.4],
		altitude: ISLAND,
		colors: paint({ surface: "#ead9b0" }),
		props: { width: 3, depth: 3, height: 1.7, sideCount: 8 },
	},
	{
		id: "skeppsholmskyrkan_dome",
		kind: "dome_01",
		name: "Skeppsholmskyrkan's dome",
		position: [56.4, -11.4],
		altitude: ISLAND + 1.7,
		colors: paint({ surface: "#5d6b66" }),
		props: { width: 2.8, depth: 2.8, height: 1.2 },
	},
	// Katarinahissen: the lift up from Slussen to the heights, its footbridge a road (above).
	{
		id: "katarinahissen",
		kind: "box_01",
		name: "Katarinahissen",
		position: [12.6, 52],
		colors: paint({ surface: "#3b3f44" }),
		props: { width: 0.9, depth: 0.9, height: KATARINAHISSEN_TOP },
	},
	// Moderna museet and the old naval buildings on Skeppsholmen.
	{
		id: "moderna_museet",
		kind: "depot_01",
		name: "Moderna museet",
		position: [64, -18.4],
		altitude: ISLAND,
		rotation: turned(20),
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

/**
 * Norrmalm and Kungsholmen behind the waterfront: stone city blocks, rows of
 * tall houses round a courtyard, each side a row (light to draw, ADR-0142).
 */
const HOUSE_IN_BLOCK = 1.1;
const cityBlock = (
	[x, z, width, depth, floorCount]: [number, number, number, number, number],
	i: number,
): TEntityInput[] => {
	// Back to back where the block is too narrow for a courtyard, their eaves just apart.
	const rowDepth = Math.min(2, depth / 2 - 0.05);
	const more = { floorCount, depth: rowDepth, gableShare: 0.05, floorCountVariation: 0 };
	const across = Math.floor(width / HOUSE_IN_BLOCK);
	const along = Math.floor((depth - 2 * rowDepth) / HOUSE_IN_BLOCK);
	return [
		mainlandRow(`city_block_${i}_south`, [x, z + depth / 2 - rowDepth / 2], 0, across, more, i),
		mainlandRow(
			`city_block_${i}_north`,
			[x, z - depth / 2 + rowDepth / 2],
			180,
			across,
			more,
			i + 3,
		),
		...(along > 0
			? [
					mainlandRow(
						`city_block_${i}_east`,
						[x + width / 2 - rowDepth / 2, z],
						90,
						along,
						more,
						i + 1,
					),
					mainlandRow(
						`city_block_${i}_west`,
						[x - width / 2 + rowDepth / 2, z],
						-90,
						along,
						more,
						i + 4,
					),
				]
			: []),
	];
};

const mainlandBlocks: TEntityInput[] = (
	[
		// [x, z, width, depth, floors]
		[-40, -52, 6.6, 4.4, 7],
		[-31, -54, 5.5, 5.5, 8],
		[-20, -55, 6.6, 4.4, 7],
		[-12, -55, 5.5, 4.4, 8],
		[-2, -55, 6.6, 4.4, 7],
		[20, -50, 5.5, 4.4, 7],
		[28, -50, 6.6, 4.4, 6],
		[38, -48, 5.5, 4.4, 6],
		[-46, -56, 4.4, 5.5, 6],
		[-84, -50, 6.6, 4.4, 6],
		[-75, -50, 6.6, 4.4, 7],
		[-66, -50, 5.5, 4.4, 6],
		[-84, -38, 5.5, 4.4, 6],
		[-84, -28, 5.5, 6.6, 5],
		[60, -60, 7.7, 3.4, 6],
		[72, -60, 7.7, 3.4, 6],
		[84, -60, 6.6, 3.4, 6],
	] as [number, number, number, number, number][]
).flatMap(cityBlock);

/** Rows along the waterfronts: Strömgatan's, Blasieholmen's, Strandvägen's. */
const mainlandRows: TEntityInput[] = [
	mainlandRow("tegelbacken_row", [-37, -46.6], 0, 5, {}, 1),
	mainlandRow("strandvagen_row_1", [62, -54.4], 0, 6, { floorCount: 6, gableShare: 0.3 }, 2),
	mainlandRow("strandvagen_row_2", [76, -54.4], 0, 6, { floorCount: 6, gableShare: 0.3 }, 3),
	mainlandRow("blasieholmen_row", [41, -40], 0, 4, {}, 4),
	mainlandRow("kungsholmen_row_1", [-84, -18], 180, 6, {}, 5),
	mainlandRow("kungsholmen_row_2", [-60, -40], 90, 5, {}, 6),
	// Riddarholmen's south, by the water.
	{
		...mainlandRow("riddarholmen_row", [-28.4, 15.4], 180, 4, { floorCount: 5 }, 0),
		altitude: ISLAND,
	},
	// Skeppsholmen's old naval houses, in a long yellow row.
	{
		...mainlandRow("skeppsholmen_row", [52, -2.6], 0, 6, { floorCount: 3, houseWidth: 1.2 }, 1),
		altitude: ISLAND,
		colors: paint({
			walls: "#e8c983",
			secondWalls: "#e8c983",
			thirdWalls: "#edd59a",
			fourthWalls: "#e2bd74",
			roof: "#9c4a36",
		}),
	},
];

/**
 * Södermalm along its heights: rows of houses looking north over the water,
 * small old ones at Fjällgatan, tall ones above Söder Mälarstrand.
 */
const sodermalmRows: TEntityInput[] = [
	...[-84, -76, -68, -60, -52, -44, -36, -28].map((x, i) => {
		const z = 46.4 + (x < -40 ? 0.6 : 0);
		return mainlandRow(`mariaberget_row_${i}`, [x, z + 1.3], 180, 6, { floorCount: 5 }, i);
	}),
	...[22, 29, 36, 50, 57, 72, 79, 86].map((x, i) =>
		mainlandRow(
			`fjallgatan_row_${i}`,
			[x, 57.4],
			180,
			5,
			// Fjällgatan's old cottages, low and bright.
			{ floorCount: 2, floorCountVariation: 0, houseWidth: 1, depth: 1.6, gableShare: 0.2 },
			i + 3,
		),
	),
	...[-20, -12, 13, 26, 44, 64].map((x, i) =>
		mainlandRow(`soder_back_row_${i}`, [x, 60.6], 180, 6, { floorCount: 6 }, i + 1),
	),
];

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
	...[27, 31.4].map((x, i) => ({
		id: `stromkajen_boat_${i}`,
		kind: "ferry_01",
		name: "Archipelago boat (moored)",
		position: [x, -33.5] as TVec2,
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
		position: [60, 50.3],
		rotation: turned(182),
		colors: paint({ hull: "#c8102e", funnel: "#f4f1ea", decks: "#f4f1ea" }),
		props: { length: 14 },
	},
	// af Chapman, the old full-rigger, moored at Skeppsholmen with its sails furled.
	{
		id: "af_chapman",
		kind: "sailing_boat_01",
		name: "af Chapman",
		position: [39.6, -5.6],
		rotation: turned(109),
		scale: 1.1,
		colors: paint({ hull: "#f4f1ea" }),
		props: { length: 6, showsSails: false },
	},
	// Yachts and sailing boats moored in Nybroviken and off Skeppsholmen.
	...(
		[
			[50, -42, 60, 2.2],
			[51.6, -47, 60, 2.6],
			[56.6, -46, 240, 2],
			[79, -14, 160, 2.4],
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
			[-44, -12, 30],
			[-50, 20, 200],
			[35, 20, 330],
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
		(spot) => spot.at[1] < 44,
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
	// Slussen's, off Gamla stan's houses.
	...lampsAlong(
		"slussen",
		"street_lamp_02",
		2.4,
		0.85,
		"both",
		{ props: { height: 0.9 } },
		(spot) => spot.at[1] > 36.5 && spot.at[1] < 47,
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

/** Lanterns round Stortorget and on Slottsbacken, and park lamps in the gardens. */
const squareLamps: TEntityInput[] = [
	...(
		[
			[-3.3, -1.2],
			[0.1, -1.2],
			[-3.3, 1],
			[0.1, 1],
			[4, -8.2],
			[8, -8.2],
			[12, -8.2],
			[16, -8.2],
			[0, 20],
			[3, 22.8],
			[-9, 26],
			[-6, 29],
			[-9.6, -17],
			[-5.4, -17],
		] as TVec2[]
	).map((at, i) => ({
		id: `square_lantern_${i}`,
		kind: "street_lamp_02",
		position: at,
		altitude: ISLAND,
		props: { height: 0.95 },
	})),
	...([9.2, 11.6, 14.2] as number[]).flatMap((x) =>
		[-50, -54, -58].map((z) => ({
			id: `kungstradgarden_lamp_${x}_${-z}`,
			kind: "street_lamp_04",
			position: [x, z] as TVec2,
		})),
	),
	...(
		[
			[48, -20],
			[52, -10],
			[60, -6],
			[64, -12],
			[-36, 13],
			[-34.6, 15.4],
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
		[11.8, 31.4, ISLAND],
		[25.4, -35.6, 0],
		[47.6, 1.6, ISLAND],
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
	...[9.6, 13.6].flatMap((x) =>
		[-48, -52, -56, -60].map((z, k) => ({
			id: `kungstradgarden_tree_${x}_${-z}`,
			kind: k === 0 ? "fruit_tree_01" : "round_tree_01",
			position: [x, z] as TVec2,
			scale: 0.9,
		})),
	),
	// Skeppsholmen's park, Strömparterren, Riddarhuset's garden, Stadshuset's garden, Södermalm.
	...(
		[
			[48.4, -16, ON_ISLAND, "round_tree_02"],
			[50.6, -22, ON_ISLAND, "round_tree_01"],
			[54, -20.6, ON_ISLAND, "birch_01"],
			[61, -8, ON_ISLAND, "round_tree_02"],
			[63.4, -22.6, ON_ISLAND, "round_tree_01"],
			[66, -8.6, ON_ISLAND, "birch_01"],
			[2.2, -27.4, ON_ISLAND, "round_tree_01"],
			[-16.4, -15.6, ON_ISLAND, "round_tree_02"],
			[-14.4, -16.6, ON_ISLAND, "round_tree_01"],
			[-78, -14.4, 0, "round_tree_02"],
			[-74, -15.4, 0, "round_tree_01"],
			[-70, -16, 0, "round_tree_02"],
			[73, 19.2, ON_ISLAND, "pine_tree_01"],
			[71.6, 14.4, ON_ISLAND, "bush_01"],
			[-37, 13.2, ON_ISLAND, "round_tree_01"],
		] as [number, number, number, string][]
	).map(([x, z, altitude, kind], i) => ({
		id: `tree_${i}`,
		kind,
		position: [x, z] as TVec2,
		altitude,
		scale: 0.85,
	})),
	// On Södermalm's slope.
	...(
		[
			[-72, 49],
			[-56, 48.6],
			[-46, 51.6],
			[-24, 48],
			[-10, 53.4],
			[33, 59.4],
			[42, 56.8],
			[64, 57],
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
		target: [-2, 4],
		azimuth: 300,
		elevation: 30,
		span: 74,
		projection: "perspective",
		moodId: "mood_evening",
	},
	{
		id: "view_overview",
		name: "Overview",
		description: "From Stadshuset to Skeppsholmen, Norrmalm to Södermalm.",
		target: [-2, 0],
		span: 160,
	},
	{
		id: "view_stortorget",
		name: "Stortorget",
		description: "The old square, its stepped gables lit at blue hour.",
		target: [-2, -0.4],
		targetAltitude: ISLAND,
		azimuth: 350,
		elevation: 34,
		span: 13,
		projection: "perspective",
		moodId: "mood_blue",
	},
	{
		id: "view_palace",
		name: "The palace from the water",
		description: "Kungliga slottet floodlit over Strömmen, the Riksdag beside it.",
		target: [0, -18],
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
		target: [-27, 1],
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
		target: [-69.5, -21.5],
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
		target: [-20, 18],
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
		target: [14, 8],
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
		target: [12, 49],
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
		target: [-42, -4],
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
			...mainlandBlocks,
			...mainlandRows,
			...sodermalmRows,
			...lamps,
			...squareLamps,
			...beacons,
			...trees,
			...boats,
			...centralbronTraffic,
			...otherTraffic,
		],
	} satisfies TSceneInput);
