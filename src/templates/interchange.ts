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
	climbLength,
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

const GROUND: TVec2 = [330, 240];
const HALF: TVec2 = [GROUND[0] / 2, GROUND[1] / 2];

/** The stack's middle, and the cloverleaf's, on the east–west freeway. */
const STACK: TVec2 = [-46, 0];
const CLOVER: TVec2 = [112, 0];

/** Each carriageway's centre line from its freeway's, and how wide it is (three lanes). */
const CARRIAGEWAY_OFFSET = 2.6;
const CARRIAGEWAY_WIDTH = 3.6;
/** A one-lane ramp. */
const RAMP_WIDTH = 1.8;

/**
 * The levels, a little over a truck's height apart: the Valley Freeway on a viaduct over the
 * Crosstown Freeway, and the flyovers on two levels over both.
 */
const LEVEL_FREEWAY = 1.9;
const LEVEL_LOW_FLYOVERS = 3.8;
const LEVEL_HIGH_FLYOVERS = 5.7;
/** How steeply ramps climb, as real ones do: 7.5 in 100. */
const GRADE = 0.075;

const ROAD_COLOR = "#8f8a82";
const DECK_COLOR = "#cfc6b4";

const round2 = (value: number) => Math.round(value * 100) / 100 + 0;

// ---------------------------------------------------------------- the stack, in its frame

/*
 * In the stack's frame the northbound carriageway runs up u = 2.6 (towards −v). Everything that
 * leaves it is laid here once: its exit peels off at grade along a long taper, then splits; the
 * left-turn flyover climbs at 7%, sweeps round over the middle and comes down beside the
 * westbound; the right turn curves off the other way. Turned a quarter at a time, the same
 * shapes serve the other three carriageways. The flyovers from the Valley Freeway (on its
 * viaduct) go on to the higher level and come down to the Crosstown Freeway on the ground, so
 * they come down far; those from the Crosstown climb to the lower level and come down onto the
 * viaduct, so they land soon.
 */

/** Where the ramps run, from the freeway's centre line. */
const RAMP_OFFSET = 6;
/** The flyovers' radius. */
const FLYOVER_RADIUS = 34;
const FLYOVER_CENTRE: TVec2 = [RAMP_OFFSET - FLYOVER_RADIUS, FLYOVER_RADIUS - RAMP_OFFSET];
/** How far from the middle the exit leaves its carriageway, and where it splits left and right. */
const EXIT_AT = 84;
const SPLIT_AT = 66;

/** A flyover's way: from the split, up to its arc, round over the middle, down beside the carriageway. */
const flyoverPath = (joinAt: number) =>
	joinPath(
		linePoints([RAMP_OFFSET, SPLIT_AT], [RAMP_OFFSET, FLYOVER_CENTRE[1]]),
		arcPoints(FLYOVER_CENTRE, FLYOVER_RADIUS, 0, -90),
		linePoints([FLYOVER_CENTRE[0], -RAMP_OFFSET], [-joinAt, -RAMP_OFFSET]),
	);

/** How far along a flyover a point of its arc is, by its angle round the arc in degrees. */
const alongArc = (degrees: number) =>
	SPLIT_AT - FLYOVER_CENTRE[1] + (FLYOVER_RADIUS * degrees * Math.PI) / 180;
/** Where the flyovers cross each other over the middle: each is at its level from before the first. */
const OVER_THE_MIDDLE = alongArc(34);

interface IFlyoverKind {
	/** Its level, and the altitude it climbs from and comes down to. */
	level: number;
	from: number;
	to: number;
	/** How far along it stays at its level: past the flyovers below, or past the viaduct it lands on. */
	holdsUntil: number;
	/** Where it meets the right turn, and where the two join the carriageway, from the middle. */
	joinAt: number;
	entryAt: number;
}

const flyoverKind = (level: number, from: number, to: number, holdsUntil: number): IFlyoverKind => {
	// Down at the ramps' grade, then level to where the right turn meets it.
	const landsAt = holdsUntil + climbLength(level - to, GRADE);
	const joinAt = Math.ceil(-FLYOVER_CENTRE[0] + landsAt - alongArc(90) + 2);
	return { level, from, to, holdsUntil, joinAt, entryAt: joinAt + 16 };
};

/**
 * From the Valley Freeway's viaduct to the high level, over the low flyovers, down to the
 * Crosstown Freeway on the ground; and from the Crosstown to the low level, over the viaduct
 * and down onto it.
 */
const HIGH_FLYOVER = flyoverKind(LEVEL_HIGH_FLYOVERS, LEVEL_FREEWAY, 0, alongArc(58));
const LOW_FLYOVER = flyoverKind(LEVEL_LOW_FLYOVERS, 0, LEVEL_FREEWAY, alongArc(72));

/** Flyovers that cross each other stand on different levels: from the Valley Freeway high, from the Crosstown low. */
const flyoverOf = (quarters: number) => (quarters % 2 === 0 ? HIGH_FLYOVER : LOW_FLYOVER);

const flyoverPoints = (kind: IFlyoverKind) => {
	const path = flyoverPath(kind.joinAt);
	return withAltitudes(path, [
		[0, kind.from],
		[5, kind.from],
		[OVER_THE_MIDDLE - 3, kind.level],
		[kind.holdsUntil, kind.level],
		[kind.holdsUntil + climbLength(kind.level - kind.to, GRADE), kind.to],
		[AT_END, kind.to],
	]);
};

/** The exit: alongside the carriageway, flush, peeling away along a long shallow taper to the split. */
const EXIT_PATH = joinPath(
	[[CARRIAGEWAY_OFFSET, EXIT_AT]],
	[[CARRIAGEWAY_OFFSET + 0.9, EXIT_AT - 7]],
	[[RAMP_OFFSET - 0.6, EXIT_AT - 14]],
	linePoints([RAMP_OFFSET, SPLIT_AT + 2], [RAMP_OFFSET, SPLIT_AT]),
);

/** The right turn: off the split at a shallow angle, round, and along beside the flyover coming down the other way. */
const RIGHT_TURN_RADIUS = 18;
const RIGHT_TURN_CENTRE: TVec2 = [9 + RIGHT_TURN_RADIUS, 10 + RIGHT_TURN_RADIUS];
const rightTurnPath = (joinAt: number) =>
	joinPath(
		[[RAMP_OFFSET, SPLIT_AT]],
		[[7.4, SPLIT_AT - 7]],
		linePoints([9, SPLIT_AT - 14], [9, RIGHT_TURN_CENTRE[1]], 4),
		arcPoints(RIGHT_TURN_CENTRE, RIGHT_TURN_RADIUS, 180, 270),
		RIGHT_TURN_CENTRE[0] < joinAt - 12
			? linePoints([RIGHT_TURN_CENTRE[0] + 4, 10], [joinAt - 9, 10], 4)
			: [],
		[[joinAt - 4.5, RAMP_OFFSET + 1.3]],
		[[joinAt, RAMP_OFFSET]],
	);

/** Where a flyover and a right turn have come together, then join the carriageway along a taper. */
const entryPath = (kind: IFlyoverKind) =>
	joinPath(
		[[kind.joinAt, RAMP_OFFSET]],
		[[kind.joinAt + 4, RAMP_OFFSET]],
		[[kind.entryAt - 7, CARRIAGEWAY_OFFSET + 0.9]],
		[[kind.entryAt, CARRIAGEWAY_OFFSET]],
	);

/** The exit's altitude is its carriageway's: on the viaduct for the Valley Freeway, else on the ground. */
const baseOf = (quarters: number) => (quarters % 2 === 0 ? LEVEL_FREEWAY : 0);

const exitPoints = (quarters: number) =>
	withAltitudes(EXIT_PATH, [
		[0, baseOf(quarters)],
		[AT_END, baseOf(quarters)],
	]);

/**
 * The right turn laid in a quarter's frame goes from its carriageway's altitude to where it meets
 * the flyover from two quarters on, which has come down to the next carriageway's altitude.
 */
const rightTurnPoints = (quarters: number) => {
	const kind = flyoverOf(quarters + 2);
	const path = rightTurnPath(kind.joinAt);
	const from = baseOf(quarters);
	const to = kind.to;
	const length = pathLength(path);
	return withAltitudes(
		path,
		from > to
			? [
					[0, from],
					[5, from],
					[climbLength(from - to, GRADE) + 9, to],
					[AT_END, to],
				]
			: [
					[0, from],
					[length - climbLength(to - from, GRADE) - 4, from],
					[AT_END, to],
				],
	);
};

const entryPoints = (quarters: number) => {
	const kind = flyoverOf(quarters + 2);
	return withAltitudes(entryPath(kind), [
		[0, kind.to],
		[AT_END, kind.to],
	]);
};

/** A path in the stack's frame, turned a quarter `quarters` times and placed in the world. */
const placed = (points: readonly TPathPoint[], quarters: number): [number, number, number][] =>
	points.map(([u, v, altitude]) => {
		const [x, z] = quarterTurned([u, v], quarters);
		return [round2(STACK[0] + x), round2(STACK[1] + z), altitude];
	});

/** The carriageways as the stack's frame turns them: 0 northbound, 1 westbound, 2 southbound, 3 eastbound. */
const CARRIAGEWAYS = ["nb", "wb", "sb", "eb"] as const;
const CARRIAGEWAY_NAMES = ["northbound", "westbound", "southbound", "eastbound"];

/** One-way ramps on pillars, a smooth curve through their points. */
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
	isOneWay: true,
	curveShape: "throughPoints",
	showsCentreLine: false,
	heldUpBy: "pillars",
	pillarSpacing: 7,
	pillarKind: "column_01",
	pillarsKeepClear: true,
	colors: { surface: { color: ROAD_COLOR }, embankment: { color: DECK_COLOR } },
	...more,
});

const stackRamps: TRoadInput[] = [0, 1, 2, 3].flatMap((k) => {
	const from = CARRIAGEWAYS[k];
	const left = CARRIAGEWAYS[(k + 1) % 4];
	const right = CARRIAGEWAYS[(k + 3) % 4];
	return [
		ramp(`${from}_exit`, `Exit from the ${CARRIAGEWAY_NAMES[k]}`, placed(exitPoints(k), k)),
		ramp(
			`${from}_to_${left}`,
			`Flyover, ${CARRIAGEWAY_NAMES[k]} to ${CARRIAGEWAY_NAMES[(k + 1) % 4]}`,
			placed(flyoverPoints(flyoverOf(k)), k),
			{ pillarSpacing: 8 },
		),
		ramp(
			`${from}_to_${right}`,
			`Right turn, ${CARRIAGEWAY_NAMES[k]} to ${CARRIAGEWAY_NAMES[(k + 3) % 4]}`,
			placed(rightTurnPoints(k), k),
		),
		// The entry laid in this frame is the one onto the carriageway this one turns right into,
		// where its right turn and the flyover from two quarters on come together.
		ramp(
			`${right}_entry`,
			`Entry to the ${CARRIAGEWAY_NAMES[(k + 3) % 4]}`,
			placed(entryPoints(k), k),
		),
	];
});

// ---------------------------------------------------------------- the freeways

const RIVER_Z: [number, number] = [86, 106];

/** Where the hills' tunnels take the freeways: the ridge to the north, the hills west, east and south. */
const NORTH_TUNNEL_Z = -90;
const SOUTH_TUNNEL_Z = 112;
const WEST_TUNNEL_X = -156;
const EAST_TUNNEL_X = 158;

/** Points along straight lines between corners, every few units, each at an altitude. */
const linePath = (points: TVec2[], altitude: (point: TVec2) => number) => {
	const dense = joinPath(...points.slice(1).map((point, i) => linePoints(points[i], point, 9)));
	return dense.map(([x, z]): TPathPoint => [round2(x), round2(z), altitude([x, z])]);
};

const NB_X = STACK[0] + CARRIAGEWAY_OFFSET;
const SB_X = STACK[0] - CARRIAGEWAY_OFFSET;
const EB_Z = STACK[1] + CARRIAGEWAY_OFFSET;
const WB_Z = STACK[1] - CARRIAGEWAY_OFFSET;

/**
 * How far inside the hills each freeway turns round, out of sight: one carriageway turns into
 * the other there, so no one-way road leads nowhere.
 */
const TURN_DEPTH = 6;
const NORTH_TURN = NORTH_TUNNEL_Z - TURN_DEPTH;
const SOUTH_TURN = SOUTH_TUNNEL_Z + TURN_DEPTH - 2;
const WEST_TURN = WEST_TUNNEL_X - 3;
const EAST_TURN = EAST_TUNNEL_X + 2.5;

/** The Valley Freeway runs on its viaduct the whole way: over the stack, the river, into the hills. */
const nsAltitude = () => LEVEL_FREEWAY;

/** The Valley Freeway northbound: from the south hills over the river, through the stack, into the ridge. */
const NB_PATH = linePath(
	[
		[STACK[0], SOUTH_TURN + CARRIAGEWAY_OFFSET],
		[NB_X, SOUTH_TURN],
		[NB_X, NORTH_TURN],
		[STACK[0], NORTH_TURN - CARRIAGEWAY_OFFSET],
	],
	nsAltitude,
);
const SB_PATH = linePath(
	[
		[STACK[0], NORTH_TURN - CARRIAGEWAY_OFFSET],
		[SB_X, NORTH_TURN],
		[SB_X, SOUTH_TURN],
		[STACK[0], SOUTH_TURN + CARRIAGEWAY_OFFSET],
	],
	nsAltitude,
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
const LOOP_GORE = 7;
const OUTER_GORE = 40;

/** Where the exit leaves a carriageway, and where the entry from the quarter before joins it. */
const stackExit = (quarters: number) => stackPlace(CARRIAGEWAY_OFFSET, EXIT_AT, quarters);
const stackEntry = (quarters: number) =>
	stackPlace(CARRIAGEWAY_OFFSET, -flyoverOf(quarters + 3).entryAt, quarters);

const CARRIAGEWAY_CUTS: Record<(typeof CARRIAGEWAYS)[number], TVec2[]> = {
	nb: [stackExit(0), stackEntry(0)],
	wb: [
		cloverPlace(OUTER_GORE, -CARRIAGEWAY_OFFSET),
		cloverPlace(LOOP_GORE, -CARRIAGEWAY_OFFSET),
		cloverPlace(-LOOP_GORE, -CARRIAGEWAY_OFFSET),
		cloverPlace(-OUTER_GORE, -CARRIAGEWAY_OFFSET),
		stackExit(1),
		stackEntry(1),
	],
	sb: [stackExit(2), stackEntry(2)],
	eb: [
		stackExit(3),
		stackEntry(3),
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
			isOneWay: true,
			curveShape: "throughPoints",
			showsCentreLine: false,
			heldUpBy: "pillars",
			pillarSpacing: 7,
			pillarKind: "hammerhead_01",
			pillarsKeepClear: true,
			colors: { surface: { color: ROAD_COLOR }, embankment: { color: DECK_COLOR } },
		}),
	),
);

// ---------------------------------------------------------------- the cloverleaf and the boulevard

/** The boulevard: two lanes each way, over the freeway on a bridge, from the hills to the river. */
const BOULEVARD_WIDTH = 4.8;
const BOULEVARD_LEVEL = LEVEL_FREEWAY;
/** Level over the freeway this far either side of it, then down at the ramps' grade. */
const BOULEVARD_DECK = 6;
const BOULEVARD_GRADE = 0.065;
const LOOP_JOIN = 17;
const OUTER_JOIN = 42;
const RIVERSIDE_Z = 80;
const BOULEVARD_NORTH = -HALF[1];

const BOULEVARD_PATH = withAltitudes(
	linePoints([CLOVER[0], RIVERSIDE_Z], [CLOVER[0], BOULEVARD_NORTH]),
	[
		[0, 0],
		[RIVERSIDE_Z - CLOVER[1] - BOULEVARD_DECK - climbLength(BOULEVARD_LEVEL, BOULEVARD_GRADE), 0],
		[RIVERSIDE_Z - CLOVER[1] - BOULEVARD_DECK, BOULEVARD_LEVEL],
		[RIVERSIDE_Z - CLOVER[1] + BOULEVARD_DECK, BOULEVARD_LEVEL],
		[RIVERSIDE_Z - CLOVER[1] + BOULEVARD_DECK + climbLength(BOULEVARD_LEVEL, BOULEVARD_GRADE), 0],
		[AT_END, 0],
	],
);
const BOULEVARD_PIECES = cutPathAt(BOULEVARD_PATH, [
	cloverPlace(0, OUTER_JOIN),
	cloverPlace(0, LOOP_JOIN),
	cloverPlace(0, -LOOP_JOIN),
	cloverPlace(0, -OUTER_JOIN),
]);
/** How high the boulevard is where the loops meet it: they climb to it along the loop. */
const loopJoinLevel = (v: number) =>
	BOULEVARD_PIECES.flat().find(
		([x, z]) => x === CLOVER[0] && Math.abs(z - (CLOVER[1] + v)) < 1e-6,
	)?.[2] ?? 0;

/** The south-east loop, eastbound to the boulevard northbound, in the cloverleaf's frame (u east, v south). */
const LOOP_RADIUS = 8.5;
const LOOP_CENTRE: TVec2 = [14.5, 19];
const loopPath = (joinLevel: number) =>
	withAltitudes(
		joinPath(
			[[LOOP_GORE, CARRIAGEWAY_OFFSET]],
			[[LOOP_GORE + 5, CARRIAGEWAY_OFFSET + 0.9]],
			arcPoints(LOOP_CENTRE, LOOP_RADIUS, -112, 168, 2.5),
			[[2.6, LOOP_JOIN + 1.6]],
			[[0, LOOP_JOIN]],
		),
		[
			[0, 0],
			[10, 0],
			[AT_END, joinLevel],
		],
	);
/** The south-east outer ramp, boulevard northbound to eastbound, round outside the loop. */
const OUTER_PATH = withAltitudes(
	joinPath(
		[[0, OUTER_JOIN]],
		[[5, OUTER_JOIN + 1.2]],
		arcPoints([15, 21], 17.5, 95, 0, 2.5).slice(1),
		linePoints([32.5, 17], [32.5, 11], 3),
		[[35, CARRIAGEWAY_OFFSET + 3]],
		[[OUTER_GORE, CARRIAGEWAY_OFFSET]],
	),
	[[0, 0]],
);

type TQuadrant = "se" | "sw" | "nw" | "ne";

/** A path of the south-east quadrant as another quadrant has it: mirrored, and driven the other way where it's mirrored once. */
const inQuadrant = <P extends readonly number[]>(path: readonly P[], quadrant: TQuadrant) => {
	const flip: Record<TQuadrant, [number, number]> = {
		se: [1, 1],
		sw: [-1, 1],
		nw: [-1, -1],
		ne: [1, -1],
	};
	const [fu, fv] = flip[quadrant];
	const moved = path.map(([u, v, ...rest]) => [
		round2(CLOVER[0] + u * fu),
		round2(CLOVER[1] + v * fv),
		...rest,
	]) as unknown as P[];
	return fu * fv < 0 ? moved.reverse() : moved;
};

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
		inQuadrant(
			loopPath(loopJoinLevel(quadrant.startsWith("s") ? LOOP_JOIN : -LOOP_JOIN)),
			quadrant,
		),
		{
			width: 1.6,
		},
	),
	ramp(`outer_${quadrant}`, QUADRANT_NAMES[quadrant].outer, inQuadrant(OUTER_PATH, quadrant), {
		width: 1.6,
	}),
]);

const boulevard: TRoadInput[] = BOULEVARD_PIECES.map((points, i) => ({
	id: `boulevard_${i + 1}`,
	name: `Harbor Boulevard (${i + 1})`,
	kind: "road_01",
	points,
	width: BOULEVARD_WIDTH,
	cornerRadius: 3,
	heldUpBy: "pillars",
	pillarSpacing: 5,
	pillarKind: "wall_01",
	pillarsKeepClear: true,
	colors: { surface: { color: ROAD_COLOR }, embankment: { color: DECK_COLOR } },
}));

// ---------------------------------------------------------------- junctions

/** A road end at a junction, and the ends vehicles arriving by it may leave by (all the rules allow, if none). */
type TEndRef = readonly [string, "start" | "end", (readonly [string, "start" | "end"])[]?];
const junction = (id: string, ends: TEndRef[]) => ({
	id,
	// Raised junctions stand on pillars of their own, as the editor makes them.
	standsOnPillars: true,
	ends: ends.map(([roadId, end, leadsTo]) => ({
		roadId,
		end,
		leadsTo: leadsTo ? leadsTo.map(([to, toEnd]) => ({ roadId: to, end: toEnd })) : null,
	})),
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
	// On the boulevard, each ramp is for one turn: traffic going the other way carries on past it,
	// and what comes off the freeway turns the way its ramp is for.
	junction("boulevard_outer_south", [
		["boulevard_1", "end"],
		["boulevard_2", "start", [["boulevard_1", "end"]]],
		["outer_se", "start"],
		["outer_sw", "end", [["boulevard_1", "end"]]],
	]),
	junction("boulevard_loop_south", [
		["boulevard_2", "end", [["boulevard_3", "start"]]],
		["boulevard_3", "start"],
		["loop_se", "end", [["boulevard_3", "start"]]],
		["loop_sw", "start"],
	]),
	junction("boulevard_loop_north", [
		["boulevard_3", "end"],
		["boulevard_4", "start", [["boulevard_3", "end"]]],
		["loop_nw", "end", [["boulevard_3", "end"]]],
		["loop_ne", "start"],
	]),
	junction("boulevard_outer_north", [
		["boulevard_4", "end", [["boulevard_5", "start"]]],
		["boulevard_5", "start"],
		["outer_nw", "start"],
		["outer_ne", "end", [["boulevard_5", "start"]]],
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

/** Along the river's north bank, from the Valley Freeway's viaduct to the east hill, meeting the boulevard. */
const RIVERSIDE_WEST = -32;
const RIVERSIDE_EAST = 150;

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
				[RIVERSIDE_WEST, RIVERSIDE_Z - 1.5],
				[40, RIVERSIDE_Z - 0.5],
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
				[136, RIVERSIDE_Z - 1],
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
const HILL_COLOR = "#999263";

/**
 * The rail line's way across, kept clear for a viaduct high over everything (ADR-0148's rail,
 * still to come): from the ridge's north-west corner, straight over the middle of the stack,
 * across the river to the south hills. Palms line it meanwhile.
 */
const railX = (z: number) => STACK[0] + z - STACK[1];
const RAIL_NORTH_Z = -94;
const RAIL_SOUTH_Z = 113;

/** A cliff for a tunnel: two corners at full height either side of where the road goes in. */
const portal = (at: TVec2, along: TVec2, half: number): [[number, number], [number, number]] => [
	[round2(at[0] - along[0] * half), round2(at[1] - along[1] * half)],
	[round2(at[0] + along[0] * half), round2(at[1] + along[1] * half)],
];

/** Gentle rises and dips over a hill, the same each time, so its slopes aren't flat planes. */
const rollingOver = (
	from: TVec2,
	to: TVec2,
	count: number,
	seed: number,
): [number, number, number][] =>
	Array.from({ length: count }, (_, i): [number, number, number] => {
		const r = (n: number) => {
			const x = Math.sin((seed + i) * 12.9898 + n * 78.233) * 43758.5453;
			return x - Math.floor(x);
		};
		return [
			round2(from[0] + (to[0] - from[0]) * r(1)),
			round2(from[1] + (to[1] - from[1]) * r(2)),
			round2(-1.5 + 3.5 * r(3)),
		];
	});

const AREAS: TAreaInput[] = [
	{
		id: "ridge",
		kind: "raised_land_01",
		name: "The ridge",
		height: HILL_HEIGHT,
		colors: { surface: { color: HILL_COLOR } },
		points: [
			[-HALF[0], -HALF[1]],
			[48, -HALF[1]],
			[40, -100, DOWN],
			[10, -96, DOWN],
			[-20, -94, -6],
			...portal([STACK[0], NORTH_TUNNEL_Z], [-1, 0], 9),
			[-70, -93, -6],
			[-100, -96, DOWN],
			[-118, -97, -4],
			[-148, -84, DOWN],
			[-152, -40, DOWN],
			...portal([WEST_TUNNEL_X, STACK[1]], [0, 1], 9),
			[-153, 30, DOWN],
			[-151, 74, DOWN],
			[-HALF[0], 80],
		],
		peaks: [
			[-120, -106, 4],
			[-60, -105, 3],
			[-10, -106, 2],
			[-160, -50, 3],
			[-161, 40, 2],
			...rollingOver([-150, -118], [40, -102], 18, 1),
			...rollingOver([-164, -80], [-157, 70], 8, 40),
		],
	},
	{
		id: "east_hill",
		kind: "raised_land_01",
		name: "The east hill",
		height: HILL_HEIGHT,
		colors: { surface: { color: HILL_COLOR } },
		points: [
			[HALF[0], -70],
			[160, -66, DOWN],
			[156, -30, DOWN],
			...portal([EAST_TUNNEL_X, STACK[1]], [0, 1], 9),
			[156, 30, DOWN],
			[159, 72, DOWN],
			[HALF[0], 76],
		],
		peaks: [[163, -20, 2], ...rollingOver([160, -64], [164, 70], 6, 80)],
	},
	{
		id: "south_hills",
		kind: "raised_land_01",
		name: "The south hills",
		height: HILL_HEIGHT,
		colors: { surface: { color: HILL_COLOR } },
		points: [
			[-HALF[0], 109, DOWN],
			[-80, 109, DOWN],
			[-62, 110, -5],
			...portal([STACK[0], SOUTH_TUNNEL_Z], [1, 0], 9),
			[-20, 110, -6],
			[20, 109, DOWN],
			[100, 109, DOWN],
			[HALF[0], 108, DOWN],
			[HALF[0], HALF[1]],
			[-HALF[0], HALF[1]],
		],
		peaks: [
			[-120, 116, 2],
			[0, 117, 3],
			[110, 116, 2],
			...rollingOver([-160, 112], [160, 119], 14, 120),
		],
	},
	{
		id: "river",
		kind: "water_01",
		name: "The river",
		points: [
			[-HALF[0], RIVER_Z[0] + 2],
			[-100, RIVER_Z[0] + 1],
			[-40, RIVER_Z[0]],
			[20, RIVER_Z[0] + 1],
			[90, RIVER_Z[0]],
			[HALF[0], RIVER_Z[0] - 1],
			[HALF[0], RIVER_Z[1] - 1],
			[90, RIVER_Z[1]],
			[20, RIVER_Z[1] + 1],
			[-40, RIVER_Z[1]],
			[-100, RIVER_Z[1] + 1],
			[-HALF[0], RIVER_Z[1] + 1],
		],
	},
];

// ---------------------------------------------------------------- a day of traffic, as example data

const EXAMPLE = "Example numbers shaped like real counts, not live data";

/**
 * The day the story plays, an hour a step: from yesterday evening at 18:00, through the night's
 * last hours and today's morning rush and midday lull, up to now, 17:00, the evening rush. Now
 * is its last step, so a tile's change is against the hour before, never against a later one.
 */
const NOW_HOUR = 17;
const STORY_HOURS = [
	18,
	19,
	20,
	21,
	22,
	23,
	...Array.from({ length: NOW_HOUR - 4 }, (_, i) => 5 + i),
];
const hourAt = (hour: number) =>
	`${hour > NOW_HOUR ? "2026-06-09" : "2026-06-10"}T${String(hour).padStart(2, "0")}:00`;

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
		0.88 * morning * bell(hour, 8, 1.15) +
		0.88 * evening * bell(hour, 17.4, 1.3)
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

/** A hint of warmth on roads past 80% full; how full shows mostly by how many vehicles, how slow, and the cards. */
const CONGESTED = "#9a8077";

/** How many vehicles per 10 units each way at its fullest: three lanes of queue on a carriageway. */
const densityAtFullest = (rowId: string) =>
	["nb", "sb", "eb", "wb"].includes(rowId) ? 3.6 : rowId === "boulevard" ? 2.6 : 2;

/**
 * The roads whose flows send traffic onto the network, and with what: the long run of each
 * carriageway through the stack, each flyover and right turn, two loops, the boulevard's ends
 * and the riverside. Their vehicles drive on everywhere, so every road is busy; a flow on every
 * one of the 51 roads would draw each road's vehicles on their own, for no more traffic.
 */
const FLOW_VEHICLES: Record<string, string> = {
	nb_2: "car_01",
	sb_2: "car_01",
	eb_2: "car_01",
	wb_6: "car_01",
	nb_to_wb: "car_01",
	wb_to_sb: "car_01",
	sb_to_eb: "delivery_van_01",
	eb_to_nb: "car_01",
	nb_to_eb: "car_01",
	wb_to_nb: "delivery_van_01",
	sb_to_wb: "truck_01",
	eb_to_sb: "car_01",
	loop_se: "car_01",
	loop_nw: "car_01",
	boulevard_1: "car_01",
	boulevard_5: "bus_01",
	riverside_west: "car_01",
};

/** A road with its traffic: a flow that drives on through the network, its amount and colour from its row. */
const withTraffic = (road: TRoadInput): TRoadInput => {
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
			enabled: road.id in FLOW_VEHICLES,
			vehicleKind: FLOW_VEHICLES[road.id] ?? "car_01",
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
						valueAtLowColor: 0.8,
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
const LAWN = "#8fa458";
const MEADOW = "#b9a96a";
/** Muted beds: dusty rose, olive, ochre and lavender, each beside the lawn's green. */
const BED_COLORS = ["#a07a70", "#7e8a58", "#b39a62", "#8c8098"];

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
		...pinwheel(`island_${quadrant}_bed`, centre, ISLAND_RADIUS - 2.8, 4, q % 2 === 0 ? 80 : -80, [
			BED_COLORS[q % 4],
			GRASS,
			BED_COLORS[(q + 2) % 4],
			GRASS,
		]),
	];
});

/** In the stack, the round lawns inside its right turns, each a grove of trees. */
const STACK_ISLAND_RADIUS = RIGHT_TURN_RADIUS - 1.5;
const stackIslandCentre = (k: number): TVec2 => stackPlace(...RIGHT_TURN_CENTRE, k);

/** A rounded, uneven outline, as planting is laid: a disc whose edge swells and dips. */
const blob = (centre: TVec2, radius: number, seed: number): TVec2[] =>
	Array.from({ length: 36 }, (_, i): TVec2 => {
		const angle = (i / 36) * 2 * Math.PI;
		const r =
			radius * (1 + 0.07 * Math.sin(3 * angle + seed) + 0.045 * Math.sin(5 * angle + seed * 2.3));
		return [round2(centre[0] + r * Math.cos(angle)), round2(centre[1] + r * Math.sin(angle))];
	});

const stackGardens: TAreaInput[] = [0, 1, 2, 3].flatMap((k) => [
	lawn(
		`stack_island_${k + 1}`,
		`Stack island ${k + 1}`,
		blob(stackIslandCentre(k), STACK_ISLAND_RADIUS - 1.6, k * 1.7),
		LAWN,
	),
	// A bed of dry meadow in its middle, round the grove's clearing.
	{
		...lawn(
			`stack_meadow_${k + 1}`,
			`Stack meadow ${k + 1}`,
			blob(stackIslandCentre(k), STACK_ISLAND_RADIUS * 0.42, k * 2.9 + 1),
			MEADOW,
		),
		height: 0.02,
	},
]);

/**
 * The ground the ramps leave between them, as the land round an interchange is kept: gravel
 * under the flyovers in the stack's middle.
 */
const verges: TAreaInput[] = [
	...[0, 1, 2, 3].map(
		(k): TAreaInput => ({
			id: `stack_gravel_${k + 1}`,
			kind: "sand_01",
			name: `Gravel under the stack ${k + 1}`,
			height: 0.01,
			colors: { surface: { color: "#c7bda6" } },
			surface: { kind: "gravel_01" },
			points: blob(stackPlace(13, 13, k), 6.5, k * 1.3 + 0.4),
		}),
	),
];

const GARDENS = [...stackGardens, ...cloverGardens, ...verges];

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
	// Only a palm looks different turned; the others are round, and a turn would only add bytes.
	...(kind === "palm_tree_01" ? { rotation: turned(Math.round(shareOf(n) * 360)) } : {}),
	scale: Math.round((0.8 + 0.45 * shareOf(n + 0.5)) * 10) / 10,
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
	square(CLOVER, 44, 46),
	// The stack and the land round it stay open, so the interchange is what the eye finds.
	square(STACK, 64, 64),
	...[0, 1, 2, 3].map((k) => disc(stackIslandCentre(k), STACK_ISLAND_RADIUS + 1.5, 3)),
);

interface IDistrict {
	id: string;
	name: string;
	from: TVec2;
	to: TVec2;
}

/** Terracotta and grey roofs; null is the house's own (an orange tile), which a saved world needn't spell out. */
const ROOFS = ["#b9603d", "#a8573a", "#8d877e", null, "#a88b66", "#c07f52", "#93573f", null];
const SHOP_WALLS = ["#e6d3ad", "#d9b98c", "#f1e6cf", "#c9a27a", "#e8c79a"];
const GLASS = ["#5f7a8c", "#6d8796", "#7c8f95", "#4f6a7a", "#8aa0a8", "#9aa7a0"];
const LAWNS = ["#93a05c", "#8c9a57", "#a0a565", "#86955a", "#a7a86f"];
const STREET = "#b4ad9f";

/** The valley's districts, round the freeways; downtown north-east of the cloverleaf. */
const DISTRICTS: IDistrict[] = [
	{ id: "northgate", name: "Northgate", from: [-150, -90], to: [-58, -6] },
	{ id: "ridgeview", name: "Ridgeview", from: [-32, -92], to: [66, -6] },
	{ id: "westside", name: "Westside", from: [-150, 6], to: [-58, 82] },
	{ id: "riverbend", name: "Riverbend", from: [-32, 6], to: [66, 76] },
	{ id: "harbor", name: "Downtown", from: [68, -110], to: [158, -50] },
	{ id: "eastside", name: "Eastside", from: [68, 50], to: [156, 76] },
];

const isDowntown = (district: IDistrict) => district.id === "harbor";
const DOWNTOWN_MIDDLE: TVec2 = [118, -86];

/**
 * A suburb is laid in blocks, as the first reference picture's: each block two rows of houses
 * back to back, their fronts on the streets north and south of it, a front yard and a garden
 * each, the streets between the blocks. A house is built only where its lot is clear of the
 * roads, the gardens and the rail, so the blocks end where the freeways run.
 */
const LOT_WIDTH = 3.4;
const LOT_DEPTH = 4.4;
const LOTS_IN_A_ROW = 5;
const STREET_WIDTH = 2.2;
const BLOCK: TVec2 = [LOTS_IN_A_ROW * LOT_WIDTH, LOT_DEPTH * 2];

interface IHouseLot {
	district: IDistrict;
	/** The middle of the lot, and which way its front faces: +1 south, −1 north. */
	centre: TVec2;
	faces: 1 | -1;
	/** Its block, and its place along its row. */
	block: number;
	index: number;
}

const houseLots: IHouseLot[] = DISTRICTS.filter((district) => !isDowntown(district)).flatMap(
	(district) => {
		const lots: IHouseLot[] = [];
		const [pitchX, pitchZ] = [BLOCK[0] + STREET_WIDTH, BLOCK[1] + STREET_WIDTH];
		let block = 0;
		for (let bx = district.from[0] + pitchX / 2; bx <= district.to[0] - pitchX / 2; bx += pitchX) {
			for (
				let bz = district.from[1] + pitchZ / 2;
				bz <= district.to[1] - pitchZ / 2;
				bz += pitchZ
			) {
				block += 1;
				for (const faces of [-1, 1] as const) {
					for (let i = 0; i < LOTS_IN_A_ROW; i++) {
						const centre: TVec2 = [
							round2(bx - BLOCK[0] / 2 + LOT_WIDTH * (i + 0.5)),
							round2(bz + (faces * LOT_DEPTH) / 2),
						];
						if (isBuildable(centre, LOT_DEPTH)) {
							lots.push({ district, centre, faces, block, index: i });
						}
					}
				}
			}
		}
		return lots;
	},
);

/** Now and then a block's south row is a strip of shops with its car park, instead of houses. */
const isShopLot = (lot: IHouseLot) =>
	lot.faces === 1 && shareOf(lot.block * 7.3 + lot.district.from[0]) < 0.12;

const houses: TEntityInput[] = houseLots.map((lot, n) => {
	const { centre, faces } = lot;
	// The house towards the street, its front yard before it, its garden behind.
	const at: TVec2 = [centre[0], round2(centre[1] + faces * 0.55)];
	const id = `house_${n + 1}`;
	if (isShopLot(lot)) {
		return {
			id,
			kind: "shop_01",
			name: `${lot.district.name} shops ${n + 1}`,
			position: [at[0], round2(at[1] - faces * 0.6)],
			rotation: turned(faces > 0 ? 0 : 180),
			colors: paint({
				walls: pickOf(SHOP_WALLS, n),
				awning: pickOf(["#2f7a5d", "#b4553a", "#3d5f8a", "#c9a23f"], n + 1),
			}),
			props: { width: 3.1, depth: 2, floorCount: 1 },
		};
	}
	return {
		id,
		kind: "house_01",
		position: at,
		rotation: turned(faces > 0 ? 0 : 180),
		colors: paint({ roof: pickOf(ROOFS, n) }),
		props: {
			width: Math.round((2.1 + 0.3 * shareOf(n + 1)) * 10) / 10,
			height: Math.round((0.95 + 0.25 * shareOf(n + 2)) * 10) / 10,
			...(shareOf(n + 3) < 0.7 ? { showsChimney: false } : {}),
		},
	};
});

/**
 * The ground under the suburbs, as flat parts that all draw together (ADR-0086): each lot's
 * share of the street, grey, with its lawn on top (a car park's tarmac for a shop's lot).
 */
/** The lots of each block, by district and block: a whole block's ground is laid as one. */
const blocksOfLots: IHouseLot[][] = (() => {
	const byBlock = new Map<string, IHouseLot[]>();
	for (const lot of houseLots) {
		const key = `${lot.district.id}:${lot.block}`;
		byBlock.set(key, [...(byBlock.get(key) ?? []), lot]);
	}
	return [...byBlock.values()];
})();

const lotGround: TEntityInput[] = blocksOfLots.flatMap((lots, b) => {
	const yard = (id: string, at: TVec2, width: number, fill: string): TEntityInput => ({
		id,
		kind: "zone_01",

		position: at,
		altitude: 0.012,
		colors: paint({ fill }),
		props: { width: round2(width), depth: round2(LOT_DEPTH - 0.45) },
	});
	if (lots.length === LOTS_IN_A_ROW * 2) {
		// A whole block: its streets round it, and a lawn along each row (a car park under shops).
		const middle: TVec2 = [
			round2(lots.reduce((sum, lot) => sum + lot.centre[0], 0) / lots.length),
			round2(lots.reduce((sum, lot) => sum + lot.centre[1], 0) / lots.length),
		];
		return [
			{
				id: `streets_${b + 1}`,
				kind: "zone_01",

				position: middle,
				colors: paint({ fill: STREET }),
				props: { width: round2(BLOCK[0] + STREET_WIDTH), depth: round2(BLOCK[1] + STREET_WIDTH) },
			},
			...([-1, 1] as const).map((faces) =>
				yard(
					`yards_${b + 1}_${faces > 0 ? "s" : "n"}`,
					[middle[0], round2(middle[1] + faces * (LOT_DEPTH / 2) - faces * 0.1)],
					BLOCK[0] - 0.25,
					lots.some((lot) => lot.faces === faces && isShopLot(lot))
						? "#9d9a93"
						: pickOf(LAWNS, b * 2 + faces),
				),
			),
		];
	}
	// A block cut short by a road: each lot's own share of the street, and its own yard.
	return lots.flatMap((lot) => {
		const { centre, faces } = lot;
		const n = houseLots.indexOf(lot);
		const atRowEnd = lot.index === 0 || lot.index === LOTS_IN_A_ROW - 1;
		const endShift = atRowEnd ? (lot.index === 0 ? -1 : 1) * (STREET_WIDTH / 4) : 0;
		return [
			{
				id: `street_${n + 1}`,
				kind: "zone_01",

				position: [round2(centre[0] + endShift), round2(centre[1] + (faces * STREET_WIDTH) / 4)],
				colors: paint({ fill: STREET }),
				props: {
					width: round2(LOT_WIDTH + (atRowEnd ? STREET_WIDTH / 2 : 0)),
					depth: round2(LOT_DEPTH + STREET_WIDTH / 2),
				},
			},
			yard(
				`yard_${n + 1}`,
				[centre[0], round2(centre[1] - faces * 0.1)],
				LOT_WIDTH - 0.25,
				isShopLot(lot) ? "#9d9a93" : pickOf(LAWNS, n),
			),
		];
	});
});

/** Downtown: towers and blocks of flats on a grid of plazas, tallest round its middle. */
const DOWNTOWN_LOT = 7;
const DOWNTOWN_STREET = 2.6;
const towerLots = DISTRICTS.filter(isDowntown).flatMap((district) => {
	const pitch = DOWNTOWN_LOT + DOWNTOWN_STREET;
	const lots: { district: IDistrict; centre: TVec2 }[] = [];
	for (let x = district.from[0] + pitch / 2; x <= district.to[0] - pitch / 2; x += pitch) {
		for (let z = district.from[1] + pitch / 2; z <= district.to[1] - pitch / 2; z += pitch) {
			const centre: TVec2 = [round2(x), round2(z)];
			if (isBuildable(centre, DOWNTOWN_LOT)) {
				lots.push({ district, centre });
			}
		}
	}
	return lots;
});

const towers: TEntityInput[] = towerLots.flatMap(({ district, centre }, n) => {
	const near = Math.hypot(centre[0] - DOWNTOWN_MIDDLE[0], centre[1] - DOWNTOWN_MIDDLE[1]);
	const floors = Math.max(4, Math.round(30 - near * 0.55 - shareOf(n) * 8));
	const isTower = floors > 9;
	return [
		{
			id: `${district.id}_${n + 1}`,
			kind: isTower ? "office_tower_01" : "apartment_block_01",
			name: `${district.name} ${n + 1}`,
			position: centre,
			rotation: turned(Math.floor(shareOf(n + 9) * 2) * 90),
			colors: paint(
				isTower ? { facade: pickOf(GLASS, n), grid: "#e9e4d8" } : { walls: pickOf(SHOP_WALLS, n) },
			),
			props: isTower
				? {
						width: round2(DOWNTOWN_LOT * (0.6 + 0.25 * shareOf(n + 2))),
						depth: round2(DOWNTOWN_LOT * (0.6 + 0.25 * shareOf(n + 3))),
						floorCount: Math.min(40, floors),
					}
				: { width: round2(DOWNTOWN_LOT * 0.9), depth: 3, floorCount: Math.min(16, floors) },
		},
		{
			id: `${district.id}_${n + 1}_plaza`,
			kind: "zone_01",
			name: `${district.name} plaza`,
			position: centre,
			colors: paint({ fill: "#c2bcae" }),
			props: { width: DOWNTOWN_LOT + DOWNTOWN_STREET, depth: DOWNTOWN_LOT + DOWNTOWN_STREET },
		},
	];
});

const cityBuildings = [...houses, ...towers];
const cityGround = lotGround;

/** Whether a point is on a lot already built on (or its share of the street). */
const onALot = ([x, z]: TVec2, margin: number) =>
	houseLots.some(
		({ centre }) =>
			Math.abs(x - centre[0]) < LOT_WIDTH / 2 + margin &&
			Math.abs(z - centre[1]) < LOT_DEPTH / 2 + margin,
	) ||
	towerLots.some(
		({ centre }) =>
			Math.abs(x - centre[0]) < DOWNTOWN_LOT / 2 + margin &&
			Math.abs(z - centre[1]) < DOWNTOWN_LOT / 2 + margin,
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
	!onALot(point, STREET_WIDTH / 2 + 0.4) &&
	!GARDEN_ZONES.some((zone) => isInsidePolygon(point, zone)) &&
	!RIVER.some((river) => isInsidePolygon(point, river) || edgeDistance(point, river) < 1) &&
	!inRailCorridor(point, 2.5);

/**
 * Palms in two rows down the rail line's corridor, its viaduct's pillars to stand between them:
 * a palm avenue across the valley, where the city keeps clear for the line.
 */
const RAIL_PALM_SPACING = 4;
const railPalms: TEntityInput[] = linePoints(
	[railX(RAIL_NORTH_Z + 6), RAIL_NORTH_Z + 6],
	[railX(RAIL_SOUTH_Z - 30), RAIL_SOUTH_Z - 30],
	RAIL_PALM_SPACING,
).flatMap(([x, z], i) =>
	([-1, 1] as const).flatMap((side): TEntityInput[] => {
		const at: TVec2 = [round2(x + side * 2.2), round2(z - side * 2.2)];
		const isClear =
			clearOfRoads(at, 1.2) &&
			!onALot(at, STREET_WIDTH / 2 + 0.4) &&
			hillAt(at) === 0 &&
			!RIVER.some((river) => isInsidePolygon(at, river) || edgeDistance(at, river) < 1);
		return isClear
			? [tree(`rail_palm_${i + 1}_${side > 0 ? "e" : "w"}`, "palm_tree_01", at, i * 2 + side)]
			: [];
	}),
);

/** Along the freeways and ramps: clumps of trees on the verges, as the dry land round interchanges is planted. */
const vergeTrees: TEntityInput[] = jitteredGrid(3.2, 500)
	.filter(
		(point, i) =>
			hillAt(point) === 0 &&
			!clearOfRoads(point, 6) &&
			shareOf(i * 7) < 0.4 &&
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
		return tree(`verge_${i + 1}`, kind, point, n);
	});

/** Round the stack, where the city stands back: open dry land with groves here and there. */
const STACK_GROUNDS = square(STACK, 64, 64);
const groveTrees: TEntityInput[] = jitteredGrid(3.6, 1300)
	.filter(
		(point, i) =>
			isInsidePolygon(point, STACK_GROUNDS) &&
			// In clumps: where a slow wave across the ground is high.
			Math.sin(point[0] * 0.21) + Math.sin(point[1] * 0.17 + 1.3) > 0.6 &&
			shareOf(i * 3) < 0.55 &&
			isFreeForTree(point),
	)
	.map((point, i) => {
		const n = i * 17 + 5;
		const kind =
			shareOf(n) < 0.3 ? "palm_tree_01" : shareOf(n + 1) < 0.6 ? "round_tree_02" : "round_tree_01";
		return tree(`grove_${i + 1}`, kind, point, n);
	});

/** On the hills: pines and scrub, standing on the slopes. */
const hillTrees: TEntityInput[] = jitteredGrid(4.2, 900)
	.filter((point, i) => hillAt(point) > 0.6 && shareOf(i * 5) < 0.42 && isFreeForTree(point))
	.map((point, i) => {
		const n = i * 11 + 3;
		const kind =
			shareOf(n) < 0.45 ? "pine_tree_01" : shareOf(n + 1) < 0.5 ? "pine_tree_02" : "bush_01";
		return tree(`hill_${i + 1}`, kind, point, n, { altitude: hillAt(point) });
	});

/** Trees in the suburbs: one in a garden now and then, and palms and shade trees along the kerbs. */
const streetTrees: TEntityInput[] = houseLots.flatMap((lot, n) => {
	const { centre, faces } = lot;
	const garden: TVec2 = [
		round2(centre[0] + (shareOf(n + 0.7) - 0.5) * 1.6),
		round2(centre[1] - faces * (LOT_DEPTH / 2 - 0.5)),
	];
	const kerb: TVec2 = [
		round2(centre[0] + LOT_WIDTH / 2),
		round2(centre[1] + faces * (LOT_DEPTH / 2 + 0.45)),
	];
	const trees: TEntityInput[] = [];
	if (shareOf(n * 3) < 0.4 && !isShopLot(lot)) {
		trees.push(
			tree(
				`garden_${n + 1}`,
				shareOf(n * 3 + 1) < 0.5 ? "round_tree_01" : "round_tree_02",
				garden,
				n,
				{ scale: 0.75 },
			),
		);
	}
	if (shareOf(n * 5) < 0.45 && clearOfRoads(kerb, 1)) {
		trees.push(
			tree(
				`kerb_${n + 1}`,
				shareOf(n * 5 + 1) < 0.55 ? "palm_tree_01" : "round_tree_01",
				kerb,
				n + 1,
			),
		);
	}
	return trees;
});

// ---------------------------------------------------------------- lamps, cards and vehicles to ride along

/** A gantry over a carriageway: two posts, a beam, and a green sign with its card, following its row. */
interface IGantry {
	rowId: "nb" | "sb" | "eb" | "wb";
	sign: string;
	/** Where it stands on the carriageway's centre line, which way the traffic drives, how high the road is. */
	at: TVec2;
	heading: TVec2;
	altitude: number;
}

const GANTRY_HEIGHT = 1.7;
const STEEL = "#8e9196";

/** An object's turn (degrees about the vertical) that lays its x along a direction on the ground. */
const turnAlong = ([x, z]: TVec2) => round2((Math.atan2(-z, x) * 180) / Math.PI);

const gantry = ({ rowId, sign, at, heading, altitude }: IGantry): TEntityInput[] => {
	const id = `gantry_${rowId}`;
	const name = `${FREEWAY_NAMES[rowId]} gantry`;
	const across: TVec2 = [-heading[1], heading[0]];
	// On a viaduct the posts stand on the deck's edges; on the ground, just off it.
	const reach = altitude > 0 ? CARRIAGEWAY_WIDTH / 2 - 0.12 : CARRIAGEWAY_WIDTH / 2 + 0.3;
	const post = (side: number): TEntityInput => ({
		id: `${id}_post_${side > 0 ? "right" : "left"}`,
		kind: "box_01",
		name,
		position: [round2(at[0] + across[0] * reach * side), round2(at[1] + across[1] * reach * side)],
		altitude,
		colors: paint({ surface: STEEL }),
		props: { width: 0.16, depth: 0.16, height: GANTRY_HEIGHT },
	});
	const row = TRAFFIC_ROWS[rowId];
	return [
		post(1),
		post(-1),
		{
			id: `${id}_beam`,
			kind: "box_01",
			name,
			position: [round2(at[0]), round2(at[1])],
			altitude: round2(altitude + GANTRY_HEIGHT - 0.18),
			rotation: turned(turnAlong(across)),
			colors: paint({ surface: STEEL }),
			props: { width: round2(reach * 2 + 0.16), depth: 0.16, height: 0.18 },
		},
		{
			id: `${id}_sign`,
			kind: "text_01",
			name: `${row.key} sign`,
			position: [round2(at[0] - heading[0] * 0.12), round2(at[1] - heading[1] * 0.12)],
			altitude: round2(altitude + GANTRY_HEIGHT - 0.2),
			// Facing the traffic coming towards it.
			rotation: turned(round2((Math.atan2(-heading[0], -heading[1]) * 180) / Math.PI)),
			colors: paint({ letters: "#f4f4ef", plate: "#1f6a45" }),
			props: { text: sign, letterHeight: 0.34, layout: "standing", showsPlate: true },
			dataRow: { tableKey: "traffic", rowKey: row.key },
			label: {
				title: row.key,
				dataKeys: ["row.vehicles_per_hour", "row.average_speed", "row.delay_minutes"],
				offset: [0, 0.9, 0],
			},
			details: {
				description: `${EXAMPLE}. How full it is shows three ways: more vehicles, slower, and the road turning red.`,
				dataKeys: [
					"row.vehicles_per_hour",
					"row.average_speed",
					"row.delay_minutes",
					"row.congestion",
				],
			},
		},
	];
};

const GANTRIES: IGantry[] = [
	{
		rowId: "nb",
		sign: "Valley Fwy  North",
		at: [NB_X, -76],
		heading: [0, -1],
		altitude: LEVEL_FREEWAY,
	},
	{
		rowId: "sb",
		sign: "Valley Fwy  South",
		at: [SB_X, 72],
		heading: [0, 1],
		altitude: LEVEL_FREEWAY,
	},
	{ rowId: "eb", sign: "Crosstown Fwy  East", at: [-143, EB_Z], heading: [1, 0], altitude: 0 },
	{ rowId: "wb", sign: "Crosstown Fwy  West", at: [55, WB_Z], heading: [-1, 0], altitude: 0 },
];

const gantries: TEntityInput[] = GANTRIES.flatMap(gantry);

/** Lamps down the freeways' medians, where they run on the ground, every so far. */
const LAMP_SPACING = 9;

const medianLamps = (id: string, from: TVec2, to: TVec2): TEntityInput[] =>
	linePoints(from, to, LAMP_SPACING)
		.slice(1, -1)
		.filter((point) => clearOfRoads(point, 0.25))
		// Not under a gantry.
		.filter((point) =>
			GANTRIES.every(({ at }) => Math.hypot(point[0] - at[0], point[1] - at[1]) > 4),
		)
		.map((point, i) => ({
			id: `${id}_${i + 1}`,
			kind: "street_lamp_01",
			position: [round2(point[0]), round2(point[1])],
			props: { height: 2 },
		}));

const lamps: TEntityInput[] = [
	...medianLamps("crosstown_lamp", [WEST_TUNNEL_X + 4, STACK[1]], [EAST_TUNNEL_X - 4, STACK[1]]),
];

/** The tunnels' mouths, where the freeways go into the hills: both carriageways under one portal. */
const TUNNEL_WIDTH = CARRIAGEWAY_OFFSET * 2 + CARRIAGEWAY_WIDTH + 0.8;

const tunnelMouth = (
	id: string,
	name: string,
	at: TVec2,
	turn: number,
	altitude: number,
): TEntityInput => ({
	id,
	kind: "tunnel_01",
	name,
	position: at,
	altitude,
	rotation: turned(turn),
	colors: paint({ walls: "#b9ad8c", roof: "#a39a68" }),
	props: { length: 5, width: round2(TUNNEL_WIDTH), height: 1.5 },
});

const tunnels: TEntityInput[] = [
	tunnelMouth("tunnel_north", "Ridge tunnel", [STACK[0], NORTH_TUNNEL_Z - 1.5], 90, LEVEL_FREEWAY),
	tunnelMouth(
		"tunnel_south",
		"South hills tunnel",
		[STACK[0], SOUTH_TUNNEL_Z + 1.5],
		90,
		LEVEL_FREEWAY,
	),
	tunnelMouth("tunnel_west", "West hills tunnel", [WEST_TUNNEL_X - 1.5, STACK[1]], 0, 0),
	tunnelMouth("tunnel_east", "East hill tunnel", [EAST_TUNNEL_X + 1.5, STACK[1]], 0, 0),
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

const OVERVIEW = { target: [-24, -2] as TVec2, azimuth: 302, elevation: 30, span: 170 };

const VIEWPOINTS: TSceneInput["viewpoints"] = [
	{
		id: "view_interchange",
		name: "The Interchange",
		description:
			"Two freeways, a four-level stack and a cloverleaf. Play the story to watch a day of example traffic.",
		// Low over the stack from the south-east, the flyovers filling the view, as in an aerial photograph.
		target: [STACK[0] + 6, STACK[1] + 6],
		targetAltitude: 2,
		azimuth: 305,
		elevation: 24,
		span: 120,
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
		target: stackPlace(HIGH_FLYOVER.entryAt - 6, 4.5, 0),
		targetAltitude: 0,
		azimuth: 205,
		elevation: 20,
		span: 22,
		projection: "perspective",
	},
	{
		id: "view_bridge",
		name: "The river bridge",
		description: "The Valley Freeway crossing the river into the south hills.",
		target: [STACK[0], 92],
		targetAltitude: 2,
		azimuth: 25,
		elevation: 16,
		span: 44,
		projection: "perspective",
	},
	{
		id: "view_tunnel",
		name: "The tunnel portal",
		description: "The Valley Freeway runs into the ridge.",
		target: [STACK[0], NORTH_TUNNEL_Z + 4],
		targetAltitude: 2,
		azimuth: 285,
		elevation: 14,
		span: 30,
		projection: "perspective",
	},
	{
		id: "view_palm_avenue",
		name: "The palm avenue",
		description:
			"Two rows of palms across the valley, from the ridge to the river, under the flyovers.",
		target: [railX(30), 30],
		targetAltitude: 2,
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
	...gantries,
	...tunnels,
	...lamps,
	...rideAlongs,
	...cityBuildings,
	...cityGround,
	...gardenTrees,
	...streetTrees,
	...railPalms,
	...vergeTrees,
	...groveTrees,
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
		areas: [...AREAS, ...GARDENS],
		roads: ROADS,
		junctions: JUNCTIONS,
		entities: ENTITIES,
	} satisfies TSceneInput);
