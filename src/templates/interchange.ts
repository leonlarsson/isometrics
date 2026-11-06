import { objectsInEachOther } from "#/parts/bodies";
import { groundHeightAt, isInsidePolygon } from "#/scene/areas";
import { roadCenterlineOf } from "#/scene/roads";
import {
	AreaSchema,
	EntitySchema,
	RoadSchema,
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
import {
	AT_END,
	arcPoints,
	cutPathAt,
	joinPath,
	linePoints,
	pathLength,
	quarterTurned,
	type TPathPoint,
	withAltitudes,
} from "./roadPaths";
import { edgeDistance, segmentDistance } from "./streetRows";
import { turned } from "./turned";

/*
 * The Interchange: a traffic landscape. A four-level stack where two freeways
 * cross, a cloverleaf onto a boulevard to the east, the north–south freeway
 * over a river on a long bridge and into a tunnel under the ridge, landscaped
 * islands inside the loops, a low-rise city round the edges, traffic
 * everywhere, and a day of example counts as a story.
 *
 * x runs east, z south. The stack is laid in its own frame (u east, v south,
 * its middle at STACK): everything that leaves or joins the northbound
 * carriageway is laid once, and turned a quarter at a time for the westbound,
 * southbound and eastbound ones (`quarterTurned`: north turns to west).
 */

// ---------------------------------------------------------------- the land

const GROUND: TVec2 = [220, 170];

/** The stack's middle, and the cloverleaf's, on the east–west freeway. */
const STACK: TVec2 = [-34, -6];
const CLOVER: TVec2 = [62, -6];

/** Each carriageway's centre line from its freeway's, and how wide it is (three lanes). */
const CARRIAGEWAY_OFFSET = 2.6;
const CARRIAGEWAY_WIDTH = 3.6;
/** A one-lane ramp. */
const RAMP_WIDTH = 1.8;

/** The levels: the north–south freeway over the east–west one, the flyovers over both. */
/** Drawn higher than true, as miniatures are, so the levels read from above. */
const LEVEL_FREEWAY = 2.8;
const LEVEL_LOW_FLYOVERS = 5.6;
const LEVEL_HIGH_FLYOVERS = 8.4;

const ROAD_COLOR = "#8f8a82";
const DECK_COLOR = "#cfc6b4";

// ---------------------------------------------------------------- the stack, in its frame

/** Where the ramps are laid from the freeway's centre line. */
const RAMP_OFFSET = 6;
/** The flyovers' radius. */
const FLYOVER_RADIUS = 28;
/** How far from the middle the exit leaves the carriageway, and where it splits left and right. */
const EXIT_AT = 54;
const SPLIT_AT = 44;
/** How far from the middle a flyover and a right turn come together, and join the carriageway. */
const JOIN_AT = 44;
const ENTRY_AT = 56;

const FLYOVER_CENTRE: TVec2 = [RAMP_OFFSET - FLYOVER_RADIUS, FLYOVER_RADIUS - RAMP_OFFSET];

/** The northbound carriageway's exit: leaves it at a shallow angle, then runs beside it. */
const EXIT_PATH = joinPath(
	[[CARRIAGEWAY_OFFSET, EXIT_AT]],
	[[RAMP_OFFSET - 0.8, EXIT_AT - 5.5]],
	linePoints([RAMP_OFFSET, SPLIT_AT + 1.5], [RAMP_OFFSET, SPLIT_AT]),
);

/** The left-turn flyover, northbound to westbound: up, round over the middle, and down beside the westbound. */
const FLYOVER_PATH = joinPath(
	linePoints([RAMP_OFFSET, SPLIT_AT], [RAMP_OFFSET, FLYOVER_CENTRE[1]]),
	arcPoints(FLYOVER_CENTRE, FLYOVER_RADIUS, 0, -90),
	linePoints([FLYOVER_CENTRE[0], -RAMP_OFFSET], [-JOIN_AT, -RAMP_OFFSET]),
);

/** The right turn, northbound to eastbound: off to the right, round, and alongside the flyover from the south. */
const RIGHT_TURN_RADIUS = 13;
const RIGHT_TURN_CENTRE: TVec2 = [9 + RIGHT_TURN_RADIUS, 9.5 + RIGHT_TURN_RADIUS];
const RIGHT_TURN_PATH = joinPath(
	[[RAMP_OFFSET, SPLIT_AT]],
	[[8.2, SPLIT_AT - 6]],
	linePoints([9, SPLIT_AT - 10], [9, RIGHT_TURN_CENTRE[1]]),
	arcPoints(RIGHT_TURN_CENTRE, RIGHT_TURN_RADIUS, 180, 270),
	[[JOIN_AT - 4, RAMP_OFFSET + 1.4]],
	[[JOIN_AT, RAMP_OFFSET]],
);

/** Where a flyover and a right turn meet, then join the carriageway (here the southbound flyover's, joining eastbound). */
const ENTRY_PATH = joinPath(
	[[JOIN_AT, RAMP_OFFSET]],
	[[JOIN_AT + 5, RAMP_OFFSET]],
	[[ENTRY_AT - 6, CARRIAGEWAY_OFFSET + 1.4]],
	[[ENTRY_AT, CARRIAGEWAY_OFFSET]],
);

/** How high the split, and the join of a flyover and a right turn, stand. */
const SPLIT_LEVEL = 1.2;
const JOIN_LEVEL = 1.8;

const flyoverAltitudes = (level: number) => {
	const length = pathLength(FLYOVER_PATH);
	// At its level over the middle, from before it crosses its own carriageway to after the
	// last one, the other flyovers crossing it in between.
	const straight = SPLIT_AT - FLYOVER_CENTRE[1];
	const over = straight + (FLYOVER_RADIUS * 24 * Math.PI) / 180;
	const past = straight + (FLYOVER_RADIUS * 66 * Math.PI) / 180;
	return withAltitudes(FLYOVER_PATH, [
		[0, SPLIT_LEVEL],
		[over, level],
		[past, level],
		[length, JOIN_LEVEL],
	]);
};

const EXIT_POINTS = withAltitudes(EXIT_PATH, [
	[0, 0],
	[AT_END, SPLIT_LEVEL],
]);
const RIGHT_TURN_POINTS = withAltitudes(RIGHT_TURN_PATH, [
	[0, SPLIT_LEVEL],
	[10, 0],
	[-14, 0],
	[AT_END, JOIN_LEVEL],
]);
const ENTRY_POINTS = withAltitudes(ENTRY_PATH, [
	[0, JOIN_LEVEL],
	[AT_END, 0],
]);

/** A path in the stack's frame, turned a quarter `quarters` times and placed in the world. */
const placed = (points: readonly TPathPoint[], quarters: number): [number, number, number][] =>
	points.map(([u, v, altitude]) => {
		const [x, z] = quarterTurned([u, v], quarters);
		return [round2(STACK[0] + x), round2(STACK[1] + z), altitude];
	});

const round2 = (value: number) => Math.round(value * 100) / 100 + 0;

/** The carriageways as the stack's frame turns them: 0 northbound, 1 westbound, 2 southbound, 3 eastbound. */
const CARRIAGEWAYS = ["nb", "wb", "sb", "eb"] as const;
const CARRIAGEWAY_NAMES = ["northbound", "westbound", "southbound", "eastbound"];

/** One-way ramps on pillars that keep clear. */
const ramp = (
	id: string,
	name: string,
	points: [number, number, number][],
	more: Partial<TRoadInput> = {},
): TRoadInput => ({
	id,
	name,
	kind: "road_01",
	points,
	width: RAMP_WIDTH,
	cornerRadius: 1.5,
	showsCentreLine: false,
	heldUpBy: "pillars",
	pillarSpacing: 5,
	colors: { surface: { color: ROAD_COLOR }, embankment: { color: DECK_COLOR } },
	...more,
});

const stackRamps: TRoadInput[] = [0, 1, 2, 3].flatMap((k) => {
	const from = CARRIAGEWAYS[k];
	const left = CARRIAGEWAYS[(k + 1) % 4];
	const right = CARRIAGEWAYS[(k + 3) % 4];
	// Flyovers that cross each other stand on different levels.
	const level = k % 2 === 0 ? LEVEL_LOW_FLYOVERS : LEVEL_HIGH_FLYOVERS;
	return [
		ramp(`${from}_exit`, `Exit from the ${CARRIAGEWAY_NAMES[k]}`, placed(EXIT_POINTS, k)),
		ramp(
			`${from}_to_${left}`,
			`Flyover, ${CARRIAGEWAY_NAMES[k]} to ${CARRIAGEWAY_NAMES[(k + 1) % 4]}`,
			placed(flyoverAltitudes(level), k),
			{ pillarSpacing: 6 },
		),
		ramp(
			`${from}_to_${right}`,
			`Right turn, ${CARRIAGEWAY_NAMES[k]} to ${CARRIAGEWAY_NAMES[(k + 3) % 4]}`,
			placed(RIGHT_TURN_POINTS, k),
		),
		// The entry laid in this frame is the one onto the carriageway this one turns right into,
		// where its right turn and the flyover from two quarters on come together.
		ramp(
			`${right}_entry`,
			`Entry to the ${CARRIAGEWAY_NAMES[(k + 3) % 4]}`,
			placed(ENTRY_POINTS, k),
		),
	];
});

// ---------------------------------------------------------------- the freeways

/** The north–south freeway's altitude by z: over the east–west one in the stack, over the river to the south. */
const RIVER_Z: [number, number] = [56, 70];
const nsAltitude = (z: number) => {
	const v = z - STACK[1];
	const smooth = (t: number) => {
		const c = Math.max(0, Math.min(1, t));
		return c * c * (3 - 2 * c);
	};
	const overStack = LEVEL_FREEWAY * smooth((34 - Math.abs(v)) / 23);
	const overRiver = 2.6 * smooth((z - 52) / 5);
	// Into the south hills at the bridge's height.
	return round2(Math.max(overStack, overRiver));
};

/** Where the hills' tunnels take the freeways: the ridge to the north, the hills west, east and south. */
const NORTH_TUNNEL_Z = -66;
const SOUTH_TUNNEL_Z = 76;
const WEST_TUNNEL_X = -98;
const EAST_TUNNEL_X = 100;

const linePath = (points: TVec2[], altitude: (point: TVec2) => number) => {
	const dense = joinPath(...points.slice(1).map((point, i) => linePoints(points[i], point, 2.5)));
	return dense.map(([x, z]): TPathPoint => [round2(x), round2(z), altitude([x, z])]);
};

const NB_X = STACK[0] + CARRIAGEWAY_OFFSET;
const SB_X = STACK[0] - CARRIAGEWAY_OFFSET;
const EB_Z = STACK[1] + CARRIAGEWAY_OFFSET;
const WB_Z = STACK[1] - CARRIAGEWAY_OFFSET;
const HALF: TVec2 = [GROUND[0] / 2, GROUND[1] / 2];

/**
 * How far inside the hills each freeway turns round, out of sight: one carriageway turns into
 * the other there, so no one-way road leads nowhere.
 */
const TURN_DEPTH = 7;
const NORTH_TURN = NORTH_TUNNEL_Z - TURN_DEPTH;
const SOUTH_TURN = SOUTH_TUNNEL_Z + TURN_DEPTH - 2;
const WEST_TURN = WEST_TUNNEL_X - TURN_DEPTH;
const EAST_TURN = EAST_TUNNEL_X + TURN_DEPTH;

/** The Valley Freeway northbound: from the south hills over the river, through the stack, into the ridge. */
const NB_PATH = linePath(
	[
		[STACK[0], SOUTH_TURN + CARRIAGEWAY_OFFSET],
		[NB_X, SOUTH_TURN],
		[NB_X, NORTH_TURN],
		[STACK[0], NORTH_TURN - CARRIAGEWAY_OFFSET],
	],
	([, z]) => nsAltitude(z),
);
const SB_PATH = linePath(
	[
		[STACK[0], NORTH_TURN - CARRIAGEWAY_OFFSET],
		[SB_X, NORTH_TURN],
		[SB_X, SOUTH_TURN],
		[STACK[0], SOUTH_TURN + CARRIAGEWAY_OFFSET],
	],
	([, z]) => nsAltitude(z),
);

/** The Crosstown Freeway: from the west hills through the stack and the cloverleaf into the east hill. */
const EB_PATH = linePath(
	[
		[WEST_TURN - CARRIAGEWAY_OFFSET, STACK[1]],
		[WEST_TURN, EB_Z],
		[EAST_TURN, EB_Z],
		[EAST_TURN + CARRIAGEWAY_OFFSET, STACK[1]],
	],
	() => 0,
);
const WB_PATH = linePath(
	[
		[EAST_TURN + CARRIAGEWAY_OFFSET, STACK[1]],
		[EAST_TURN, WB_Z],
		[WEST_TURN, WB_Z],
		[WEST_TURN - CARRIAGEWAY_OFFSET, STACK[1]],
	],
	() => 0,
);

const stackPlace = (u: number, v: number, quarters: number): TVec2 => {
	const [x, z] = quarterTurned([u, v], quarters);
	return [STACK[0] + x, STACK[1] + z];
};
const cloverPlace = (u: number, v: number): TVec2 => [CLOVER[0] + u, CLOVER[1] + v];

/** The cloverleaf's ramps leave and join the freeway this far from the boulevard. */
const LOOP_GORE = 6;
const OUTER_GORE = 34;

const CARRIAGEWAY_CUTS: Record<(typeof CARRIAGEWAYS)[number], TVec2[]> = {
	nb: [stackPlace(CARRIAGEWAY_OFFSET, EXIT_AT, 0), stackPlace(CARRIAGEWAY_OFFSET, -ENTRY_AT, 0)],
	wb: [
		cloverPlace(OUTER_GORE, -CARRIAGEWAY_OFFSET),
		cloverPlace(LOOP_GORE, -CARRIAGEWAY_OFFSET),
		cloverPlace(-LOOP_GORE, -CARRIAGEWAY_OFFSET),
		cloverPlace(-OUTER_GORE, -CARRIAGEWAY_OFFSET),
		stackPlace(CARRIAGEWAY_OFFSET, EXIT_AT, 1),
		stackPlace(CARRIAGEWAY_OFFSET, -ENTRY_AT, 1),
	],
	sb: [stackPlace(CARRIAGEWAY_OFFSET, EXIT_AT, 2), stackPlace(CARRIAGEWAY_OFFSET, -ENTRY_AT, 2)],
	eb: [
		stackPlace(CARRIAGEWAY_OFFSET, EXIT_AT, 3),
		stackPlace(CARRIAGEWAY_OFFSET, -ENTRY_AT, 3),
		cloverPlace(-OUTER_GORE, CARRIAGEWAY_OFFSET),
		cloverPlace(-LOOP_GORE, CARRIAGEWAY_OFFSET),
		cloverPlace(LOOP_GORE, CARRIAGEWAY_OFFSET),
		cloverPlace(OUTER_GORE, CARRIAGEWAY_OFFSET),
	],
};

const CARRIAGEWAY_PATHS = { nb: NB_PATH, wb: WB_PATH, sb: SB_PATH, eb: EB_PATH };
const FREEWAY_NAMES = {
	nb: "Valley Freeway northbound",
	sb: "Valley Freeway southbound",
	eb: "Crosstown Freeway eastbound",
	wb: "Crosstown Freeway westbound",
};

/** Each carriageway's pieces between its slip roads, `nb_1`, `nb_2`…, in the order they're driven. */
const carriagewayPieces = Object.fromEntries(
	CARRIAGEWAYS.map((id) => [id, cutPathAt(CARRIAGEWAY_PATHS[id], CARRIAGEWAY_CUTS[id])]),
) as Record<(typeof CARRIAGEWAYS)[number], TPathPoint[][]>;

const carriageways: TRoadInput[] = CARRIAGEWAYS.flatMap((id) =>
	carriagewayPieces[id].map(
		(points, i): TRoadInput => ({
			id: `${id}_${i + 1}`,
			name: `${FREEWAY_NAMES[id]} (${i + 1})`,
			kind: "road_01",
			points,
			width: CARRIAGEWAY_WIDTH,
			cornerRadius: 3,
			showsCentreLine: false,
			heldUpBy: "pillars",
			pillarSpacing: 6,
			colors: { surface: { color: ROAD_COLOR }, embankment: { color: DECK_COLOR } },
		}),
	),
);

// ---------------------------------------------------------------- the cloverleaf and the boulevard

/** The boulevard: two lanes each way, over the freeway on a bridge, from the hills to the river. */
const BOULEVARD_WIDTH = 4.8;
const BOULEVARD_LEVEL = 2.4;
const LOOP_JOIN = 14;
const OUTER_JOIN = 30;
const RIVERSIDE_Z = 50;
const BOULEVARD_NORTH = -HALF[1];

const boulevardAltitude = (v: number) => {
	const t = Math.max(0, Math.min(1, (13 - Math.abs(v)) / 7));
	return round2(BOULEVARD_LEVEL * t * t * (3 - 2 * t));
};

const BOULEVARD_PATH = linePath(
	[
		[CLOVER[0], RIVERSIDE_Z],
		[CLOVER[0], BOULEVARD_NORTH],
	],
	([, z]) => boulevardAltitude(z - CLOVER[1]),
);
const BOULEVARD_PIECES = cutPathAt(BOULEVARD_PATH, [
	cloverPlace(0, OUTER_JOIN),
	cloverPlace(0, LOOP_JOIN),
	cloverPlace(0, -LOOP_JOIN),
	cloverPlace(0, -OUTER_JOIN),
]);

/** The south-east loop, eastbound to the boulevard northbound, in the cloverleaf's frame (u east, v south). */
const LOOP_RADIUS = 8;
const LOOP_CENTRE: TVec2 = [13, 15.5];
const LOOP_PATH = joinPath(
	[[LOOP_GORE, CARRIAGEWAY_OFFSET]],
	[[LOOP_GORE + 3.5, CARRIAGEWAY_OFFSET + 0.7]],
	arcPoints(LOOP_CENTRE, LOOP_RADIUS, -105, 165, 2.5),
	[[0, LOOP_JOIN]],
);
/** The south-east outer ramp, boulevard northbound to eastbound, round outside the loop. */
const OUTER_PATH = joinPath(
	[[0, OUTER_JOIN]],
	[[5, OUTER_JOIN + 1.5]],
	arcPoints([14, 17], 14.5, 100, 0, 2.5).slice(1),
	linePoints([28.5, 14], [28.5, 9]),
	[[30.5, CARRIAGEWAY_OFFSET + 2.2]],
	[[OUTER_GORE, CARRIAGEWAY_OFFSET]],
);

type TQuadrant = "se" | "sw" | "nw" | "ne";

/** A path of the south-east quadrant as another quadrant has it: mirrored, and driven the other way where it's mirrored once. */
const inQuadrant = (path: TVec2[], quadrant: TQuadrant): TVec2[] => {
	const flip: Record<TQuadrant, [number, number]> = {
		se: [1, 1],
		sw: [-1, 1],
		nw: [-1, -1],
		ne: [1, -1],
	};
	const [fu, fv] = flip[quadrant];
	const moved = path.map(([u, v]): TVec2 => cloverPlace(u * fu, v * fv));
	return fu * fv < 0 ? moved.reverse() : moved;
};

const atGround = (path: TVec2[]) => path.map(([x, z]): TPathPoint => [round2(x), round2(z), 0]);

const QUADRANT_NAMES: Record<TQuadrant, { loop: string; outer: string }> = {
	se: { loop: "Loop, eastbound to the boulevard north", outer: "Boulevard north to eastbound" },
	sw: { loop: "Loop, boulevard south to eastbound", outer: "Eastbound to the boulevard south" },
	nw: { loop: "Loop, westbound to the boulevard south", outer: "Boulevard south to westbound" },
	ne: { loop: "Loop, boulevard north to westbound", outer: "Westbound to the boulevard north" },
};

const QUADRANTS: TQuadrant[] = ["se", "sw", "nw", "ne"];

const cloverRamps: TRoadInput[] = QUADRANTS.flatMap((quadrant) => [
	ramp(
		`loop_${quadrant}`,
		QUADRANT_NAMES[quadrant].loop,
		atGround(inQuadrant(LOOP_PATH, quadrant)),
		{
			width: 1.6,
		},
	),
	ramp(
		`outer_${quadrant}`,
		QUADRANT_NAMES[quadrant].outer,
		atGround(inQuadrant(OUTER_PATH, quadrant)),
		{ width: 1.6 },
	),
]);

const boulevard: TRoadInput[] = BOULEVARD_PIECES.map((points, i) => ({
	id: `boulevard_${i + 1}`,
	name: `Harbor Boulevard (${i + 1})`,
	kind: "road_01",
	points,
	width: BOULEVARD_WIDTH,
	cornerRadius: 3,
	heldUpBy: "pillars",
	pillarSpacing: 4,
	colors: { surface: { color: ROAD_COLOR }, embankment: { color: DECK_COLOR } },
}));

// ---------------------------------------------------------------- junctions

type TEndRef = readonly [string, "start" | "end"];
const junction = (id: string, ends: TEndRef[]) => ({
	id,
	ends: ends.map(([roadId, end]) => ({ roadId, end })),
});

/** Where the carriageway's pieces meet at a slip road, by the piece before it. */
const piecesAt = (id: (typeof CARRIAGEWAYS)[number], before: number): TEndRef[] => [
	[`${id}_${before}`, "end"],
	[`${id}_${before + 1}`, "start"],
];

/** Which piece of each carriageway comes before its exit in the stack, and before its entry. */
const STACK_EXIT_PIECE = { nb: 1, wb: 5, sb: 1, eb: 1 };
const STACK_ENTRY_PIECE = { nb: 2, wb: 6, sb: 2, eb: 2 };

const stackJunctions = [0, 1, 2, 3].flatMap((k) => {
	const from = CARRIAGEWAYS[k];
	const left = CARRIAGEWAYS[(k + 1) % 4];
	const right = CARRIAGEWAYS[(k + 3) % 4];
	// In this quarter's frame the flyover from two quarters on and this one's right turn come together.
	const opposite = CARRIAGEWAYS[(k + 2) % 4];
	return [
		junction(`${from}_exit`, [
			...piecesAt(from, STACK_EXIT_PIECE[from]),
			[`${from}_exit`, "start"],
		]),
		junction(`${from}_split`, [
			[`${from}_exit`, "end"],
			[`${from}_to_${left}`, "start"],
			[`${from}_to_${right}`, "start"],
		]),
		junction(`${right}_join`, [
			[`${opposite}_to_${right}`, "end"],
			[`${from}_to_${right}`, "end"],
			[`${right}_entry`, "start"],
		]),
		junction(`${right}_entry`, [
			...piecesAt(right, STACK_ENTRY_PIECE[right]),
			[`${right}_entry`, "end"],
		]),
	];
});

const cloverJunctions = [
	junction("eb_outer_sw", [...piecesAt("eb", 3), ["outer_sw", "start"]]),
	junction("eb_loop_sw", [...piecesAt("eb", 4), ["loop_sw", "end"]]),
	junction("eb_loop_se", [...piecesAt("eb", 5), ["loop_se", "start"]]),
	junction("eb_outer_se", [...piecesAt("eb", 6), ["outer_se", "end"]]),
	junction("wb_outer_ne", [...piecesAt("wb", 1), ["outer_ne", "start"]]),
	junction("wb_loop_ne", [...piecesAt("wb", 2), ["loop_ne", "end"]]),
	junction("wb_loop_nw", [...piecesAt("wb", 3), ["loop_nw", "start"]]),
	junction("wb_outer_nw", [...piecesAt("wb", 4), ["outer_nw", "end"]]),
	junction("boulevard_outer_south", [
		["boulevard_1", "end"],
		["boulevard_2", "start"],
		["outer_se", "start"],
		["outer_sw", "end"],
	]),
	junction("boulevard_loop_south", [
		["boulevard_2", "end"],
		["boulevard_3", "start"],
		["loop_se", "end"],
		["loop_sw", "start"],
	]),
	junction("boulevard_loop_north", [
		["boulevard_3", "end"],
		["boulevard_4", "start"],
		["loop_nw", "end"],
		["loop_ne", "start"],
	]),
	junction("boulevard_outer_north", [
		["boulevard_4", "end"],
		["boulevard_5", "start"],
		["outer_nw", "start"],
		["outer_ne", "end"],
	]),
];

/** Under the hills, out of sight, each freeway's carriageways turn into each other. */
const turnJunctions = [
	junction("valley_north_turn", [
		[`nb_${carriagewayPieces.nb.length}`, "end"],
		["sb_1", "start"],
	]),
	junction("valley_south_turn", [
		[`sb_${carriagewayPieces.sb.length}`, "end"],
		["nb_1", "start"],
	]),
	junction("crosstown_west_turn", [
		[`wb_${carriagewayPieces.wb.length}`, "end"],
		["eb_1", "start"],
	]),
	junction("crosstown_east_turn", [
		[`eb_${carriagewayPieces.eb.length}`, "end"],
		["wb_1", "start"],
	]),
];

// ---------------------------------------------------------------- the riverside drive

/** Along the river's north bank, from near the Valley Freeway to the east hill, meeting the boulevard. */
const RIVERSIDE_WEST = -14;
const RIVERSIDE_EAST = 98;

const street = (
	id: string,
	name: string,
	points: TPathPoint[],
	more: Partial<TRoadInput> = {},
): TRoadInput => ({
	id,
	name,
	kind: "road_01",
	points,
	width: 2.4,
	cornerRadius: 3,
	colors: { surface: { color: ROAD_COLOR } },
	...more,
});

const riversideDrive: TRoadInput[] = [
	street(
		"riverside_west",
		"Riverside Drive (west)",
		linePath(
			[
				[RIVERSIDE_WEST, RIVERSIDE_Z - 1],
				[20, RIVERSIDE_Z - 0.5],
				[CLOVER[0], RIVERSIDE_Z],
			],
			() => 0,
		),
	),
	street(
		"riverside_east",
		"Riverside Drive (east)",
		linePath(
			[
				[CLOVER[0], RIVERSIDE_Z],
				[84, RIVERSIDE_Z - 1],
				[RIVERSIDE_EAST, RIVERSIDE_Z - 3],
			],
			() => 0,
		),
	),
];

const riversideJunctions = [
	junction("riverside_boulevard", [
		["riverside_west", "end"],
		["riverside_east", "start"],
		["boulevard_1", "start"],
	]),
];

// ---------------------------------------------------------------- the land round it

/** The hills: as high as this, sloping down to the valley, with cliffs where the tunnels go in. */
const HILL_HEIGHT = 6;
const DOWN = -HILL_HEIGHT;

/** The rail line's way across: from the ridge's north-west corner to the south hills, over the stack. */
const railX = (z: number) => z - 28;
const RAIL_NORTH_Z = -58;
const RAIL_SOUTH_Z = 74;

const AREAS: TAreaInput[] = [
	{
		id: "ridge",
		kind: "raised_land_01",
		name: "The ridge",
		height: HILL_HEIGHT,
		colors: { surface: { color: "#a69a6b" } },
		points: [
			[-HALF[0], -HALF[1]],
			[36, -HALF[1]],
			[30, -77, DOWN],
			[14, -71, DOWN],
			[-18, -69, -3],
			[STACK[0] + 9, NORTH_TUNNEL_Z],
			[STACK[0] - 9, NORTH_TUNNEL_Z],
			[-50, -68, -3],
			[-70, -66, DOWN],
			[-80, -63, -2],
			[railX(RAIL_NORTH_Z) + 3, RAIL_NORTH_Z],
			[railX(RAIL_NORTH_Z) - 5, RAIL_NORTH_Z - 4],
			[-95, -48, DOWN],
			[WEST_TUNNEL_X, STACK[1] - 9],
			[WEST_TUNNEL_X, STACK[1] + 9],
			[-96, 16, DOWN],
			[-98, 34, DOWN],
			[-HALF[0], 42],
		],
		peaks: [
			[-62, -79, 3],
			[-8, -80, 2],
			[-104, -32, 3],
			[-105, 22, 1],
		],
	},
	{
		id: "east_hill",
		kind: "raised_land_01",
		name: "The east hill",
		height: HILL_HEIGHT,
		colors: { surface: { color: "#a69a6b" } },
		points: [
			[HALF[0], -58],
			[105, -54, DOWN],
			[EAST_TUNNEL_X, STACK[1] - 9],
			[EAST_TUNNEL_X, STACK[1] + 9],
			[105, 20, DOWN],
			[104, 46, DOWN],
			[HALF[0], 50],
		],
	},
	{
		id: "south_hills",
		kind: "raised_land_01",
		name: "The south hills",
		height: HILL_HEIGHT,
		colors: { surface: { color: "#a69a6b" } },
		points: [
			[-HALF[0], 73, DOWN],
			[-54, 73, DOWN],
			[STACK[0] - 9, SOUTH_TUNNEL_Z],
			[STACK[0] + 9, SOUTH_TUNNEL_Z],
			[-10, 73, DOWN],
			[railX(RAIL_SOUTH_Z) - 5, RAIL_SOUTH_Z],
			[railX(RAIL_SOUTH_Z) + 5, RAIL_SOUTH_Z],
			[70, 73, DOWN],
			[HALF[0], 72, DOWN],
			[HALF[0], HALF[1]],
			[-HALF[0], HALF[1]],
		],
		peaks: [
			[-80, 81, 2],
			[10, 82, 3],
			[85, 81, 1],
		],
	},
	{
		id: "river",
		kind: "water_01",
		name: "The river",
		points: [
			[-HALF[0], RIVER_Z[0] + 2],
			[-60, RIVER_Z[0] + 1],
			[-20, RIVER_Z[0]],
			[20, RIVER_Z[0] + 1],
			[60, RIVER_Z[0]],
			[HALF[0], RIVER_Z[0] - 1],
			[HALF[0], RIVER_Z[1] - 1],
			[60, RIVER_Z[1]],
			[20, RIVER_Z[1] + 1],
			[-20, RIVER_Z[1]],
			[-60, RIVER_Z[1] + 1],
			[-HALF[0], RIVER_Z[1] + 1],
		],
	},
];

// ---------------------------------------------------------------- a day of traffic, as example data

const EXAMPLE = "Example numbers shaped like real counts, not live data";

/** The day the story plays: 05:00 to 23:00, an hour a step. */
const STORY_DAY = "2026-06-10";
const STORY_HOURS = Array.from({ length: 19 }, (_, i) => 5 + i);
/** The hour the world opens at, as the story's "now": the evening rush building. */
const NOW_HOUR = 17;
const hourAt = (hour: number) => `${STORY_DAY}T${String(hour).padStart(2, "0")}:00`;

/** Which way a road's traffic peaks: towards downtown in the morning, home in the evening, or both. */
type TPeak = "in" | "out" | "both";

interface ITrafficRow {
	key: string;
	/** Vehicles an hour it carries at its fullest, and its speed when free, in km/h. */
	capacity: number;
	freeSpeed: number;
	/** How long it is, in km, for the delay. */
	lengthKm: number;
	peak: TPeak;
}

const TRAFFIC_ROWS: Record<string, ITrafficRow> = {
	nb: {
		key: "Valley Freeway northbound",
		capacity: 6000,
		freeSpeed: 105,
		lengthKm: 6,
		peak: "out",
	},
	sb: { key: "Valley Freeway southbound", capacity: 6000, freeSpeed: 105, lengthKm: 6, peak: "in" },
	eb: {
		key: "Crosstown Freeway eastbound",
		capacity: 6000,
		freeSpeed: 105,
		lengthKm: 7,
		peak: "in",
	},
	wb: {
		key: "Crosstown Freeway westbound",
		capacity: 6000,
		freeSpeed: 105,
		lengthKm: 7,
		peak: "out",
	},
	nb_to_wb: {
		key: "Flyover, northbound to westbound",
		capacity: 1900,
		freeSpeed: 80,
		lengthKm: 1.2,
		peak: "out",
	},
	wb_to_sb: {
		key: "Flyover, westbound to southbound",
		capacity: 1900,
		freeSpeed: 80,
		lengthKm: 1.2,
		peak: "out",
	},
	sb_to_eb: {
		key: "Flyover, southbound to eastbound",
		capacity: 1900,
		freeSpeed: 80,
		lengthKm: 1.2,
		peak: "in",
	},
	eb_to_nb: {
		key: "Flyover, eastbound to northbound",
		capacity: 1900,
		freeSpeed: 80,
		lengthKm: 1.2,
		peak: "both",
	},
	nb_to_eb: {
		key: "Right turn, northbound to eastbound",
		capacity: 1800,
		freeSpeed: 70,
		lengthKm: 0.8,
		peak: "in",
	},
	wb_to_nb: {
		key: "Right turn, westbound to northbound",
		capacity: 1800,
		freeSpeed: 70,
		lengthKm: 0.8,
		peak: "out",
	},
	sb_to_wb: {
		key: "Right turn, southbound to westbound",
		capacity: 1800,
		freeSpeed: 70,
		lengthKm: 0.8,
		peak: "both",
	},
	eb_to_sb: {
		key: "Right turn, eastbound to southbound",
		capacity: 1800,
		freeSpeed: 70,
		lengthKm: 0.8,
		peak: "out",
	},
	clover: { key: "Cloverleaf ramps", capacity: 1500, freeSpeed: 50, lengthKm: 0.6, peak: "both" },
	boulevard: { key: "Harbor Boulevard", capacity: 3200, freeSpeed: 60, lengthKm: 2.5, peak: "in" },
	riverside: { key: "Riverside Drive", capacity: 1400, freeSpeed: 50, lengthKm: 2, peak: "both" },
};

/** Which row a road follows, by its id: a carriageway's pieces, exit and entry its own; each ramp its own. */
const trafficRowOf = (roadId: string): string | null => {
	const carriageway = roadId.match(/^(nb|sb|eb|wb)_(\d+|exit|entry)$/);
	if (carriageway) {
		return carriageway[1];
	}
	if (TRAFFIC_ROWS[roadId]) {
		return roadId;
	}
	if (/^(loop|outer)_/.test(roadId)) {
		return "clover";
	}
	if (roadId.startsWith("boulevard_")) {
		return "boulevard";
	}
	if (roadId.startsWith("riverside_")) {
		return "riverside";
	}
	return null;
};

const bell = (hour: number, middle: number, width: number) =>
	Math.exp(-(((hour - middle) / width) ** 2));

/** How full a road is at an hour, 0 to just over 1: low at night, a midday lull between two rushes. */
const fullnessAt = (hour: number, peak: TPeak) => {
	const [morning, evening] = { in: [1, 0.42], out: [0.42, 1], both: [0.78, 0.78] }[peak];
	return (
		0.05 +
		0.42 * bell(hour, 12.8, 3.6) +
		0.62 * morning * bell(hour, 8, 1.15) +
		0.62 * evening * bell(hour, 17.4, 1.3)
	);
};

/** A row of the table at an hour: vehicles an hour, average speed, delay and how congested. */
const rowAt = (row: ITrafficRow, hour: number) => {
	const full = fullnessAt(hour, row.peak);
	const jam = Math.max(0, (full - 0.62) / 0.45) ** 1.4;
	const speed = Math.max(12, Math.round(row.freeSpeed * (1 - 0.82 * jam)));
	const delay = Math.round(row.lengthKm * 60 * (1 / speed - 1 / row.freeSpeed) * 10) / 10;
	return {
		road: row.key,
		vehicles_per_hour: Math.round((row.capacity * Math.min(1.02, full)) / 10) * 10,
		average_speed: speed,
		delay_minutes: delay,
		congestion: round2(Math.min(1, full)),
	};
};

const rowsAt = (hour: number) => Object.values(TRAFFIC_ROWS).map((row) => rowAt(row, hour));

const totalAt = (hour: number) => rowsAt(hour).reduce((sum, row) => sum + row.vehicles_per_hour, 0);
const worstAt = (hour: number) =>
	rowsAt(hour).reduce((worst, row) => (row.delay_minutes > worst.delay_minutes ? row : worst));

const valueWithHistory = (
	key: string,
	name: string,
	unit: string,
	at: (hour: number) => number | string,
) => ({
	key,
	name,
	unit,
	value: at(NOW_HOUR),
	about: EXAMPLE,
	history: STORY_HOURS.map((hour) => ({ at: hourAt(hour), value: at(hour) })),
});

const DATA: TSceneInput["data"] = {
	enabled: true,
	values: [
		valueWithHistory("hour", "Hour of the day", "", (hour) => hour),
		valueWithHistory("total_vehicles", "Vehicles through the interchange", " an hour", totalAt),
		valueWithHistory("worst_delay", "Worst delay", " min", (hour) => worstAt(hour).delay_minutes),
		valueWithHistory("worst_road", "Slowest road", "", (hour) => worstAt(hour).road),
	],
	tables: [
		{
			key: "traffic",
			name: "Traffic by road",
			keyColumn: "road",
			columns: [
				{ key: "road", name: "Road", about: EXAMPLE },
				{ key: "vehicles_per_hour", name: "Vehicles an hour", about: EXAMPLE },
				{ key: "average_speed", name: "Average speed", unit: " km/h", about: EXAMPLE },
				{ key: "delay_minutes", name: "Delay", unit: " min", about: EXAMPLE },
				{
					key: "congestion",
					name: "How full",
					about: `${EXAMPLE}: vehicles as a share of what it carries at its fullest`,
				},
			],
			rows: rowsAt(NOW_HOUR),
			history: STORY_HOURS.map((hour) => ({ at: hourAt(hour), rows: rowsAt(hour) })),
		},
	],
};

/** A range binding to a row's column: from `low` at `atLow` to `high` at `atHigh`. */
const fromRow = (column: string, atLow: number, atHigh: number, low: number, high: number) => ({
	key: `row.${column}`,
	valueAtLowSetting: atLow,
	valueAtHighSetting: atHigh,
	lowSetting: low,
	highSetting: high,
});

/** Busy roads turn brick red as they fill, past half full. */
const CONGESTED = "#b4473c";

/** How many vehicles per 10 units each way at its fullest: three lanes of queue on a carriageway. */
const densityAtFullest = (rowId: string) =>
	["nb", "sb", "eb", "wb"].includes(rowId) ? 3.6 : rowId === "boulevard" ? 2.6 : 2;

/** The vehicles a road's flow sends on, by its id, so every kind turns up everywhere. */
const vehicleKindOf = (roadId: string, i: number) => {
	if (roadId.startsWith("boulevard_")) {
		return i % 3 === 0 ? "bus_01" : "car_01";
	}
	return ["car_01", "car_01", "delivery_van_01", "car_01", "truck_01", "car_01"][i % 6];
};

/** A road with its traffic: a flow that drives on through the network, its amount and colour from its row. */
const withTraffic = (road: TRoadInput, i: number): TRoadInput => {
	const rowId = trafficRowOf(road.id);
	if (!rowId) {
		return road;
	}
	const row = TRAFFIC_ROWS[rowId];
	const isFreeway = ["nb", "sb", "eb", "wb"].includes(rowId);
	return {
		...road,
		dataRow: { tableKey: "traffic", rowKey: row.key },
		flow: {
			enabled: true,
			vehicleKind: vehicleKindOf(road.id, i),
			vehicleCountAlong: 4,
			vehicleCountAgainst: 0,
			speed: isFreeway ? 5 : 3.6,
			vehicleScale: 0.9,
			showsArrows: false,
			drivesThroughJunctions: true,
		},
		data: {
			vehicleDensity: fromRow("vehicles_per_hour", 0, row.capacity, 0.2, densityAtFullest(rowId)),
		},
		colors: {
			...road.colors,
			surface: {
				color: ROAD_COLOR,
				data: {
					color: {
						key: "row.congestion",
						valueAtLowColor: 0.55,
						valueAtHighColor: 1,
						lowColor: ROAD_COLOR,
						highColor: CONGESTED,
					},
				},
			},
		},
	};
};

// ---------------------------------------------------------------- the world

const ROADS: TRoadInput[] = [
	...carriageways,
	...stackRamps,
	...cloverRamps,
	...boulevard,
	...riversideDrive,
].map(withTraffic);

const JUNCTIONS = [...stackJunctions, ...cloverJunctions, ...turnJunctions, ...riversideJunctions];

// ---------------------------------------------------------------- what's clear to build on

/** The roads' centre lines as drawn, with their half widths and reach, to keep things off them. */
const ROAD_LINES = ROADS.map((input) => {
	const road = RoadSchema.parse(input);
	const line = roadCenterlineOf(road).map(([x, z]): TVec2 => [x, z]);
	const xs = line.map(([x]) => x);
	const zs = line.map(([, z]) => z);
	return {
		line,
		half: road.width / 2,
		box: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)],
	};
});

/** Whether a point is at least `margin` clear of every road's edge. */
const clearOfRoads = ([x, z]: TVec2, margin: number) =>
	ROAD_LINES.every(({ line, half, box }) => {
		const reach = half + margin;
		if (x < box[0] - reach || x > box[1] + reach || z < box[2] - reach || z > box[3] + reach) {
			return true;
		}
		return line.every(
			(point, i) => i === 0 || segmentDistance([x, z], line[i - 1], point) >= reach,
		);
	});

const HILLS = AREAS.filter((area) => area.kind === "raised_land_01").map((area) =>
	AreaSchema.parse(area),
);
const RIVER = AREAS.filter((area) => area.kind === "water_01").map((area) =>
	area.points.map(([x, z]): TVec2 => [x, z]),
);

/** How high the hills' ground is at a point (0 in the valley). */
const hillAt = (point: TVec2) => round2(groundHeightAt(HILLS, point));

/** The rail line's corridor, kept clear for its viaduct. */
const inRailCorridor = ([x, z]: TVec2, margin: number) =>
	z > RAIL_NORTH_Z - 6 && z < RAIL_SOUTH_Z + 6 && Math.abs(x - railX(z)) / Math.SQRT2 < margin;

/** The landscaped islands and the cloverleaf, kept for their gardens. */
const KEPT: TVec2[][] = [];

/** Whether a square of `size` round a point is on the valley's open ground: off roads, hills, water, the rail and the gardens. */
const isBuildable = (centre: TVec2, size: number) => {
	const half = size / 2;
	const corners: TVec2[] = [
		centre,
		[centre[0] - half, centre[1] - half],
		[centre[0] + half, centre[1] - half],
		[centre[0] + half, centre[1] + half],
		[centre[0] - half, centre[1] + half],
	];
	return (
		corners.every(
			(point) =>
				Math.abs(point[0]) < HALF[0] - 1 &&
				Math.abs(point[1]) < HALF[1] - 1 &&
				hillAt(point) === 0 &&
				!RIVER.some((river) => isInsidePolygon(point, river)) &&
				!inRailCorridor(point, 2.5) &&
				!KEPT.some((zone) => isInsidePolygon(point, zone)),
		) &&
		clearOfRoads(centre, half + 0.8) &&
		corners.every((point) => clearOfRoads(point, 0.3)) &&
		RIVER.every((river) => edgeDistance(centre, river) > half + 1)
	);
};

/** A share from 0 to 1, always the same for the same n: the city's variety, the same every time. */
const shareOf = (n: number) => {
	const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
};
const pickOf = <T>(list: readonly T[], n: number) => list[Math.floor(shareOf(n) * list.length)];

// ---------------------------------------------------------------- the gardens

const GRASS = "#6f9a4c";
const LAWN = "#88a556";
const BED_COLORS = ["#a8393f", "#5d4a86", "#4f8a3c", "#d29a3a", "#b4466f", "#3f7a52"];

/** A disc as an outline. */
const disc = (centre: TVec2, radius: number, step = 1.6): TVec2[] =>
	arcPoints(centre, radius, 0, 360, step)
		.slice(0, -1)
		.map(([x, z]): TVec2 => [round2(x), round2(z)]);

/**
 * A round bed of flowers in a pinwheel, as the islands inside interchanges are planted: arms
 * of colour twisting out from the middle, each a raised area a hair over the lawn.
 */
const pinwheel = (
	id: string,
	centre: TVec2,
	radius: number,
	arms: number,
	twist: number,
	colors: readonly string[],
): TAreaInput[] =>
	Array.from({ length: arms }, (_, a) => {
		const from = (a * 360) / arms;
		const to = ((a + 1) * 360) / arms;
		const along = (start: number, out: boolean) => {
			const steps = Math.ceil(radius / 0.9);
			return Array.from({ length: steps + 1 }, (_, i): TVec2 => {
				const r = 0.5 + ((radius - 0.5) * (out ? i : steps - i)) / steps;
				const angle = ((start + (twist * r) / radius) * Math.PI) / 180;
				return [round2(centre[0] + r * Math.cos(angle)), round2(centre[1] + r * Math.sin(angle))];
			});
		};
		const rim = arcPoints(centre, radius, from + twist, to + twist, 1.2)
			.slice(1, -1)
			.map(([x, z]): TVec2 => [round2(x), round2(z)]);
		return {
			id: `${id}_${a + 1}`,
			kind: "grass_01" as const,
			name: `Flower bed ${a + 1}`,
			height: 0.03,
			colors: { surface: { color: colors[a % colors.length] } },
			surface: { kind: "plain" as const },
			points: [...along(from, true), ...rim, ...along(to, false)],
		};
	});

const lawn = (id: string, name: string, outline: TVec2[], color = GRASS): TAreaInput => ({
	id,
	kind: "grass_01",
	name,
	height: 0.01,
	colors: { surface: { color } },
	points: outline,
});

const cloverIslandCentre = (quadrant: TQuadrant): TVec2 => {
	const [loop] = inQuadrant([LOOP_CENTRE], quadrant);
	return loop;
};

const ISLAND_RADIUS = LOOP_RADIUS - 1.3;

/** Inside the cloverleaf's loops: a lawn, a pinwheel of beds, a ring of palms. */
const cloverGardens: TAreaInput[] = QUADRANTS.flatMap((quadrant, q) => {
	const centre = cloverIslandCentre(quadrant);
	return [
		lawn(
			`island_${quadrant}`,
			`Loop island (${quadrant.toUpperCase()})`,
			disc(centre, ISLAND_RADIUS),
		),
		...pinwheel(
			`island_${quadrant}_bed`,
			centre,
			ISLAND_RADIUS - 1.4,
			6,
			q % 2 === 0 ? 110 : -110,
			BED_COLORS.slice(q % 2, (q % 2) + 4).concat(BED_COLORS.slice(0, 2)),
		),
	];
});

/** In the stack, the round lawns inside its right turns, each a grove of trees. */
const STACK_ISLAND_RADIUS = RIGHT_TURN_RADIUS - 1.5;
const stackIslandCentre = (k: number): TVec2 => stackPlace(...RIGHT_TURN_CENTRE, k);

const stackGardens: TAreaInput[] = [0, 1, 2, 3].map((k) =>
	lawn(
		`stack_island_${k + 1}`,
		`Stack island ${k + 1}`,
		disc(stackIslandCentre(k), STACK_ISLAND_RADIUS),
		LAWN,
	),
);

const GARDENS = [...stackGardens, ...cloverGardens];

const tree = (
	id: string,
	kind: string,
	position: TVec2,
	n: number,
	more: Partial<TEntityInput> = {},
): TEntityInput => ({
	id,
	kind,
	position: [round2(position[0]), round2(position[1])],
	rotation: turned(Math.round(shareOf(n) * 360)),
	scale: round2(0.8 + 0.45 * shareOf(n + 0.5)),
	...more,
});

const palmRing = (id: string, centre: TVec2, radius: number, count: number, turn = 0) =>
	Array.from({ length: count }, (_, i): TEntityInput => {
		const angle = ((turn + (i * 360) / count) * Math.PI) / 180;
		return tree(
			`${id}_${i + 1}`,
			"palm_tree_01",
			[centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)],
			i + centre[0],
		);
	});

/** A grove: trees in rings, a palm now and then, the middle open. */
const grove = (id: string, centre: TVec2, radius: number) =>
	[radius - 1.2, radius - 3.6, radius - 6].flatMap((r, ring) => {
		const count = Math.max(3, Math.floor((2 * Math.PI * r) / 2.4));
		return Array.from({ length: count }, (_, i): TEntityInput => {
			const angle = (((i + ring * 0.5) / count) * 2 + ring * 0.13) * Math.PI;
			const n = centre[0] * 3 + ring * 31 + i;
			const kind =
				shareOf(n) < 0.3
					? "palm_tree_01"
					: shareOf(n + 1) < 0.5
						? "round_tree_01"
						: "round_tree_02";
			return tree(
				`${id}_${ring + 1}_${i + 1}`,
				kind,
				[centre[0] + r * Math.cos(angle), centre[1] + r * Math.sin(angle)],
				n,
			);
		});
	});

const gardenTrees: TEntityInput[] = [
	...QUADRANTS.flatMap((quadrant) =>
		palmRing(`island_${quadrant}_palm`, cloverIslandCentre(quadrant), ISLAND_RADIUS - 0.7, 7, 10),
	),
	...[0, 1, 2, 3].flatMap((k) =>
		grove(`stack_island_${k + 1}_tree`, stackIslandCentre(k), STACK_ISLAND_RADIUS),
	),
];

// ---------------------------------------------------------------- the city round it

/** The cloverleaf and the stack's islands and middle, kept for their gardens and shade. */
const square = (centre: TVec2, halfU: number, halfV: number): TVec2[] => [
	[centre[0] - halfU, centre[1] - halfV],
	[centre[0] + halfU, centre[1] - halfV],
	[centre[0] + halfU, centre[1] + halfV],
	[centre[0] - halfU, centre[1] + halfV],
];
KEPT.push(
	square(CLOVER, 36, 40),
	square(STACK, 22, 22),
	...[0, 1, 2, 3].map((k) => disc(stackIslandCentre(k), STACK_ISLAND_RADIUS + 1.5, 3)),
);

interface IDistrict {
	id: string;
	name: string;
	from: TVec2;
	to: TVec2;
	/** A lot's size, and the street between lots. */
	lot: number;
	street: number;
}

const ROOFS = ["#c0693f", "#b55a3a", "#8d877e", "#a88b66", "#c98a55", "#9a5b44", "#c27a4a"];
const WALLS = ["#efe3c8", "#e8d2b0", "#f3ede1", "#e9c9b0", "#dcd3bf", "#f0dcae"];
const SHOP_WALLS = ["#e6d3ad", "#d9b98c", "#f1e6cf", "#c9a27a", "#e8c79a"];
const GLASS = ["#5f7a8c", "#6d8796", "#7c8f95", "#4f6a7a", "#8aa0a8", "#9aa7a0"];

/** The valley's districts, round the freeways; downtown north-east of the cloverleaf. */
const DISTRICTS: IDistrict[] = [
	{ id: "northgate", name: "Northgate", from: [-96, -64], to: [-40, -10], lot: 6.5, street: 1.4 },
	{ id: "ridgeview", name: "Ridgeview", from: [-28, -68], to: [26, -10], lot: 6.5, street: 1.4 },
	{ id: "westside", name: "Westside", from: [-96, -2], to: [-40, 54], lot: 6.5, street: 1.4 },
	{ id: "riverbend", name: "Riverbend", from: [-28, -2], to: [26, 48], lot: 6.5, street: 1.4 },
	{ id: "harbor", name: "Downtown", from: [26, -84], to: [104, -48], lot: 7, street: 2.6 },
	{ id: "eastside", name: "Eastside", from: [26, 34], to: [104, 48], lot: 7, street: 2.4 },
	{
		id: "boulevard_east",
		name: "Boulevard East",
		from: [98, -48],
		to: [104, 34],
		lot: 6,
		street: 2.4,
	},
];

const isDowntown = (district: IDistrict) => district.id === "harbor";
const DOWNTOWN_MIDDLE: TVec2 = [82, -70];

/** Every lot that's clear, in each district, on its grid. */
const cityLots = DISTRICTS.flatMap((district) => {
	const pitch = district.lot + district.street;
	const lots: { district: IDistrict; centre: TVec2 }[] = [];
	for (
		let x = district.from[0] + district.lot / 2;
		x <= district.to[0] - district.lot / 2 + 1e-6;
		x += pitch
	) {
		for (
			let z = district.from[1] + district.lot / 2;
			z <= district.to[1] - district.lot / 2 + 1e-6;
			z += pitch
		) {
			const centre: TVec2 = [round2(x), round2(z)];
			if (isBuildable(centre, district.lot)) {
				lots.push({ district, centre });
			}
		}
	}
	return lots;
});

/** What stands on a lot: towers downtown, now and then a strip of shops on a car park, else houses. */
const lotKindOf = (district: IDistrict, n: number) =>
	isDowntown(district) ? "towers" : shareOf(n + 11) < 0.12 ? "shops" : "houses";

/** A block of houses, as a village of them. */
const suburb = (id: string, name: string, centre: TVec2, n: number, lot: number): TEntityInput => ({
	id,
	kind: "house_cluster_01",
	name,
	position: centre,
	rotation: turned(Math.floor(shareOf(n) * 4) * 90),
	colors: paint({ roofs: pickOf(ROOFS, n + 1), walls: pickOf(WALLS, n + 2) }),
	props: {
		width: round2(lot),
		builtShare: 1,
		seed: 1 + Math.floor(shareOf(n + 4) * 900),
	},
});

/** A strip of shops along the back of its lot, facing its car park. */
const stripMall = (id: string, centre: TVec2, n: number, lot: number): TEntityInput[] =>
	Array.from({ length: 3 }, (_, i) => ({
		id: `${id}_shop_${i + 1}`,
		kind: "shop_02",
		position: [
			round2(centre[0] - lot / 2 + 1.35 + i * 2.65),
			round2(centre[1] - lot / 2 + 1.3),
		] as TVec2,
		colors: paint({ walls: pickOf(SHOP_WALLS, n + i) }),
		props: { width: 2.5, depth: 2.2, floorCount: 1 + Math.floor(shareOf(n + i) * 2) },
	}));

const cityBuildings: TEntityInput[] = cityLots.flatMap(({ district, centre }, n) => {
	const id = `${district.id}_${n + 1}`;
	const name = `${district.name} ${n + 1}`;
	const kind = lotKindOf(district, n);
	if (kind === "towers") {
		const near = Math.hypot(centre[0] - DOWNTOWN_MIDDLE[0], centre[1] - DOWNTOWN_MIDDLE[1]);
		const floors = Math.max(4, Math.round(30 - near * 0.55 - shareOf(n) * 8));
		const isTower = floors > 9;
		return [
			{
				id,
				kind: isTower ? "office_tower_01" : "apartment_block_01",
				name,
				position: centre,
				rotation: turned(Math.floor(shareOf(n + 9) * 2) * 90),
				colors: paint(
					isTower
						? { facade: pickOf(GLASS, n), grid: "#e9e4d8" }
						: { walls: pickOf(SHOP_WALLS, n) },
				),
				props: isTower
					? {
							width: round2(district.lot * (0.6 + 0.25 * shareOf(n + 2))),
							depth: round2(district.lot * (0.6 + 0.25 * shareOf(n + 3))),
							floorCount: Math.min(40, floors),
						}
					: { width: round2(district.lot * 0.9), depth: 3, floorCount: Math.min(16, floors) },
			},
		];
	}
	if (kind === "shops") {
		return stripMall(id, centre, n, district.lot);
	}
	return [suburb(id, name, centre, n, district.lot)];
});

/** The strips of shops' car parks. */
const carParks: TAreaInput[] = cityLots.flatMap(({ district, centre }, n) =>
	lotKindOf(district, n) === "shops"
		? [
				{
					id: `${district.id}_${n + 1}_car_park`,
					kind: "plaza_01",
					name: `${district.name} car park`,
					height: 0.01,
					colors: { surface: { color: "#a7a49c" } },
					points: square(centre, district.lot / 2, district.lot / 2),
				},
			]
		: [],
);

/** Whether a point is on a lot already built on. */
const onALot = ([x, z]: TVec2, margin: number) =>
	cityLots.some(
		({ district, centre }) =>
			Math.abs(x - centre[0]) < district.lot / 2 + margin &&
			Math.abs(z - centre[1]) < district.lot / 2 + margin,
	);

// ---------------------------------------------------------------- trees

/** Points over the ground on a jittered grid, the same each time. */
const jitteredGrid = (step: number, seed: number) => {
	const points: TVec2[] = [];
	let n = seed;
	for (let x = -HALF[0] + step / 2; x < HALF[0]; x += step) {
		for (let z = -HALF[1] + step / 2; z < HALF[1]; z += step) {
			n += 1;
			points.push([
				round2(x + (shareOf(n) - 0.5) * step * 0.8),
				round2(z + (shareOf(n + 0.3) - 0.5) * step * 0.8),
			]);
		}
	}
	return points;
};

const GARDEN_ZONES = [
	...[0, 1, 2, 3].map((k) => disc(stackIslandCentre(k), STACK_ISLAND_RADIUS + 1, 3)),
	...QUADRANTS.map((quadrant) => disc(cloverIslandCentre(quadrant), ISLAND_RADIUS + 1, 3)),
];

/** Is a point free for a tree: off the roads (and out from under them), lots, gardens, water and the rail. */
const isFreeForTree = (point: TVec2) =>
	Math.abs(point[0]) < HALF[0] - 1 &&
	Math.abs(point[1]) < HALF[1] - 1 &&
	clearOfRoads(point, 1.2) &&
	!onALot(point, 0.4) &&
	!GARDEN_ZONES.some((zone) => isInsidePolygon(point, zone)) &&
	!RIVER.some((river) => isInsidePolygon(point, river) || edgeDistance(point, river) < 1) &&
	!inRailCorridor(point, 2.5);

/** Along the freeways and ramps: clumps of trees on the verges, as the dry land round interchanges is planted. */
const vergeTrees: TEntityInput[] = jitteredGrid(3.2, 500)
	.filter(
		(point, i) =>
			hillAt(point) === 0 &&
			!clearOfRoads(point, 6) &&
			shareOf(i * 7) < 0.55 &&
			isFreeForTree(point),
	)
	.map((point, i) => {
		const n = i * 13 + 7;
		const kind =
			shareOf(n) < 0.35
				? "palm_tree_01"
				: shareOf(n + 1) < 0.45
					? "round_tree_01"
					: shareOf(n + 2) < 0.5
						? "round_tree_02"
						: "bush_01";
		return tree(`verge_tree_${i + 1}`, kind, point, n);
	});

/** On the hills: pines and scrub, standing on the slopes. */
const hillTrees: TEntityInput[] = jitteredGrid(4.2, 900)
	.filter((point, i) => hillAt(point) > 0.6 && shareOf(i * 5) < 0.6 && isFreeForTree(point))
	.map((point, i) => {
		const n = i * 11 + 3;
		const kind =
			shareOf(n) < 0.45 ? "pine_tree_01" : shareOf(n + 1) < 0.5 ? "pine_tree_02" : "bush_01";
		return tree(`hill_tree_${i + 1}`, kind, point, n, { altitude: hillAt(point) });
	});

/** Palms along the city's streets, at the corners of lots now and then. */
const streetPalms: TEntityInput[] = cityLots.flatMap(({ district, centre }, n) => {
	if (isDowntown(district) || shareOf(n * 3) > 0.5) {
		return [];
	}
	const at: TVec2 = [
		centre[0] + district.lot / 2 + district.street / 2,
		centre[1] - district.lot / 2 + 0.6,
	];
	return isFreeForTree(at) && hillAt(at) === 0
		? [tree(`street_palm_${n + 1}`, "palm_tree_01", at, n)]
		: [];
});

// ---------------------------------------------------------------- lamps, cards and vehicles to ride along

/** Lamps down the freeways' medians, where they run on the ground, every so far. */
const LAMP_SPACING = 9;

const medianLamps = (id: string, from: TVec2, to: TVec2): TEntityInput[] =>
	linePoints(from, to, LAMP_SPACING)
		.slice(1, -1)
		.filter((point) => clearOfRoads(point, 0.25))
		.map((point, i) => ({
			id: `${id}_${i + 1}`,
			kind: "street_lamp_01",
			position: [round2(point[0]), round2(point[1])],
			props: { height: 2 },
		}));

const lamps: TEntityInput[] = [
	...medianLamps("crosstown_lamp", [WEST_TUNNEL_X + 4, STACK[1]], [EAST_TUNNEL_X - 4, STACK[1]]),
	// Not where the Valley Freeway is raised, over the stack: nothing to stand on between its decks.
	...medianLamps("valley_lamp", [STACK[0], NORTH_TUNNEL_Z + 4], [STACK[0], 50]).filter(
		(lamp) => nsAltitude(lamp.position?.[1] ?? 0) < 0.2,
	),
];

/** A card over a freeway's median, following its row: vehicles an hour, speed, delay. */
const freewayCard = (id: string, rowId: string, at: TVec2): TEntityInput => ({
	id,
	kind: "street_lamp_01",
	name: `${TRAFFIC_ROWS[rowId].key} card`,
	position: at,
	props: { height: 2 },
	dataRow: { tableKey: "traffic", rowKey: TRAFFIC_ROWS[rowId].key },
	label: {
		title: TRAFFIC_ROWS[rowId].key,
		dataKeys: ["row.vehicles_per_hour", "row.average_speed", "row.delay_minutes"],
		offset: [0, 1.2, 0],
	},
	details: {
		description: `${EXAMPLE}. How full it is shows three ways: more vehicles, slower, and the road turning red.`,
		dataKeys: ["row.vehicles_per_hour", "row.average_speed", "row.delay_minutes", "row.congestion"],
	},
});

const freewayCards: TEntityInput[] = [
	freewayCard("card_nb", "nb", [STACK[0], STACK[1] + 36.5]),
	freewayCard("card_sb", "sb", [STACK[0], STACK[1] - 36.5]),
	freewayCard("card_eb", "eb", [STACK[0] - 36.5, STACK[1]]),
	freewayCard("card_wb", "wb", [STACK[0] + 36.5, STACK[1]]),
];

/** A few vehicles of their own, to select, follow and ride along with, driving on through the network. */
const rideAlongs: TEntityInput[] = [
	{
		id: "red_convertible",
		kind: "car_01",
		name: "Red convertible",
		position: [NB_X, 40],
		colors: paint({ body: "#c8102e" }),
		scale: 0.9,
		follow: { roadId: "nb_1", speed: 5.2, startDistance: 12 },
	},
	{
		id: "tanker",
		kind: "truck_01",
		name: "Tanker truck",
		position: [-80, EB_Z],
		colors: paint({ box: "#d9dcdf", cab: "#2f5d8a" }),
		scale: 0.9,
		follow: { roadId: "eb_1", speed: 4.4, startDistance: 6 },
	},
	{
		id: "airport_shuttle",
		kind: "bus_01",
		name: "Airport shuttle",
		position: [CLOVER[0], -60],
		colors: paint({ body: "#2f6f8f" }),
		scale: 0.9,
		follow: { roadId: "boulevard_5", speed: 3, startDistance: 8 },
	},
];

// ---------------------------------------------------------------- light, moods and views

const TILT_SHIFT: TTiltShiftInput = {
	enabled: true,
	blurStrength: 0.3,
	sharpBandHeight: 0.5,
	sharpBandPosition: 0.48,
};
const SKY: TSceneInput["sky"] = { starDensity: 0.6 };
const WEATHER: TSceneInput["weather"] = { cloudCover: 0.12 };
const WATER_LOOK: TSceneInput["water"] = { rippleStrength: 0.3, reflectionStrength: 0.6 };
const LIGHTING = { sunShadeContrast: 0.72 } satisfies TLightingInput;

/** The story's own light: the time of day follows the hour it shows. */
const A_DAY = {
	...LIGHTING,
	time: NOW_HOUR,
	timeSource: "data",
	data: { time: { key: "hour" } },
} satisfies TLightingInput;

const mood = (
	id: string,
	name: string,
	lighting: TLightingInput,
	more: Partial<TMoodInput> = {},
): TMoodInput => ({
	id,
	name,
	lighting: { ...LIGHTING, ...lighting },
	sky: SKY,
	water: WATER_LOOK,
	weather: WEATHER,
	tiltShift: TILT_SHIFT,
	...more,
});

const MOODS = [
	mood("mood_day", "A day on the interchange", A_DAY),
	mood(
		"mood_morning",
		"Morning rush",
		{ time: 7.8, timeSource: "fixed" },
		{ weather: { cloudCover: 0.2 } },
	),
	mood("mood_midday", "Midday", { time: 12.8, timeSource: "fixed" }),
	mood("mood_evening", "Evening rush", { time: 17.6, timeSource: "fixed" }),
	mood("mood_dusk", "Dusk", { time: 19.7, timeSource: "fixed" }),
	mood("mood_night", "Night", { time: 22.5, timeSource: "fixed" }),
];

const OVERVIEW = { target: [-6, -2] as TVec2, azimuth: 302, elevation: 36, span: 170 };

const VIEWPOINTS: TSceneInput["viewpoints"] = [
	{
		id: "view_interchange",
		name: "The Interchange",
		description:
			"Two freeways, a four-level stack and a cloverleaf. Play the story to watch a day of example traffic.",
		...OVERVIEW,
		projection: "perspective",
		moodId: "mood_day",
	},
	{
		id: "view_under_the_stack",
		name: "Under the stack",
		description: "The columns tower over the Crosstown Freeway, four levels overhead.",
		target: [STACK[0] - 4, STACK[1] + 6],
		targetAltitude: 3,
		azimuth: 228,
		elevation: 6,
		span: 26,
		projection: "perspective",
	},
	{
		id: "view_three_levels",
		name: "Over three levels",
		description: "A flyover sweeping round over both freeways and the flyovers below it.",
		target: [STACK[0] + 8, STACK[1] + 6],
		targetAltitude: 4,
		azimuth: 330,
		elevation: 18,
		span: 44,
		projection: "perspective",
	},
	{
		id: "view_cloverleaf",
		name: "The cloverleaf's islands",
		description: "Flower beds in pinwheels and palms inside the loops, onto Harbor Boulevard.",
		target: CLOVER,
		azimuth: 300,
		elevation: 52,
		span: 70,
		projection: "perspective",
	},
	{
		id: "view_merge",
		name: "A merge",
		description: "The flyover and the right turn come together, then join the eastbound freeway.",
		target: stackPlace(JOIN_AT + 4, RAMP_OFFSET - 1, 0),
		targetAltitude: 1,
		azimuth: 250,
		elevation: 24,
		span: 26,
		projection: "perspective",
	},
	{
		id: "view_bridge",
		name: "The river bridge",
		description: "The Valley Freeway crossing the river into the south hills.",
		target: [STACK[0], 62],
		targetAltitude: 2,
		azimuth: 195,
		elevation: 12,
		span: 44,
		projection: "perspective",
	},
	{
		id: "view_tunnel",
		name: "The tunnel portal",
		description: "The Valley Freeway runs into the ridge.",
		target: [STACK[0], NORTH_TUNNEL_Z + 2],
		targetAltitude: 2,
		azimuth: 285,
		elevation: 14,
		span: 30,
		projection: "perspective",
	},
	{
		id: "view_rail",
		name: "The rail viaduct",
		description: "The rail line crossing the valley on its own viaduct, over the freeways.",
		target: [railX(14), 14],
		targetAltitude: 5,
		azimuth: 20,
		elevation: 14,
		span: 50,
		projection: "perspective",
	},
	{
		id: "view_ride_along",
		name: "Along a flyover",
		description:
			"At the top of a flyover, the city below. Select a vehicle and follow it to ride along.",
		target: stackPlace(-6, 4, 1),
		targetAltitude: LEVEL_HIGH_FLYOVERS,
		azimuth: 160,
		elevation: 14,
		span: 16,
		projection: "perspective",
	},
	{
		id: "view_morning",
		name: "Morning rush",
		description:
			"Into town: the southbound and eastbound fill up first. Play the story from 07:00.",
		...OVERVIEW,
		azimuth: 280,
		projection: "perspective",
		moodId: "mood_morning",
	},
	{
		id: "view_evening",
		name: "Evening rush",
		description: "Out of town: the westbound and northbound queue in the low sun.",
		...OVERVIEW,
		azimuth: 320,
		projection: "perspective",
		moodId: "mood_evening",
	},
	{
		id: "view_night",
		name: "Night",
		description: "Lamps down the medians and the city's windows; the traffic thins out.",
		...OVERVIEW,
		elevation: 30,
		span: 140,
		projection: "perspective",
		moodId: "mood_night",
	},
];

// ---------------------------------------------------------------- everything that stands

/**
 * The objects, the buildings first: a tree that would stand in something before it in the list
 * is left out, so the gardens and verges fill in round what's built.
 */
const placedClear = (entities: TEntityInput[]): TEntityInput[] => {
	const parsed = entities.map((entity) => EntitySchema.parse(entity));
	const dropped = new Set<string>();
	for (const { a, b } of objectsInEachOther(parsed)) {
		if (dropped.has(a.id) || dropped.has(b.id)) {
			continue;
		}
		const later = parsed.indexOf(a) > parsed.indexOf(b) ? a : b;
		dropped.add(later.id);
	}
	return entities.filter((entity) => !dropped.has(entity.id));
};

const ENTITIES = placedClear([
	...freewayCards,
	...lamps,
	...rideAlongs,
	...cityBuildings,
	...gardenTrees,
	...streetPalms,
	...vergeTrees,
	...hillTrees,
]);

export const createInterchangeScene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: { title: "The Interchange", subtitle: "A day on the stack, with example counts" },
		theme: "system",
		surface: { enabled: true },
		ground: {
			width: GROUND[0],
			depth: GROUND[1],
			colors: { surface: { color: "#cdbb8a" } },
			surface: { kind: "grass_01" },
		},
		traffic: { drivingSide: "right" },
		lighting: A_DAY,
		sky: SKY,
		water: WATER_LOOK,
		weather: WEATHER,
		camera: {
			openingViewpointId: "view_interchange",
			lowestElevation: 4,
			tiltShift: TILT_SHIFT,
			tour: { enabled: false, holdSeconds: 7 },
		},
		moods: MOODS,
		viewpoints: VIEWPOINTS,
		onScreen: { tileKeys: ["total_vehicles", "worst_delay"] },
		data: DATA,
		areas: [...AREAS, ...GARDENS, ...carParks],
		roads: ROADS,
		junctions: JUNCTIONS,
		entities: ENTITIES,
	} satisfies TSceneInput);
