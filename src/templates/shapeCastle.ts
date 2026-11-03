import {
	SCENE_VERSION,
	SceneSchema,
	type TAreaInput,
	type TEntityInput,
	type TScene,
	type TSceneInput,
	type TVec2,
} from "#/scene/schema";

/**
 * Shape Castle: a castle by a river, built only from shapes (ADR-0124), to show what they make
 * together. A plain world to build on, without data (ADR-0115); the day passes from late
 * afternoon into the night, when the keep's windows light up.
 */

const STONE = "#b9b3a6";
const DARK_STONE = "#9c9588";
const SLATE = "#4f5d73";
const RED_ROOF = "#a8452f";
const WOOD = "#7a5a3a";
const FLAG = "#c0392b";
const GOLD = "#e8c34a";
const LEAVES = "#4f8f4f";
const PINE = "#3d6e45";
const WINDOW = "#3a3328";
const LAMPLIGHT = "#ffcf7a";

/** The curtain walls: half the castle's width, how tall and how thick. */
const WALL = { half: 5, height: 2.2, thickness: 0.6 };

/** A shape, its one colour (Surface) set; ids are numbered by kind as they're made. */
const shapesMaker = () => {
	let made = 0;
	const shape = (
		kind: string,
		[x, z]: TVec2,
		props: Record<string, unknown>,
		color: string,
		more: Partial<TEntityInput> = {},
	): TEntityInput => ({
		id: `${kind.replace("_01", "")}_${++made}`,
		kind,
		position: [x, z],
		props,
		colors: { surface: { color } },
		...more,
	});
	const box = (
		at: TVec2,
		[width, depth, height]: [number, number, number],
		color: string,
		altitude = 0,
	) => shape("box_01", at, { width, depth, height }, color, { altitude });
	return { shape, box };
};

const buildCastle = () => {
	const { shape, box } = shapesMaker();

	/** Battlements: merlons along a wall's top from `from` to `to`, about `step` apart. */
	const merlons = (from: TVec2, to: TVec2, altitude: number, thickness: number, step = 0.8) => {
		const count = Math.max(1, Math.floor(Math.hypot(to[0] - from[0], to[1] - from[1]) / step));
		const alongX = Math.abs(to[0] - from[0]) > Math.abs(to[1] - from[1]);
		return Array.from({ length: count + 1 }, (_, i) =>
			box(
				[from[0] + ((to[0] - from[0]) * i) / count, from[1] + ((to[1] - from[1]) * i) / count],
				alongX ? [0.4, thickness, 0.45] : [thickness, 0.4, 0.45],
				STONE,
				altitude,
			),
		);
	};

	// The curtain walls: back, sides, and the front either side of the gatehouse, with battlements.
	const walls: TEntityInput[] = [
		box([0, -WALL.half], [2 * WALL.half, WALL.thickness, WALL.height], STONE),
		box([-WALL.half, 0], [WALL.thickness, 2 * WALL.half, WALL.height], STONE),
		box([WALL.half, 0], [WALL.thickness, 2 * WALL.half, WALL.height], STONE),
		box([-3.25, WALL.half], [3.5, WALL.thickness, WALL.height], STONE),
		box([3.25, WALL.half], [3.5, WALL.thickness, WALL.height], STONE),
		...merlons([-3.8, -WALL.half], [3.8, -WALL.half], WALL.height, WALL.thickness),
		...merlons([-WALL.half, -3.8], [-WALL.half, 3.8], WALL.height, WALL.thickness),
		...merlons([WALL.half, -3.8], [WALL.half, 3.8], WALL.height, WALL.thickness),
		...merlons([-3.8, WALL.half], [-1.9, WALL.half], WALL.height, WALL.thickness),
		...merlons([1.9, WALL.half], [3.8, WALL.half], WALL.height, WALL.thickness),
	];

	// Round towers at the corners: a band under a slate cone.
	const towers = [-1, 1].flatMap((sx) =>
		[-1, 1].flatMap((sz): TEntityInput[] => {
			const at: TVec2 = [sx * WALL.half, sz * WALL.half];
			return [
				shape("cylinder_01", at, { width: 2, depth: 2, height: 3.2, sideCount: 12 }, DARK_STONE),
				shape(
					"torus_01",
					at,
					{
						width: 2.3,
						depth: 2.3,
						height: 0.25,
						ringThickness: 0.3,
						sideCount: 12,
						ringSideCount: 4,
					},
					STONE,
					{ altitude: 3.2 },
				),
				shape("cone_01", at, { width: 2.4, depth: 2.4, height: 2, sideCount: 12 }, SLATE, {
					altitude: 3.45,
				}),
			];
		}),
	);

	// The gatehouse: an arch through a thick block, battlements on top and a flag over it.
	const gatehouse: TEntityInput[] = [
		shape(
			"arch_01",
			[0, WALL.half],
			{ width: 3.2, depth: 1.4, height: 3, openingWidth: 1.4, openingHeight: 2.1, sideCount: 10 },
			DARK_STONE,
			{ name: "Gatehouse" },
		),
		...merlons([-1.4, WALL.half + 0.45], [1.4, WALL.half + 0.45], 3, 0.5, 0.7),
		shape(
			"cylinder_01",
			[-1.2, WALL.half - 0.4],
			{ width: 0.08, depth: 0.08, height: 1.6, sideCount: 6 },
			WOOD,
			{ altitude: 3 },
		),
		shape(
			"panel_01",
			[-0.82, WALL.half - 0.4],
			{ width: 0.7, height: 0.45, thickness: 0.03 },
			FLAG,
			{ altitude: 4.05 },
		),
	];

	// The keep: a tall block under a red pyramid roof with a gold ball on top, its windows (and the
	// ball) lit after dark, and its door.
	const keep: TEntityInput[] = [
		shape("box_01", [0, -1.2], { width: 4, depth: 4, height: 5 }, STONE, { name: "The keep" }),
		shape("pyramid_01", [0, -1.2], { width: 4.4, depth: 4.4, height: 2.6 }, RED_ROOF, {
			altitude: 5,
		}),
		shape("ball_01", [0, -1.2], { width: 0.3, depth: 0.3, height: 0.3, sideCount: 8 }, GOLD, {
			altitude: 7.6,
			lights: { glow: { whenOn: "auto", color: "#ffd84a" } },
		}),
		...[1.1, 2.5, 3.8].flatMap((altitude) =>
			[-1, 0, 1].map((x) =>
				shape("box_01", [x, 0.82], { width: 0.35, depth: 0.06, height: 0.55 }, WINDOW, {
					altitude,
					lights: { glow: { whenOn: "auto", color: LAMPLIGHT } },
				}),
			),
		),
		shape("panel_01", [0, 0.84], { width: 0.9, height: 0.9, thickness: 0.06 }, WOOD),
	];

	// In the courtyard: a chapel with a bell tower, a well, and a stable.
	const courtyard: TEntityInput[] = [
		box([-3.2, 2.6], [1.6, 2.4, 1.4], STONE),
		shape(
			"wedge_01",
			[-3.2, 2.6],
			{ width: 2.6, depth: 1.9, height: 0.9, ridgeShare: 0.5 },
			RED_ROOF,
			{ altitude: 1.4, rotation: [0, 90, 0] },
		),
		box([-3.2, 3.9], [0.7, 0.7, 2.6], STONE),
		shape("pyramid_01", [-3.2, 3.9], { width: 0.8, depth: 0.8, height: 1 }, SLATE, {
			altitude: 2.6,
		}),
		shape(
			"cylinder_01",
			[2.9, 2.9],
			{ width: 0.9, depth: 0.9, height: 0.5, sideCount: 10, isHollow: true, wallThickness: 0.12 },
			DARK_STONE,
		),
		box([2.5, 2.9], [0.08, 0.08, 0.95], WOOD),
		box([3.3, 2.9], [0.08, 0.08, 0.95], WOOD),
		shape("wedge_01", [2.9, 2.9], { width: 1.1, depth: 0.8, height: 0.35, ridgeShare: 0.5 }, WOOD, {
			altitude: 0.95,
		}),
		box([3.4, -3.6], [2, 1.4, 1], WOOD),
		shape(
			"wedge_01",
			[3.4, -3.6],
			{ width: 2.2, depth: 1.6, height: 0.6, ridgeShare: 0.5 },
			RED_ROOF,
			{ altitude: 1 },
		),
	];

	// The bridge over the river: an arch, turned to span it, a ramp up to it at each end.
	const bridge: TEntityInput[] = [
		shape(
			"arch_01",
			[0, 9],
			{
				width: 4.6,
				depth: 1.6,
				height: 0.8,
				openingWidth: 2.6,
				openingHeight: 0.65,
				sideCount: 10,
			},
			DARK_STONE,
			{ name: "Bridge", rotation: [0, 90, 0] },
		),
		shape("wedge_01", [0, 6.2], { width: 1.6, depth: 1, height: 0.8 }, DARK_STONE, {
			rotation: [0, 180, 0],
		}),
		shape("wedge_01", [0, 11.8], { width: 1.6, depth: 1, height: 0.8 }, DARK_STONE),
	];

	// Trees made of shapes: pines (a trunk under a cone) and round ones (under a ball).
	const trees = TREES.flatMap(([x, z, kind]): TEntityInput[] => [
		shape("cylinder_01", [x, z], { width: 0.25, depth: 0.25, height: 0.7, sideCount: 6 }, WOOD),
		kind === "pine"
			? shape("cone_01", [x, z], { width: 1.2, depth: 1.2, height: 1.9, sideCount: 8 }, PINE, {
					altitude: 0.55,
				})
			: shape("ball_01", [x, z], { width: 1.4, depth: 1.4, height: 1.3, sideCount: 8 }, LEAVES, {
					altitude: 0.55,
				}),
	]);

	return [...walls, ...towers, ...gatehouse, ...keep, ...courtyard, ...bridge, ...trees];
};

const TREES: [number, number, "pine" | "round"][] = [
	[-9, -7, "pine"],
	[-11, -3, "round"],
	[-8.5, 2, "pine"],
	[-12, 5, "pine"],
	[8.6, -7.5, "round"],
	[11, -2, "pine"],
	[9, 3, "pine"],
	[12.5, 5.5, "round"],
	[-6, -9.5, "round"],
	[5, -10, "pine"],
	[-7, 14, "pine"],
	[-4, 15.5, "round"],
	[6, 14.5, "round"],
	[9, 16, "pine"],
	[-11, 15, "round"],
	[0.5, -11.5, "pine"],
];

const AREAS: TAreaInput[] = [
	{
		id: "river",
		name: "The river",
		kind: "water_01",
		points: [
			[-20, 7.6],
			[20, 7.2],
			[20, 10.6],
			[-20, 10.4],
		],
	},
	{
		id: "courtyard",
		name: "Courtyard",
		kind: "plaza_01",
		points: [
			[-4.7, -4.7],
			[4.7, -4.7],
			[4.7, 4.7],
			[-4.7, 4.7],
		],
	},
];

export const createShapeCastleScene = (): TScene =>
	SceneSchema.parse({
		version: SCENE_VERSION,
		meta: {
			title: "Shape Castle",
			subtitle: "A castle by a river, built only from shapes",
		},
		ground: { width: 40, depth: 40 },
		lighting: { time: 17.6, timeSource: "cycle", dayLength: 240 },
		camera: { openingViewpointId: "view_gate" },
		viewpoints: [
			{
				id: "view_gate",
				name: "Over the river",
				description: "The gatehouse and its bridge, the keep behind.",
				target: [0, 2],
				azimuth: 300,
				elevation: 24,
				span: 26,
				projection: "perspective",
			},
			{
				id: "view_above",
				name: "From above",
				description: "The walls, the towers and the courtyard.",
				target: [0, 0],
				azimuth: 225,
				elevation: 50,
				span: 24,
			},
		],
		data: { enabled: false },
		areas: AREAS,
		entities: buildCastle(),
	} satisfies TSceneInput);
