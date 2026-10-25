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

/** A colour as #rrggbb. Also for parts' colour props. */
export const HexColorSchema = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour like #3d4fd6");

/** [x, z] on the ground plane, in grid units. */
export const Vec2Schema = z.tuple([z.number(), z.number()]);
/** [x, y, z] in world units. */
export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const TurnsSchema = z
	.enum(["smooth", "sharp"])
	.describe(
		"How vehicles take corners: smooth turns gradually over about half the vehicle's length, sharp snaps to each new direction.",
	);

/**
 * A setting driven by a data value (ADR-0058): which value, and how it reads.
 * What the value does depends on the setting it drives: switching something
 * on and off, scaling a number, or setting a colour. Options a binding doesn't
 * use are ignored. New options get defaults, so saved bindings stay valid.
 */
export const DataBindingSchema = z
	.object({
		key: z.string().describe("The data value's key."),
		above: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For switching: on while the value is above this. null = 0. The text on, yes or true is always on; other text is off.",
			),
		full: z
			.number()
			.positive()
			.nullable()
			.default(null)
			.describe("For numbers: the value that gives 100% (strength 1). null = 1."),
		low: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For colours, when the value is a number: the value that gives lowColor. null = 0.",
			),
		high: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For colours, when the value is a number: the value that gives highColor; numbers in between mix the two. null = 100.",
			),
		lowColor: HexColorSchema.nullable()
			.default(null)
			.describe("For colours: the colour at low and below, as #rrggbb. null = green (#2bb58c)."),
		highColor: HexColorSchema.nullable()
			.default(null)
			.describe("For colours: the colour at high and above, as #rrggbb. null = red (#e0483b)."),
	})
	.describe("A setting driven by a data value.");

export type TDataBinding = z.output<typeof DataBindingSchema>;

/**
 * An object's setting for one of its part's colours (ADR-0060): null while
 * it's as the part has it (ADR-0027).
 */
export const EntityColorSchema = z
	.object({
		color: HexColorSchema.nullable()
			.default(null)
			.describe("The colour as #rrggbb; null = the part's default for the theme."),
		data: z
			.record(z.string(), DataBindingSchema)
			.default({})
			.describe(
				'A data value that sets it: { "color": { key, low, high, lowColor, highColor } }. A value holding a CSS colour (red, #ff0000, rgb(255, 0, 0), hsl(0, 100%, 50%)) is used as it is; a number mixes lowColor (at low) and highColor (at high), like a heatmap. A value that is neither leaves the colour as set.',
			),
	})
	.describe("An object's setting for one of its part's colours.");

export type TEntityColor = z.output<typeof EntityColorSchema>;

/**
 * When a light is on: auto = as its part has it (after dark; some only while
 * driving), on = always, off = never, schedule = during its schedule's periods.
 */
export const LightModeSchema = z.enum(["auto", "on", "off", "schedule"]);

/** The one setting worlds from before per-light settings had for all an object's lights. */
const OlderLightModeSchema = z.enum(["auto", "on", "off"]);

/**
 * How a light comes on after dark (ADR-0061): atOnce = fully, once it's dark
 * enough; oneByOne = window lights only, their panes one after another as it
 * gets darker; gradually = fading in with the dusk.
 */
export const ComesOnSchema = z.enum(["atOnce", "oneByOne", "gradually"]);

export type TComesOn = z.output<typeof ComesOnSchema>;

/** A stretch of the day, in hours (0–24, 19.5 = 19:30), like one on-period of a timer. */
export const TimePeriodSchema = z
	.object({
		from: z.number().min(0).max(24).describe("When it starts, in hours: 19.5 = 19:30."),
		until: z
			.number()
			.min(0)
			.max(24)
			.describe(
				"When it ends, in hours. Earlier than from runs past midnight (22 to 2); 0 or 24 = midnight.",
			),
	})
	.describe("A period of the day, from–until, in hours.");

export type TTimePeriod = z.output<typeof TimePeriodSchema>;

/**
 * An object's settings for one of its part's lights (ADR-0058). Every field is
 * null while it's as the part has it (ADR-0027).
 */
export const EntityLightSchema = z
	.object({
		mode: LightModeSchema.nullable()
			.default(null)
			.describe(
				"When it's on: auto = after dark (some lights, like headlights, only while driving), on = always, day and night, off = never, schedule = during the periods in schedule (needs a time of day). null = auto.",
			),
		comesOn: ComesOnSchema.nullable()
			.default(null)
			.describe(
				"How it comes on, after dark or on a schedule: atOnce = fully, once it's dark enough (all such lights at the same moment) or exactly for each period (lights with the same schedule switch together); oneByOne = window lights only, their panes one after another as it gets darker, or over the first hour of a period and going dark over the last; gradually = fading in with the dusk, or over a period's first hour and out over its last. null = the part's.",
			),
		schedule: z
			.array(TimePeriodSchema)
			.nullable()
			.default(null)
			.describe(
				'With mode schedule: the periods it\'s on, like a timer, e.g. [{ "from": 5, "until": 8 }, { "from": 19, "until": 24 }]. null or [] = never.',
			),
		color: HexColorSchema.nullable()
			.default(null)
			.describe("Its colour as #rrggbb; null = the part's colour for this light."),
		strength: z
			.number()
			.min(0)
			.max(3)
			.nullable()
			.default(null)
			.describe("How bright it is: 1 = normal, 0 = not at all, up to 3. null = the part's."),
		reach: z
			.number()
			.min(0.2)
			.max(12)
			.nullable()
			.default(null)
			.describe(
				"How far its light reaches on the ground, in grid units, for beams and pools. null = the part's.",
			),
		litPanes: z
			.number()
			.min(0)
			.max(1)
			.nullable()
			.default(null)
			.describe(
				"For window lights: the part of its own panes that are lit, 0 (none) to 1 (all). null = the part's.",
			),
		data: z
			.record(z.string(), DataBindingSchema)
			.default({})
			.describe(
				'Data values that drive its settings, by setting: "on" (switches it on and off instead of mode, day and night), "strength" (value ÷ full, up to 3), "litPanes" (window lights: value ÷ full, up to 1) and "color" (a CSS colour, or a number on a colour scale). Only the settings that follow data.',
			),
	})
	.describe("An object's settings for one of its lights.");

export type TLightMode = z.output<typeof LightModeSchema>;
export type TEntityLight = z.output<typeof EntityLightSchema>;

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
		pitch: z
			.number()
			.min(-60)
			.max(60)
			.default(0)
			.describe(
				"Nose up (positive) or down, in degrees, e.g. a vehicle parked on a sloped road (set when it's dropped on one). Ignored while it follows a road, which tilts it itself.",
			),
		scale: z.number().min(0.1).max(10).default(1).describe("Size factor for the whole part."),
		colors: z
			.record(z.string(), EntityColorSchema)
			.default({})
			.describe(
				'Its part\'s colours (see each kind\'s colours in the catalogue), keyed by the colour\'s id, holding only what differs from the part, e.g. { "roof": { "color": "#c0392b" } }.',
			),
		color: HexColorSchema.nullable()
			.default(null)
			.describe(
				"Older worlds: its first colour as #rrggbb, read when colors doesn't set it. Write colors instead.",
			),
		accent: HexColorSchema.nullable()
			.default(null)
			.describe(
				"Older worlds: its second colour as #rrggbb, read when colors doesn't set it. Write colors instead.",
			),
		props: z
			.record(z.string(), z.unknown())
			.default({})
			.describe("The part's own parameters (see its kind); missing ones use their defaults."),
		label: LabelSchema.nullable()
			.default(null)
			.describe("A floating card with data values above it; null = no card."),
		follow: FollowSchema.nullable()
			.default(null)
			.describe("The road it drives along (vehicles); null = parked where it stands."),
		details: DetailsSchema.default({ description: "", dataKeys: [] }),
		lights: z
			.union([OlderLightModeSchema, z.record(z.string(), EntityLightSchema)])
			.default({})
			.describe(
				'Settings for its part\'s lights (see each kind\'s lights in the catalogue), keyed by the light\'s id, holding only what differs from the part, e.g. { "headlights": { "color": "#ffffff" } }. Worlds from before per-light settings have one value for all its lights instead: auto, on or off.',
			),
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
	.enum(["pillars", "embankment", "none"])
	.describe(
		"What holds up elevated sections: pillars (other roads can pass underneath), a sloped bank, or nothing (the deck floats, e.g. a road on raised land or a bridge between cliffs).",
	);

export const RoadStyleSchema = z
	.enum(["road_01", "dirt_path_01", "hidden_route_01"])
	.describe(
		"Numbered so each can get variants. road_01 = paved road with markings, dirt_path_01 = path, hidden_route_01 = invisible route that only vehicles use (ferry lines, forklift paths).",
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
		style: RoadStyleSchema.default("road_01"),
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
		pillarSpacing: z
			.number()
			.min(1)
			.max(40)
			.default(4)
			.describe("Distance between pillars along elevated sections, in grid units."),
		embankmentAngle: z
			.number()
			.min(10)
			.max(90)
			.default(45)
			.describe(
				"Steepness of the embankment's sides in degrees: 45 = a sloped bank, 90 = straight walls (the road sits on a solid raised block).",
			),
		embankmentWidth: z
			.number()
			.min(0.05)
			.max(1)
			.default(1)
			.describe(
				"Width of the embankment's top as a share of the road's width: 1 = as wide as the road, less = a narrower bank or wall under the middle of the road.",
			),
		embankmentColor: HexColorSchema.nullable()
			.default(null)
			.describe("Embankment colour as #rrggbb; null = the theme's default."),
		railings: z
			.boolean()
			.default(true)
			.describe("Low barriers along the edges of elevated sections."),
		lane: RoadLaneSchema.default("side"),
		turns: TurnsSchema.nullable()
			.default(null)
			.describe("How vehicles on this road take corners; null = the world's setting."),
		color: HexColorSchema.nullable()
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

// See docs/adr/0042-traffic-following-and-passing.md.
export const TrafficSchema = z
	.object({
		spacing: z
			.boolean()
			.default(true)
			.describe(
				"Vehicles on the same road keep their distance behind slower ones; false = each drives at its own speed, through the others.",
			),
		overtaking: z
			.boolean()
			.default(true)
			.describe(
				"Vehicles overtake slower ones when the way is clear (only with spacing on); false = they queue behind.",
			),
	})
	.describe("How vehicles on the same road deal with each other.");

export const AreaTypeSchema = z
	.enum(["water_01", "grass_01", "sand_01", "plaza_01", "raised_land_01"])
	.describe(
		"What the area is (numbered so each can get variants); sets its colour. raised_land_01 is meant for raised ground (rocks, plateaus).",
	);

// See docs/adr/0021-free-form-areas.md.
export const AreaSchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the areas."),
		name: z.string().default("").describe("Shown in the editor."),
		type: AreaTypeSchema.default("grass_01"),
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
		color: HexColorSchema.nullable()
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
		width: z.number().min(4).max(500).default(40).describe("Size along x, in grid units."),
		depth: z.number().min(4).max(500).default(30).describe("Size along z, in grid units."),
		color: HexColorSchema.nullable()
			.default(null)
			.describe("Colour as #rrggbb; null = the theme's ground colour."),
	})
	.describe("The slab everything stands on, centred on the origin.");

const FieldOfViewSchema = z.number().min(1).max(170);

/**
 * How the camera shows the world: orthographic = the flat view the app calls
 * the isometric diorama (far things as big as near ones; isometric only at
 * the default angle, so the value says what the camera is), perspective =
 * through a lens. More may come, so it's a choice, not a yes/no.
 */
export const ProjectionSchema = z.enum(["orthographic", "perspective"]);

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
			.min(-90)
			.max(90)
			.default(32.5)
			.describe(
				"Degrees above the ground: 90 looks straight down, 0 looks level across the world, below 0 looks up (free camera control). The default view is 32.5.",
			),
		targetHeight: z
			.number()
			.default(0)
			.describe(
				"Height of the point in the middle of the view; 0 = on the ground. Above 0 for a view that looks up (elevation below 0).",
			),
		span: z
			.number()
			.min(2)
			.max(400)
			.default(40)
			.describe("How many grid units fit from the top to the bottom of the view."),
		projection: ProjectionSchema.default("orthographic").describe(
			"How the camera shows this view: orthographic = the flat isometric diorama view (far things as big as near ones), perspective = through a lens (fieldOfView).",
		),
		fieldOfView: FieldOfViewSchema.nullable()
			.default(null)
			.describe(
				"With projection perspective: this view's own field of view, in degrees. null = the world's (camera.fieldOfView).",
			),
	})
	.describe("A saved camera view: jump to it in the editor, or step through them in View mode.");

// See docs/adr/0062-camera-settings.md.
export const CameraSettingsSchema = z
	.object({
		openingViewpointId: z
			.string()
			.nullable()
			.default(null)
			.describe(
				"The viewpoint the world opens at for anyone who hasn't looked around it yet (a shared file, another browser), and that re-centring goes back to. null (or an id no viewpoint has) = the whole world from the default angle.",
			),
		openingProjection: ProjectionSchema.default("orthographic").describe(
			"Without an opening viewpoint: how the whole world is shown when it opens and when re-centring, orthographic (the isometric diorama) or perspective.",
		),
		fieldOfView: FieldOfViewSchema.default(40).describe(
			"The perspective camera's field of view, in degrees from the top of the view to the bottom: small looks flat, like the isometric diorama view through a long lens; large exaggerates depth, like a wide-angle lens. A viewpoint can have its own.",
		),
		closestSpan: z
			.number()
			.min(0.05)
			.max(1000)
			.default(2)
			.describe(
				"How close the camera can zoom in: how many grid units still fit from the top to the bottom of the view.",
			),
		farthestSpan: z
			.number()
			.min(1)
			.max(100000)
			.nullable()
			.default(null)
			.describe(
				"How far the camera can zoom out: how many grid units fit from the top to the bottom of the view. null = automatic, from the ground's size.",
			),
		lowestElevation: z
			.number()
			.min(-90)
			.max(90)
			.default(15)
			.describe(
				"How low the camera can tilt, in degrees above the ground: 0 = level with it. Simple camera control never goes below 0.",
			),
		steepestElevation: z
			.number()
			.min(0)
			.max(90)
			.default(87)
			.describe(
				"How steeply the camera can look down, in degrees above the ground (90 = straight down).",
			),
		keepOverGround: z
			.boolean()
			.default(true)
			.describe(
				"Keep the middle of the view over the ground, so panning and zooming can't lose the world.",
			),
		turntable: z
			.boolean()
			.default(false)
			.describe(
				"In View mode, slowly circle the view after a while without input, like a model on a turntable; any input stops it.",
			),
		turntableSpeed: z
			.number()
			.min(-30)
			.max(30)
			.default(4)
			.describe(
				"With turntable: degrees per second the view circles; positive turns the world anticlockwise seen from above, negative clockwise.",
			),
		turntableDelay: z
			.number()
			.min(1)
			.max(300)
			.default(10)
			.describe("With turntable: seconds without input in View mode before it starts."),
		tiltShift: z
			.boolean()
			.default(false)
			.describe(
				"In View mode, blur the top and bottom of the view and keep a band across it sharp, which makes the world look like a miniature (tilt-shift photography).",
			),
		tiltShiftBlur: z
			.number()
			.min(0)
			.max(1)
			.default(0.5)
			.describe("With tiltShift: how strong the blur is, 0–1."),
		tiltShiftFocus: z
			.number()
			.min(0.05)
			.max(1)
			.default(0.3)
			.describe("With tiltShift: how much of the view's height stays sharp, 0–1."),
		tiltShiftPosition: z
			.number()
			.min(0)
			.max(1)
			.default(0.5)
			.describe(
				"With tiltShift: where the sharp band is, from the bottom of the view (0) to the top (1).",
			),
	})
	.describe("How the camera behaves in this world.");

export const OnScreenSchema = z
	.object({
		title: z.boolean().default(true).describe("The world's title, in the top-left corner."),
		subtitle: z.boolean().default(true).describe("The subtitle under the title."),
		timeOfDay: z.boolean().default(true).describe("The time of day under the title."),
		labelCards: z
			.boolean()
			.default(true)
			.describe(
				"Objects' label cards. false hides every card in View mode, whatever each object says.",
			),
		details: z
			.boolean()
			.default(true)
			.describe("The panel with an object's values that opens when it's clicked."),
		viewpointBar: z.boolean().default(true).describe("The bar that steps through the viewpoints."),
	})
	.describe(
		"What viewers see over the world in View mode. Edit mode always shows everything, faded where View mode won't.",
	);

export const ThemeSchema = z
	.enum(["system", "light", "dark"])
	.describe("Light or dark look; system follows the viewer's device.");

// See docs/adr/0052-time-of-day.md. Fields left null follow the time of day.
export const LightingSchema = z
	.object({
		time: z
			.number()
			.min(0)
			.max(24)
			.nullable()
			.default(null)
			.describe(
				"Time of day in hours (0–24, e.g. 6.5 = 06:30): sets the sun's place, its colour and the sky, and turns lights on at night. null = the classic studio daylight, which never changes.",
			),
		timeSource: z
			.enum(["fixed", "cycle", "clock", "data"])
			.default("fixed")
			.describe(
				"Where the time comes from: fixed = `time`; cycle = days pass while motion plays, starting at `time`; clock = the viewer's own local time; data = the value of the data entry `timeKey` (hours, 0–24).",
			),
		dayLength: z
			.number()
			.min(10)
			.max(3600)
			.default(120)
			.describe("With timeSource cycle: how many seconds a whole day takes."),
		timeKey: z
			.string()
			.nullable()
			.default(null)
			.describe("With timeSource data: the key of the data entry that holds the time (hours)."),
		sunAzimuth: z
			.number()
			.min(0)
			.max(360)
			.nullable()
			.default(null)
			.describe(
				"Compass direction the sunlight comes from, in degrees counter-clockwise from +x seen from above (as viewpoints' azimuth). null = from the time of day.",
			),
		sunElevation: z
			.number()
			.min(2)
			.max(90)
			.nullable()
			.default(null)
			.describe("Height of the sun above the horizon, in degrees. null = from the time of day."),
		sunColor: HexColorSchema.nullable()
			.default(null)
			.describe("Colour of the sunlight as #rrggbb. null = from the time of day."),
		sunStrength: z
			.number()
			.min(0)
			.max(3)
			.nullable()
			.default(null)
			.describe("How strong the sunlight is; 1 = normal daylight. null = from the time of day."),
		lights: z
			.enum(["auto", "on", "off"])
			.default("auto")
			.describe(
				"The world's lit windows, lamps, cabins and headlights: auto = after dark (headlights only while driving), on = always, off = never. An object's own `lights` setting other than auto overrides this.",
			),
	})
	.describe("The sun, the sky and the time of day.");

// See docs/adr/0070-sky.md. Colours left null follow the time of day (or the theme).
export const SkySchema = z
	.object({
		showInPerspective: z
			.boolean()
			.default(true)
			.describe(
				"Draw the sky around the world in perspective. false shows the backdrop there too (e.g. a green screen).",
			),
		colorOverhead: HexColorSchema.nullable()
			.default(null)
			.describe(
				"The sky's colour straight up, as #rrggbb: its colour by day, darkening at night. null = from the time of day.",
			),
		colorAtHorizon: HexColorSchema.nullable()
			.default(null)
			.describe(
				"The sky's colour at the horizon, as #rrggbb: its colour by day, darkening at night. null = from the time of day.",
			),
		showSun: z
			.boolean()
			.default(true)
			.describe("Show the sun in the sky by day, where the sunlight comes from."),
		showMoon: z
			.boolean()
			.default(true)
			.describe("Show the moon in the sky at night, opposite the sun."),
		starDensity: z
			.number()
			.min(0)
			.max(1)
			.default(0.6)
			.describe("How many stars come out at night: 0 = none, 1 = a full starry sky."),
		cloudCover: z
			.number()
			.min(0)
			.max(1)
			.default(0.3)
			.describe("How cloudy it is: 0 = clear, 1 = many low-poly clouds around the world."),
		cloudColor: HexColorSchema.nullable()
			.default(null)
			.describe("The clouds' colour, as #rrggbb. null = white, tinted by the time of day."),
		cloudSpeed: z
			.number()
			.min(0)
			.max(5)
			.default(1)
			.describe("How fast the clouds drift while motion plays: 0 = still, 1 = a gentle breeze."),
	})
	.describe(
		"The sky around the world in perspective: its colours, the sun and moon, stars and clouds. The isometric diorama shows the backdrop instead.",
	);

export const BackdropSchema = z
	.object({
		kind: z
			.enum(["sky", "color", "gradient", "greenScreen"])
			.default("sky")
			.describe(
				"What's behind the world in the isometric diorama: sky = the sky's colour for the time of day (the theme's background in classic daylight); color = `color`; gradient = from `gradientStart` to `gradientEnd` at `gradientAngle`; greenScreen = pure green (#00ff00), to key the world out in a video editor.",
			),
		color: HexColorSchema.nullable()
			.default(null)
			.describe("With kind color, the colour, as #rrggbb. null = the theme's background."),
		gradientStart: HexColorSchema.nullable()
			.default(null)
			.describe("With kind gradient, where it starts, as #rrggbb. null = the theme's background."),
		gradientEnd: HexColorSchema.nullable()
			.default(null)
			.describe("With kind gradient, where it ends, as #rrggbb. null = the theme's background."),
		gradientAngle: z
			.number()
			.min(0)
			.max(360)
			.default(180)
			.describe(
				"With kind gradient, which way it runs, in degrees clockwise from going up (as CSS): 180 = top to bottom, 90 = left to right.",
			),
	})
	.describe(
		"What's behind the world in the isometric diorama (and in perspective when the sky isn't shown there).",
	);

export const SceneSchema = z
	.object({
		version: z.literal(SCENE_VERSION).describe("Format version; always 1 for now."),
		meta: z
			.object({
				title: z.string().default("Untitled world").describe("The world's name, shown on top."),
				subtitle: z.string().default("").describe("A line under the title."),
			})
			.default({ title: "Untitled world", subtitle: "" })
			.describe("The world's title and subtitle."),
		theme: ThemeSchema.default("system"),
		ground: GroundSchema.default({ width: 40, depth: 30, color: null }),
		driving: DrivingSideSchema.default("right"),
		turns: TurnsSchema.default("smooth").describe(
			"How vehicles take corners, unless a road or vehicle says otherwise.",
		),
		traffic: TrafficSchema.default({ spacing: true, overtaking: true }),
		lighting: LightingSchema.default({
			time: null,
			timeSource: "fixed",
			dayLength: 120,
			timeKey: null,
			sunAzimuth: null,
			sunElevation: null,
			sunColor: null,
			sunStrength: null,
			lights: "auto",
		}),
		sky: SkySchema.default({
			showInPerspective: true,
			colorOverhead: null,
			colorAtHorizon: null,
			showSun: true,
			showMoon: true,
			starDensity: 0.6,
			cloudCover: 0.3,
			cloudColor: null,
			cloudSpeed: 1,
		}),
		backdrop: BackdropSchema.default({
			kind: "sky",
			color: null,
			gradientStart: null,
			gradientEnd: null,
			gradientAngle: 180,
		}),
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
		onScreen: OnScreenSchema.default({
			title: true,
			subtitle: true,
			timeOfDay: true,
			labelCards: true,
			details: true,
			viewpointBar: true,
		}),
		camera: CameraSettingsSchema.default({
			openingViewpointId: null,
			openingProjection: "orthographic",
			fieldOfView: 40,
			closestSpan: 2,
			farthestSpan: null,
			lowestElevation: 15,
			steepestElevation: 87,
			keepOverGround: true,
			turntable: false,
			turntableSpeed: 4,
			turntableDelay: 10,
			tiltShift: false,
			tiltShiftBlur: 0.5,
			tiltShiftFocus: 0.3,
			tiltShiftPosition: 0.5,
		}),
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
export type TTraffic = z.output<typeof TrafficSchema>;
export type TThemePreference = z.output<typeof ThemeSchema>;
export type TLighting = z.output<typeof LightingSchema>;
export type TSky = z.output<typeof SkySchema>;
export type TBackdrop = z.output<typeof BackdropSchema>;
export type TCameraSettings = z.output<typeof CameraSettingsSchema>;
export type TOnScreen = z.output<typeof OnScreenSchema>;
export type TViewpoint = z.output<typeof ViewpointSchema>;
export type TProjection = z.output<typeof ProjectionSchema>;
/** Where a viewpoint puts the camera: everything but its id, name and description. */
export type TViewPose = Pick<
	TViewpoint,
	"target" | "targetHeight" | "azimuth" | "elevation" | "span" | "projection" | "fieldOfView"
>;
export type TVec2 = z.output<typeof Vec2Schema>;
export type TVec3 = z.output<typeof Vec3Schema>;
