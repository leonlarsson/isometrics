import { z } from "zod";

/**
 * The scene document is the single source of truth for a world.
 * The renderer, editor, persistence and (future) AI generation all read and
 * write this shape. See docs/adr/0003-scene-as-json-document.md.
 *
 * Field meanings live in `.describe()` text so they reach /schema.json, where
 * people and AIs writing worlds read them (ADR-0032); comments are for code.
 *
 * Bump SCENE_VERSION on breaking changes and add a migration in ./migrate.ts.
 */
export const SCENE_VERSION = 1;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour like #3d4fd6");

/** [x, z] on the ground plane, in grid units. */
export const Vec2Schema = z.tuple([z.number(), z.number()]);
/** [x, y, z] in world units. */
export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const TurnsSchema = z
	.enum(["smooth", "sharp"])
	.describe(
		"How vehicles take corners: smooth turns gradually over about half the vehicle's length, sharp snaps to each new direction.",
	);

export const LabelSchema = z
	.object({
		enabled: z.boolean().default(true).describe("Show the card."),
		title: z.string().default("").describe("Heading on the card."),
		dataKeys: z
			.array(z.string())
			.default([])
			.describe(
				"Keys of entries in the world's data list. One key shows as a big number, several as rows.",
			),
		offset: Vec3Schema.default([0, 2, 0]).describe(
			"Where the card floats, as [x, y, z] from the top of the part.",
		),
	})
	.describe("A floating card above the object showing data values.");

export const FollowSchema = z
	.object({
		roadId: z.string().describe("Id of the road (or hidden route) to drive along."),
		speed: z.number().min(0).max(50).default(2).describe("Grid units per second."),
		offset: z
			.number()
			.default(0)
			.describe(
				"Where it starts: the distance along the road from its first point (also when reversed).",
			),
		reverse: z
			.boolean()
			.default(false)
			.describe(
				"Drive the road the other way: against the order of its points, in the opposite lane. Loops go round the other way; open roads set off backwards.",
			),
		turns: TurnsSchema.nullable()
			.default(null)
			.describe("How this vehicle takes corners; null = the road's setting, else the world's."),
	})
	.describe(
		"Makes a vehicle drive along a road; open roads are driven back and forth, loops round and round.",
	);

export const DetailsSchema = z
	.object({
		description: z.string().default("").describe("Text shown when the object is opened."),
		dataKeys: z
			.array(z.string())
			.default([])
			.describe("Data keys shown as tiles when the object is opened in view mode."),
	})
	.describe("What view mode shows when someone clicks the object.");

export const EntitySchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the objects."),
		// Validated against the part registry (src/parts/registry.ts) at render time, not here.
		kind: z.string().min(1).describe("Which part this is."),
		name: z.string().default("").describe("Shown in the editor; empty uses the part's name."),
		position: Vec2Schema.default([0, 0]).describe(
			"Where the part stands: [x, z] in grid units, the centre of its footprint. Ignored while it follows a road.",
		),
		elevation: z
			.number()
			.default(0)
			.describe("Height above the ground (e.g. on a raised area); 0 = on the ground."),
		rotation: z
			.number()
			.default(0)
			.describe(
				"Degrees around the vertical axis, counter-clockwise seen from above. At 0 the front faces +z and vehicles face +x. While following a road it turns the vehicle relative to the road.",
			),
		scale: z.number().min(0.1).max(10).default(1).describe("Size factor for the whole part."),
		color: hexColor
			.nullable()
			.default(null)
			.describe("Main colour as #rrggbb; null = the part's default for the theme."),
		accent: hexColor
			.nullable()
			.default(null)
			.describe("Second colour as #rrggbb; null = the part's default for the theme."),
		props: z
			.record(z.string(), z.unknown())
			.default({})
			.describe("The part's own parameters (see its kind); missing ones use their defaults."),
		label: LabelSchema.nullable().default(null),
		follow: FollowSchema.nullable().default(null),
		details: DetailsSchema.default({ description: "", dataKeys: [] }),
		locked: z.boolean().default(false).describe("Can't be moved in the editor."),
		hidden: z
			.boolean()
			.default(false)
			.describe("Not drawn (it's still listed in the editor's outliner, and kept in the file)."),
	})
	.describe("An object in the world: a building, vehicle, tree, marker…");

export const DataEntrySchema = z
	.object({
		key: z
			.string()
			.regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores")
			.describe("Unique name that labels refer to: lowercase letters, numbers and underscores."),
		label: z.string().default("").describe("Human-readable name shown next to the value."),
		value: z.union([z.number(), z.string()]).describe("The value: a number or a short text."),
		unit: z.string().default("").describe('Shown after the value, e.g. "%" or "km/h".'),
	})
	.describe("A named value that cards and detail tiles show.");

// See docs/adr/0023-road-width-per-point.md for widths per point.
export const RoadPointSchema = z
	.union([
		z.tuple([z.number(), z.number(), z.number().min(0).max(50), z.number().min(0.4).max(20)]),
		z.tuple([z.number(), z.number(), z.number().min(0).max(50)]),
		z
			.tuple([z.number(), z.number()])
			.transform(([x, zPos]): [number, number, number] => [x, zPos, 0]),
	])
	.describe(
		"A road control point: [x, z], [x, z, height] or [x, z, height, width]. A height above 0 lifts the road there (bridges, flyovers); a width there overrides the road's width, easing in from the neighbouring points.",
	);

export const RoadSupportsSchema = z
	.enum(["pillars", "embankment"])
	.describe(
		"What holds up elevated sections: pillars (other roads can pass underneath) or a sloped bank.",
	);

export const RoadStyleSchema = z
	.enum(["asphalt", "dirt", "hidden"])
	.describe(
		"asphalt = paved road with markings, dirt = path, hidden = invisible route that only vehicles use (ferry lines, forklift paths).",
	);

// See docs/adr/0022-centre-lane-roads.md.
export const RoadLaneSchema = z
	.enum(["side", "centre"])
	.describe(
		"Where vehicles drive: in a lane on the world's driving side, or down the centre (one-way roads, race tracks).",
	);

// See docs/adr/0017-drawable-roads.md and 0018-elevated-roads-and-road-editing.md.
export const RoadSchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the roads; vehicles refer to it."),
		name: z.string().default("").describe("Shown in the editor."),
		style: RoadStyleSchema.default("asphalt"),
		points: z
			.array(RoadPointSchema)
			.min(2)
			.describe(
				"Control points in drawing order; the road passes through the first and last (unless closed). This order is a vehicle's forward direction.",
			),
		closed: z.boolean().default(false).describe("Loop back from the last point to the first."),
		width: z.number().min(0.4).max(20).default(2.4).describe("Width in grid units."),
		cornerRadius: z
			.number()
			.min(0)
			.max(50)
			.default(3)
			.describe("Radius of the curve at each corner; 0 = sharp corners."),
		markings: z.boolean().default(true).describe("Centre-line markings (asphalt only)."),
		supports: RoadSupportsSchema.default("pillars"),
		railings: z
			.boolean()
			.default(true)
			.describe("Low barriers along the edges of elevated sections."),
		lane: RoadLaneSchema.default("side"),
		turns: TurnsSchema.nullable()
			.default(null)
			.describe("How vehicles on this road take corners; null = the world's setting."),
		color: hexColor
			.nullable()
			.default(null)
			.describe("Surface colour as #rrggbb; null = the style's default for the theme."),
		locked: z.boolean().default(false).describe("Its points can't be moved in the editor."),
		hidden: z
			.boolean()
			.default(false)
			.describe(
				"Not drawn, and vehicles can't be dropped onto it; vehicles already on it keep driving (it's still listed in the editor's outliner, and kept in the file).",
			),
	})
	.describe(
		"A road drawn as a line of points with rounded corners. Every road doubles as a route vehicles can follow.",
	);

export const DrivingSideSchema = z
	.enum(["right", "left"])
	.describe("Which side of the road vehicles drive on.");

export const AreaTypeSchema = z
	.enum(["water", "grass", "sand", "plaza", "land"])
	.describe(
		"What the area is; sets its colour. land is meant for raised ground (rocks, plateaus).",
	);

// See docs/adr/0021-free-form-areas.md.
export const AreaSchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the areas."),
		name: z.string().default("").describe("Shown in the editor."),
		type: AreaTypeSchema.default("grass"),
		points: z
			.array(Vec2Schema)
			.min(3)
			.describe("Outline corners as [x, z], in order; the outline always closes."),
		height: z
			.number()
			.min(0)
			.max(30)
			.default(0)
			.describe("0 = flat on the ground; above 0 = raised with cliff sides."),
		color: hexColor
			.nullable()
			.default(null)
			.describe("Colour as #rrggbb; null = the type's default for the theme."),
		locked: z.boolean().default(false).describe("Its corners can't be moved in the editor."),
		hidden: z
			.boolean()
			.default(false)
			.describe("Not drawn (it's still listed in the editor's outliner, and kept in the file)."),
	})
	.describe("A free-form area on the ground (water, lawn, beach, square…) or raised land.");

export const GroundSchema = z
	.object({
		width: z.number().min(4).max(200).default(40).describe("Size along x, in grid units."),
		depth: z.number().min(4).max(200).default(30).describe("Size along z, in grid units."),
		color: hexColor
			.nullable()
			.default(null)
			.describe("Colour as #rrggbb; null = the theme's ground colour."),
	})
	.describe("The slab everything stands on, centred on the origin.");

// See docs/adr/0039-saved-viewpoints.md.
export const ViewpointSchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the viewpoints."),
		name: z.string().default("").describe("Shown in the list and in View mode."),
		description: z
			.string()
			.default("")
			.describe("A line shown with it in View mode, e.g. what the data there tells."),
		target: Vec2Schema.default([0, 0]).describe(
			"The ground point [x, z] in the middle of the view.",
		),
		azimuth: z
			.number()
			.default(315)
			.describe(
				"The compass direction the camera looks from, in degrees counter-clockwise seen from above: 0 = from +x, 90 = from -z, 180 = from -x, 270 = from +z. The default view is 315.",
			),
		elevation: z
			.number()
			.min(15)
			.max(87)
			.default(32.5)
			.describe(
				"Degrees above the ground: 87 is nearly straight down, 15 looks low across the world. The default view is 32.5.",
			),
		span: z
			.number()
			.min(2)
			.max(400)
			.default(40)
			.describe("How many grid units fit from the top to the bottom of the view."),
		perspective: z
			.boolean()
			.default(false)
			.describe("A perspective view instead of the flat diorama view."),
	})
	.describe("A saved camera view: jump to it in the editor, or step through them in View mode.");

export const ThemeSchema = z
	.enum(["system", "light", "dark"])
	.describe("Light or dark look; system follows the viewer's device.");

export const SceneSchema = z
	.object({
		version: z.literal(SCENE_VERSION).describe("Format version; always 1 for now."),
		meta: z
			.object({
				title: z.string().default("Untitled world").describe("The world's name, shown on top."),
				subtitle: z.string().default("").describe("A line under the title."),
			})
			.default({ title: "Untitled world", subtitle: "" }),
		theme: ThemeSchema.default("system"),
		ground: GroundSchema.default({ width: 40, depth: 30, color: null }),
		driving: DrivingSideSchema.default("right"),
		turns: TurnsSchema.default("smooth").describe(
			"How vehicles take corners, unless a road or vehicle says otherwise.",
		),
		entities: z.array(EntitySchema).default([]).describe("The objects in the world."),
		roads: z.array(RoadSchema).default([]).describe("Roads, paths and hidden routes."),
		areas: z.array(AreaSchema).default([]).describe("Water, grass, sand, plazas and raised land."),
		data: z
			.array(DataEntrySchema)
			.default([])
			.describe("Named values the world shows on cards and detail tiles."),
		viewpoints: z
			.array(ViewpointSchema)
			.default([])
			.describe("Saved camera views, in the order View mode steps through them."),
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
		checkUnique(
			scene.viewpoints.map((v) => v.id),
			["viewpoints"],
			"viewpoint id",
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
export type TViewpoint = z.output<typeof ViewpointSchema>;
/** Where a viewpoint puts the camera: everything but its id, name and description. */
export type TViewPose = Pick<
	TViewpoint,
	"target" | "azimuth" | "elevation" | "span" | "perspective"
>;
export type TVec2 = z.output<typeof Vec2Schema>;
export type TVec3 = z.output<typeof Vec3Schema>;
