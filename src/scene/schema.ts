import { z } from "zod";

/**
 * The scene document is the single source of truth for a world.
 * The renderer, editor, persistence and (future) AI generation all read and
 * write this shape. See docs/adr/0003-scene-as-json-document.md.
 *
 * Bump SCENE_VERSION on breaking changes and add a migration in ./migrate.ts.
 */
export const SCENE_VERSION = 1;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour like #3d4fd6");

/** [x, z] on the ground plane, in grid units. */
export const Vec2Schema = z.tuple([z.number(), z.number()]);
/** [x, y, z] in world units. */
export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

/**
 * How vehicles take corners: `smooth` turns gradually over about half the
 * vehicle's length, `sharp` snaps to each new direction. Set for the scene,
 * overridable per road and per vehicle (null = inherit).
 */
export const TurnsSchema = z.enum(["smooth", "sharp"]);

export const LabelSchema = z.object({
	enabled: z.boolean().default(true),
	title: z.string().default(""),
	/** Keys into `scene.data`. One key renders as a big number, several as rows. */
	dataKeys: z.array(z.string()).default([]),
	/** Card position relative to the entity's label anchor (top of the part). */
	offset: Vec3Schema.default([0, 2, 0]),
});

export const FollowSchema = z.object({
	roadId: z.string(),
	/** Grid units per second. */
	speed: z.number().min(0).max(50).default(2),
	/** Distance along the road where the entity starts. */
	offset: z.number().default(0),
	/** How this vehicle takes corners; null = the road's setting (or the scene's). */
	turns: TurnsSchema.nullable().default(null),
});

export const DetailsSchema = z.object({
	description: z.string().default(""),
	/** Data shown as tiles when the entity is opened in view mode. */
	dataKeys: z.array(z.string()).default([]),
});

export const EntitySchema = z.object({
	id: z.string().min(1),
	/** Part kind from the part registry (src/parts/registry.ts). */
	kind: z.string().min(1),
	name: z.string().default(""),
	position: Vec2Schema.default([0, 0]),
	elevation: z.number().default(0),
	/** Degrees around the vertical axis. */
	rotation: z.number().default(0),
	scale: z.number().min(0.1).max(10).default(1),
	/** null = use the part's default colour for the active theme. */
	color: hexColor.nullable().default(null),
	accent: hexColor.nullable().default(null),
	/** Part-specific parameters, validated by the part's own schema. */
	props: z.record(z.string(), z.unknown()).default({}),
	label: LabelSchema.nullable().default(null),
	follow: FollowSchema.nullable().default(null),
	details: DetailsSchema.default({ description: "", dataKeys: [] }),
	locked: z.boolean().default(false),
});

export const DataEntrySchema = z.object({
	key: z.string().regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores"),
	label: z.string().default(""),
	value: z.union([z.number(), z.string()]),
	unit: z.string().default(""),
});

/**
 * A road control point: [x, z, height above ground, width?]. Without a width
 * the point uses the road's width; with one, the road eases to that width
 * here (see docs/adr/0023-road-width-per-point.md). `[x, z]` is accepted as
 * height 0.
 */
export const RoadPointSchema = z.union([
	z.tuple([z.number(), z.number(), z.number().min(0).max(50), z.number().min(0.4).max(20)]),
	z.tuple([z.number(), z.number(), z.number().min(0).max(50)]),
	z
		.tuple([z.number(), z.number()])
		.transform(([x, zPos]): [number, number, number] => [x, zPos, 0]),
]);

/** What holds up elevated sections: pillars (roads can pass underneath) or a sloped bank. */
export const RoadSupportsSchema = z.enum(["pillars", "embankment"]);

/** asphalt = paved road with markings, dirt = path, hidden = invisible route for vehicles only. */
export const RoadStyleSchema = z.enum(["asphalt", "dirt", "hidden"]);

/** Where on a road vehicles drive. See docs/adr/0022-centre-lane-roads.md. */
export const RoadLaneSchema = z.enum(["side", "centre"]);

/**
 * A road drawn as a polyline on the ground. Corners are rounded with
 * `cornerRadius`, and every road doubles as a route vehicles can follow.
 * See docs/adr/0017-drawable-roads.md.
 */
export const RoadSchema = z.object({
	id: z.string().min(1),
	name: z.string().default(""),
	style: RoadStyleSchema.default("asphalt"),
	/** Control points [x, z, height]; the road passes through the first and last (unless closed). */
	points: z.array(RoadPointSchema).min(2),
	/** Loop back from the last point to the first. */
	closed: z.boolean().default(false),
	width: z.number().min(0.4).max(20).default(2.4),
	/** Radius of the curve at each corner; 0 = sharp corners. */
	cornerRadius: z.number().min(0).max(50).default(3),
	/** Centre-line markings (asphalt only). */
	markings: z.boolean().default(true),
	/** How elevated sections are held up. See docs/adr/0018-elevated-roads-and-road-editing.md. */
	supports: RoadSupportsSchema.default("pillars"),
	/** Low barriers along the edges of elevated sections. */
	railings: z.boolean().default(true),
	/**
	 * Where vehicles drive: in a lane on the scene's driving side, or down the
	 * centre (one-way roads, race tracks).
	 */
	lane: RoadLaneSchema.default("side"),
	/** How vehicles on this road take corners; null = the scene's setting. */
	turns: TurnsSchema.nullable().default(null),
	/** null = the style's default colour for the active theme. */
	color: hexColor.nullable().default(null),
});

/** Which side of the road vehicles drive on. */
export const DrivingSideSchema = z.enum(["right", "left"]);

/** What an area is: sets its default colour. `land` is meant for raised ground (rocks, plateaus). */
export const AreaTypeSchema = z.enum(["water", "grass", "sand", "plaza", "land"]);

/**
 * A free-form area on the ground (water, lawn, beach, square…), drawn as a
 * polygon. With a height it becomes raised land with cliff sides.
 * See docs/adr/0021-free-form-areas.md.
 */
export const AreaSchema = z.object({
	id: z.string().min(1),
	name: z.string().default(""),
	type: AreaTypeSchema.default("grass"),
	/** Outline corners [x, z]; always closed. */
	points: z.array(Vec2Schema).min(3),
	/** 0 = flat on the ground; above 0 = raised with vertical sides. */
	height: z.number().min(0).max(30).default(0),
	/** null = the type's default colour for the active theme. */
	color: hexColor.nullable().default(null),
});

export const GroundSchema = z.object({
	width: z.number().min(4).max(200).default(40),
	depth: z.number().min(4).max(200).default(30),
	color: hexColor.nullable().default(null),
});

export const ThemeSchema = z.enum(["system", "light", "dark"]);

export const SceneSchema = z
	.object({
		version: z.literal(SCENE_VERSION),
		meta: z
			.object({
				title: z.string().default("Untitled world"),
				subtitle: z.string().default(""),
			})
			.default({ title: "Untitled world", subtitle: "" }),
		theme: ThemeSchema.default("system"),
		ground: GroundSchema.default({ width: 40, depth: 30, color: null }),
		driving: DrivingSideSchema.default("right"),
		/** How vehicles take corners, unless a road or vehicle says otherwise. */
		turns: TurnsSchema.default("smooth"),
		entities: z.array(EntitySchema).default([]),
		roads: z.array(RoadSchema).default([]),
		areas: z.array(AreaSchema).default([]),
		data: z.array(DataEntrySchema).default([]),
	})
	.superRefine((scene, ctx) => {
		const checkUnique = (values: string[], path: (string | number)[], what: string) => {
			const seen = new Set<string>();
			values.forEach((value, index) => {
				if (seen.has(value)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate ${what} "${value}"`,
						path: [...path, index],
					});
				}
				seen.add(value);
			});
		};
		checkUnique(
			scene.entities.map((e) => e.id),
			["entities"],
			"entity id",
		);
		checkUnique(
			scene.roads.map((r) => r.id),
			["roads"],
			"road id",
		);
		checkUnique(
			scene.areas.map((a) => a.id),
			["areas"],
			"area id",
		);
		checkUnique(
			scene.data.map((d) => d.key),
			["data"],
			"data key",
		);
	});

export type TScene = z.output<typeof SceneSchema>;
export type TSceneInput = z.input<typeof SceneSchema>;
export type TEntity = z.output<typeof EntitySchema>;
export type TEntityInput = z.input<typeof EntitySchema>;
export type TLabel = z.output<typeof LabelSchema>;
export type TFollow = z.output<typeof FollowSchema>;
export type TDataEntry = z.output<typeof DataEntrySchema>;
export type TRoad = z.output<typeof RoadSchema>;
export type TRoadInput = z.input<typeof RoadSchema>;
export type TRoadStyle = z.output<typeof RoadStyleSchema>;
export type TRoadPoint = z.output<typeof RoadPointSchema>;
export type TRoadSupports = z.output<typeof RoadSupportsSchema>;
export type TRoadLane = z.output<typeof RoadLaneSchema>;
export type TArea = z.output<typeof AreaSchema>;
export type TAreaInput = z.input<typeof AreaSchema>;
export type TAreaType = z.output<typeof AreaTypeSchema>;
export type TDrivingSide = z.output<typeof DrivingSideSchema>;
export type TTurns = z.output<typeof TurnsSchema>;
export type TThemePreference = z.output<typeof ThemeSchema>;
export type TVec2 = z.output<typeof Vec2Schema>;
export type TVec3 = z.output<typeof Vec3Schema>;
