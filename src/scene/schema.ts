import { z } from "zod";

/**
 * The scene document is the single source of truth for a world.
 * The renderer, editor, persistence and (future) AI generation all read and
 * write this shape. See docs/adr/0003-scene-as-json-document.md, and
 * docs/adr/0104-world-format-before-going-public.md for how fields are named
 * and grouped.
 *
 * Field meanings live in `.describe()` text so they reach /schema.json, where
 * people and AIs writing worlds read them (ADR-0032); comments are for code.
 *
 * Every world ever saved keeps opening (ADR-0106): add fields with defaults,
 * rename or move them through legacy.ts, and never change what a field means.
 * SCENE_VERSION moves only for what those can't do, with a step in ./migrate.ts.
 */
export const SCENE_VERSION = 1;

/** A colour as #rrggbb. Also for parts' colour props. */
export const HexColorSchema = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour like #3d4fd6");

/** [x, z] on the ground plane, in grid units. */
export const Vec2Schema = z.tuple([z.number(), z.number()]);
/** [x, y, z] in grid units, y up. */
export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const TurnStyleSchema = z
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
		switchesOnAbove: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For switching: on while the value is above this. null = 0. The text on, yes or true is always on; other text is off.",
			),
		valueAtFull: z
			.number()
			.positive()
			.nullable()
			.default(null)
			.describe("For numbers: the value that gives 100% (strength 1). null = 1."),
		valueAtLowColor: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For colours, when the value is a number: the value that gives lowColor (and below). null = 0.",
			),
		valueAtHighColor: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For colours, when the value is a number: the value that gives highColor; numbers in between mix the two. null = 100.",
			),
		lowColor: HexColorSchema.nullable()
			.default(null)
			.describe(
				"For colours: the colour at valueAtLowColor and below, as #rrggbb. null = green (#2bb58c).",
			),
		highColor: HexColorSchema.nullable()
			.default(null)
			.describe(
				"For colours: the colour at valueAtHighColor and above, as #rrggbb. null = red (#e0483b).",
			),
		valueAtLowSetting: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For sizes and amounts (an object's props and scale, a road's width and traffic): the value that gives lowSetting (and below). null = 0, or 1 on a log scale.",
			),
		valueAtHighSetting: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For sizes and amounts: the value that gives highSetting (and above); values in between are placed between the two, on a straight or a log scale. null = 100.",
			),
		lowSetting: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For sizes and amounts: what the setting is at valueAtLowSetting. null = the setting's smallest (its field's minimum).",
			),
		highSetting: z
			.number()
			.nullable()
			.default(null)
			.describe(
				"For sizes and amounts: what the setting is at valueAtHighSetting. null = the setting's largest (its field's maximum).",
			),
		usesLogScale: z
			.boolean()
			.default(false)
			.describe(
				"For sizes and amounts: whether values are placed on a log scale, so 100 is as far above 10 as 1,000 is above 100 (player counts, populations); false = a straight scale.",
			),
	})
	.describe(
		'A setting driven by a data value. Its key names one of the world\'s values, or, for an object or road that follows a table row (dataRow), a column of its row as "row.<column>".',
	);

export type TDataBinding = z.output<typeof DataBindingSchema>;
export type TDataBindingInput = z.input<typeof DataBindingSchema>;

/** Settings that follow data, by setting (ADR-0058), described with what each one reads. */
const dataBindings = (meaning: string) =>
	z.record(z.string(), DataBindingSchema).default({}).describe(meaning);

/**
 * A setting for one of a thing's colours (ADR-0060): an object's part's, a
 * fence's, a road's, an area's or the ground's, by the colour's id. Each field
 * is null while it's as the thing has it (ADR-0027).
 */
export const ColorSettingSchema = z
	.object({
		color: HexColorSchema.nullable()
			.default(null)
			.describe("The colour as #rrggbb; null = its default for the theme."),
		transparency: z
			.number()
			.min(0)
			.max(1)
			.nullable()
			.default(null)
			.describe(
				"For see-through colours (glass), how see-through it is: 0 = solid, 1 = clear. null = its default. Ignored for colours that aren't see-through.",
			),
		data: dataBindings(
			'A data value that sets it: { "color": { key, valueAtLowColor, valueAtHighColor, lowColor, highColor } }. A value holding a CSS colour (red, #ff0000, rgb(255, 0, 0), hsl(0, 100%, 50%)) is used as it is; a number mixes lowColor (at valueAtLowColor) and highColor (at valueAtHighColor), like a heatmap. A value that is neither leaves the colour as set.',
		),
	})
	.describe("A setting for one colour.");

export type TColorSetting = z.output<typeof ColorSettingSchema>;

/** A thing's colours, by id, holding only what differs from its defaults. */
const colorSettings = (example: string) =>
	z
		.record(z.string(), ColorSettingSchema)
		.default({})
		.describe(
			`Settings for its colours, keyed by the colour's id, holding only what differs from its defaults, e.g. ${example}.`,
		);

/**
 * When a light is on: auto = as its part has it (after dark; some only while
 * driving), on = always, off = never, schedule = during its schedule's periods.
 */
export const LightModeSchema = z.enum(["auto", "on", "off", "schedule"]);

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
		whenOn: LightModeSchema.nullable()
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
				'With whenOn schedule: the periods it\'s on, like a timer, e.g. [{ "from": 5, "until": 8 }, { "from": 19, "until": 24 }]. null or [] = never.',
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
		litPaneShare: z
			.number()
			.min(0)
			.max(1)
			.nullable()
			.default(null)
			.describe(
				"For window lights: the share of its own panes that are lit, 0 (none) to 1 (all). null = the part's.",
			),
		paneWeight: z
			.number()
			.min(0)
			.max(100)
			.nullable()
			.default(null)
			.describe(
				"For window lights: how many of the building's panes are its, against its other window lights' paneWeight (90 and 10: nine panes in ten are its). Changing it moves which panes are whose. null = the part's.",
			),
		data: dataBindings(
			'Data values that drive its settings, by setting: "on" (switches it on and off instead of whenOn, day and night), "strength" (value ÷ valueAtFull, up to 3), "litPaneShare" (window lights: value ÷ valueAtFull, up to 1), "color" (a CSS colour, or a number on a colour scale) and "schedule" (with whenOn schedule: a text value of times of day, like opening hours, "09:00-17:30" or "7-9, 16:30-19", instead of the periods in schedule). Only the settings that follow data.',
		),
	})
	.describe("An object's settings for one of its lights.");

export type TLightMode = z.output<typeof LightModeSchema>;
export type TEntityLight = z.output<typeof EntityLightSchema>;

export const LabelSchema = z
	.object({
		isShown: z
			.boolean()
			.default(true)
			.describe("Whether the card shows; false keeps its settings while it's hidden."),
		title: z.string().default("").describe("Heading on the card."),
		dataKeys: z
			.array(z.string())
			.default([])
			.describe(
				'Keys of the world\'s data values, or "row.<column>" for a column of the row it follows (dataRow). One key shows as a big number, several as rows.',
			),
		offset: Vec3Schema.default([0, 2, 0]).describe(
			"Where the card floats, as [x, y, z] in grid units from the top of the part.",
		),
		tag: z
			.string()
			.default("")
			.describe('A short word shown beside the title, e.g. "home" or "new"; empty = none.'),
	})
	.describe("A floating card above the object showing data values.");

export type TLabel = z.output<typeof LabelSchema>;

/** The label settings of an object that has never had a card. */
export const NO_LABEL: TLabel = {
	isShown: false,
	title: "",
	dataKeys: [],
	offset: [0, 2, 0],
	tag: "",
};

export const FollowSchema = z
	.object({
		roadId: z.string().describe("Id of the road (or hidden route) to drive along."),
		speed: z.number().min(0).max(50).default(2).describe("Grid units per second."),
		startDistance: z
			.number()
			.default(0)
			.describe(
				"Where it starts: the distance along the road from its first point, in grid units (also when it drives the other way).",
			),
		drivesTheOtherWay: z
			.boolean()
			.default(false)
			.describe(
				"Whether it drives the road the other way: against the order of its points, in the opposite lane. Loops go round the other way; open roads set off backwards.",
			),
		turnStyle: TurnStyleSchema.nullable()
			.default(null)
			.describe(
				"How this vehicle takes corners; null = the road's (traffic.turnStyle), else the world's.",
			),
		leansInTurns: z
			.boolean()
			.nullable()
			.default(null)
			.describe(
				"Whether this vehicle leans in turns (boats into them), if its kind does; null = the road's (traffic.leansInTurns), else the world's.",
			),
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
			.describe(
				'Data keys shown as tiles when the object is opened in view mode: the world\'s values, or "row.<column>" for a column of the row it follows.',
			),
	})
	.describe("What view mode shows when someone clicks the object.");

const isLocked = (what: string) =>
	z.boolean().default(false).describe(`Whether ${what} can't be moved in the editor.`);

const isHidden = (extra = "") =>
	z
		.boolean()
		.default(false)
		.describe(
			`Whether it isn't drawn${extra} (it's still listed in the editor's outliner, and kept in the file).`,
		);

/**
 * Which row of which of the world's tables a thing follows (ADR-0108): by the
 * table's key and the row's value in the table's key column.
 */
export const DataRowRefSchema = z
	.object({
		tableKey: z.string().describe("The key of one of the world's data tables."),
		rowKey: z
			.string()
			.describe(
				"The row: its value in the table's key column (or its number, from 1, when the table has none).",
			),
	})
	.describe("A row of one of the world's tables.");

export type TDataRowRef = z.output<typeof DataRowRefSchema>;

/** Degrees around one axis, kept within half a turn either way. */
const HalfTurnSchema = z.number().min(-180).max(180);

export const EntitySchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the objects."),
		// Validated against the part registry (src/parts/registry.ts) at render time, not here.
		kind: z.string().min(1).describe("Which part this is."),
		name: z.string().default("").describe("Shown in the editor; empty uses the part's name."),
		position: Vec2Schema.default([0, 0]).describe(
			"Where the part stands: [x, z] in grid units, the centre of its footprint. Ignored while it follows a road.",
		),
		altitude: z
			.number()
			.default(0)
			.describe(
				"How high above the base ground it stands, in grid units: 0 = on the ground slab, above 0 on raised land or floating, below 0 sunk into the ground.",
			),
		rotation: z
			.tuple([HalfTurnSchema, z.number(), HalfTurnSchema])
			.default([0, 0, 0])
			.describe(
				"Degrees around its axes, as [x, y, z]: first y (the vertical: counter-clockwise seen from above), then z, then x, each about the object's own axes after the turns before. At [0, 0, 0] the front faces +z and vehicles face +x, so z tips a vehicle's nose up (positive) or down and leans other things sideways, and x rolls a vehicle onto a side and tips other things forward or back. While it follows a road only y counts, turning it relative to the road.",
			),
		scale: z.number().min(0.1).max(10).default(1).describe("Size factor for the whole part."),
		colors: colorSettings(
			'{ "roof": { "color": "#c0392b" } } (see each kind\'s colours in its description)',
		),
		props: z
			.record(z.string(), z.unknown())
			.default({})
			.describe("The part's own parameters (see its kind); missing ones use their defaults."),
		label: LabelSchema.default(NO_LABEL).describe(
			"A floating card with data values above it, shown while isShown.",
		),
		follow: FollowSchema.nullable()
			.default(null)
			.describe("The road it drives along (vehicles); null = parked where it stands."),
		details: DetailsSchema.default({ description: "", dataKeys: [] }),
		lights: z
			.record(z.string(), EntityLightSchema)
			.default({})
			.describe(
				'Settings for its part\'s lights (see each kind\'s lights in its description), keyed by the light\'s id, holding only what differs from the part, e.g. { "headlights": { "color": "#ffffff" } }.',
			),
		dataRow: DataRowRefSchema.nullable()
			.default(null)
			.describe(
				'The table row it follows: its cards, tiles, colours, lights and sizes can read that row\'s columns as "row.<column>". null = none.',
			),
		data: dataBindings(
			'Its sizes and props that follow data, keyed by the prop\'s name, or "scale" for its size: { "builtShare": { key: "row.players", usesLogScale: true, valueAtLowSetting: 1000, valueAtHighSetting: 100000 } }. Numbers are placed between lowSetting and highSetting; on and off props switch.',
		),
		isLocked: isLocked("it"),
		isHidden: isHidden(),
	})
	.describe("An object in the world: a building, vehicle, tree, marker…");

/** A value as data holds it: a number or a short text. */
const DataCellSchema = z.union([z.number(), z.string()]);

/** A value as data holds it. */
export type TDataCell = z.output<typeof DataCellSchema>;

/** A key that other things refer to: lowercase letters, numbers and underscores. */
const DataKeySchema = z
	.string()
	.regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores");

/**
 * Where a value or a table is read from (data study): one of the world's
 * sources, and where in it. Null on the thing itself = typed by hand.
 */
export const DataSourceRefSchema = z
	.object({
		sourceId: z.string().describe("The id of one of the world's data sources."),
		path: z
			.string()
			.default("")
			.describe(
				'Where in the source: a JSON path for links and APIs ("totalUsers", "data.0.rank"; empty = the whole response); in a spreadsheet, the column a value is read from ("sent", or "Stats!sent" in another sheet), the row it is named by when each row is a value ("Population"), or the sheet a table is ("Stats"; empty = the only or first one).',
			),
		field: z
			.string()
			.default("")
			.describe(
				'For a value over time read from a list (links and APIs): the field of each entry holding the value ("sent"); empty = a single value at path.',
			),
		dateField: z
			.string()
			.default("")
			.describe(
				'For a value over time read from a list: the field of each entry holding its date ("day"); the entries become its past values, the latest its value now.',
			),
		maxRowCount: z
			.number()
			.int()
			.min(1)
			.nullable()
			.default(null)
			.describe(
				"For a table: keeps at most this many rows, the first ones read (a 10,000-row leaderboard's top 100); null = all.",
			),
	})
	.describe("Where a value or a table is read from.");

/**
 * A line a value is watched against (ADR-0110): crossing it flags the value on
 * cards and tiles with a word and a symbol, never by colour alone.
 */
export const DataThresholdSchema = z
	.object({
		line: z.number().describe("The value it's watched against."),
		flagsWhen: z
			.enum(["above", "below"])
			.default("below")
			.describe("Whether it's flagged when the value is above the line or below it."),
		word: z
			.string()
			.default("Watch")
			.describe('The word shown with a ⚠ when it\'s flagged, e.g. "Watch" or "Low".'),
	})
	.describe("A line a value is watched against.");

export type TDataThreshold = z.output<typeof DataThresholdSchema>;

/** One past value, for trends and sparklines (data study). */
export const DataPointSchema = z
	.object({
		at: z
			.string()
			.describe(
				'When, as an ISO 8601 date or date and time: "2026-10-30" or "2026-10-30T14:00:00Z".',
			),
		value: DataCellSchema.describe("The value then."),
	})
	.describe("A value at a moment.");

export const DataValueSchema = z
	.object({
		key: DataKeySchema.describe(
			"Unique name that cards, tiles and settings refer to: lowercase letters, numbers and underscores.",
		),
		name: z.string().default("").describe("Human-readable name shown next to the value."),
		value: DataCellSchema.describe(
			"The value: a number or a short text. Read from its source, it's the last value read.",
		),
		unit: z.string().default("").describe('Shown after the value, e.g. "%" or "km/h".'),
		source: DataSourceRefSchema.nullable()
			.default(null)
			.describe("Where it's read from; null = typed by hand."),
		history: z
			.array(DataPointSchema)
			.default([])
			.describe("Its past values, oldest first, for trends and sparklines; [] = none kept."),
		threshold: DataThresholdSchema.nullable()
			.default(null)
			.describe("A line it's watched against, flagged on cards and tiles; null = none."),
		about: z
			.string()
			.default("")
			.describe(
				'A note shown with it where it\'s shown in full (detail tiles), e.g. "Example numbers, not from Steam"; empty = none.',
			),
	})
	.describe("A named value that cards, detail tiles and settings show or follow.");

/** A table's column (data study). */
export const DataColumnSchema = z
	.object({
		key: DataKeySchema.describe("The column's name in the rows and in settings that follow it."),
		name: z.string().default("").describe("Human-readable name; empty = its key."),
		unit: z.string().default("").describe('Shown after its values, e.g. "%".'),
		field: z
			.string()
			.default("")
			.describe(
				'Read from a link or API: the field of each entry it\'s read from ("rankScore", "stats.kills"); empty = its key.',
			),
		threshold: DataThresholdSchema.nullable()
			.default(null)
			.describe("A line every row's value in it is watched against; null = none."),
		about: z
			.string()
			.default("")
			.describe(
				'A note shown with its values in detail tiles, e.g. "Example numbers, not from Steam"; empty = none.',
			),
	})
	.describe("A column of a table.");

export const DataTableSchema = z
	.object({
		key: DataKeySchema.describe("Unique name that objects refer to, among the tables."),
		name: z.string().default("").describe("Human-readable name."),
		source: DataSourceRefSchema.nullable()
			.default(null)
			.describe("Where it's read from; null = typed by hand."),
		keyColumn: z
			.string()
			.default("")
			.describe("The column that names each row (an id, a name); empty = rows by their order."),
		columns: z.array(DataColumnSchema).default([]).describe("Its columns, in order."),
		rows: z
			.array(z.record(z.string(), DataCellSchema.nullable()))
			.default([])
			.describe("Its rows, each by column key; read from its source, the last rows read."),
		history: z
			.array(
				z.object({
					at: z.string().describe('When, as an ISO 8601 date or date and time: "2026-10-30".'),
					rows: z
						.array(z.record(z.string(), DataCellSchema.nullable()))
						.describe("Its rows then, as rows."),
				}),
			)
			.default([])
			.describe(
				"Its rows at past moments, oldest first, for trends and stories (only as its source gives them: a dated file, an API with dates); [] = none.",
			),
	})
	.describe("A table of rows: objects can each take one, and follow its columns.");

export const DataSourceKindSchema = z
	.enum(["file", "link", "api", "push"])
	.describe(
		"How it's read: file = a spreadsheet (CSV or Excel) imported by hand, read again by importing again; link = a CSV or JSON URL; api = a JSON API that may need keys; push = values sent to the world.",
	);

export const DataSourceSchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the sources."),
		name: z.string().default("").describe("Human-readable name."),
		kind: DataSourceKindSchema,
		url: z.string().nullable().default(null).describe("With kind link or api: where to read it."),
		fileName: z
			.string()
			.nullable()
			.default(null)
			.describe("With kind file: the file it was imported from."),
		refreshSeconds: z
			.number()
			.min(10)
			.nullable()
			.default(null)
			.describe(
				"How often to read it again while the world is open, in seconds; null = only when asked.",
			),
		lastReadAt: z
			.string()
			.nullable()
			.default(null)
			.describe("When its values and tables were last read, as an ISO 8601 date and time."),
		pageUrl: z
			.string()
			.nullable()
			.default(null)
			.describe(
				"A page people can open to see where the data comes from (shown as the source's link); null = none.",
			),
		about: z
			.string()
			.default("")
			.describe(
				'A note about the data shown with it: what it covers, how good it is ("Steam only, last 30 days", "Example numbers, not from Steam").',
			),
	})
	.describe("Where some of the world's data comes from.");

/** The world's data (data study): its values, tables and where they come from. */
export const WorldDataSchema = z
	.object({
		values: z
			.array(DataValueSchema)
			.default([])
			.describe("Named values cards, tiles and settings show or follow."),
		tables: z.array(DataTableSchema).default([]).describe("Tables whose rows objects can take."),
		sources: z
			.array(DataSourceSchema)
			.default([])
			.describe("Where values and tables are read from."),
	})
	.describe("The world's data: values, tables and their sources.");

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
		"A road control point: [x, z], [x, z, altitude] or [x, z, altitude, width], in grid units. An altitude above 0 lifts the road there above the base ground (bridges, flyovers); a width there overrides the road's width, easing in from the neighbouring points.",
	);

export const RoadHeldUpBySchema = z
	.enum(["pillars", "embankment", "none"])
	.describe(
		"What holds up elevated sections: pillars (other roads can pass underneath), an embankment (a sloped bank), or nothing (the deck floats, e.g. a road on raised land or a bridge between cliffs).",
	);

export const RoadKindSchema = z
	.enum(["road_01", "dirt_path_01", "hidden_route_01"])
	.describe(
		"Numbered so each can get variants. road_01 = paved road with markings, dirt_path_01 = path, hidden_route_01 = invisible route that only vehicles use (ferry lines, forklift paths).",
	);

// See docs/adr/0022-centre-lane-roads.md.
export const DrivingLaneSchema = z
	.enum(["side", "centre"])
	.describe(
		"Where vehicles drive: in a lane on the world's driving side, or down the centre (one-way roads, race tracks).",
	);

/** How vehicles behave on one road: its own settings, and the world's `traffic` ones it overrides. */
export const RoadTrafficSchema = z
	.object({
		drivingLane: DrivingLaneSchema.default("side"),
		turnStyle: TurnStyleSchema.nullable()
			.default(null)
			.describe("How vehicles on this road take corners; null = the world's (traffic.turnStyle)."),
		leansInTurns: z
			.boolean()
			.nullable()
			.default(null)
			.describe(
				"Whether vehicles on this road lean in turns; null = the world's (traffic.leansInTurns).",
			),
	})
	.describe("How vehicles drive on this road.");

/**
 * A flow along a road (ADR-0112): vehicles that show how much goes from its
 * first point to its last and back, by how many there are and which way they
 * drive, readable without colour. Drawn by the road itself; they aren't objects.
 */
export const RoadFlowSchema = z
	.object({
		isOn: z
			.boolean()
			.default(false)
			.describe(
				"Whether vehicles drive along it showing a flow (they aren't objects of the world).",
			),
		vehicleKind: z
			.string()
			.default("car_01")
			.describe("Which vehicle part drives it, e.g. car_01, truck_01, bus_01."),
		vehicleCountAlong: z
			.number()
			.int()
			.min(0)
			.max(40)
			.default(4)
			.describe(
				"How many vehicles drive from its first point to its last (in the order of its points); data can set it (data.vehicleCountAlong).",
			),
		vehicleCountAgainst: z
			.number()
			.int()
			.min(0)
			.max(40)
			.default(0)
			.describe(
				"How many drive the other way, from its last point to its first; data can set it (data.vehicleCountAgainst).",
			),
		speed: z.number().min(0.2).max(20).default(3).describe("Grid units per second."),
		showsArrows: z
			.boolean()
			.default(true)
			.describe("Whether arrows on the road point the way the bigger flow goes."),
	})
	.describe("Vehicles along the road showing a flow: how much, and which way.");

export type TRoadFlow = z.output<typeof RoadFlowSchema>;

// See docs/adr/0017-drawable-roads.md and 0018-elevated-roads-and-road-editing.md.
export const RoadSchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the roads; vehicles refer to it."),
		kind: RoadKindSchema.default("road_01"),
		name: z.string().default("").describe("Shown in the editor."),
		points: z
			.array(RoadPointSchema)
			.min(2)
			.describe(
				"Control points in drawing order; the road passes through the first and last (unless it loops). This order is a vehicle's forward direction.",
			),
		loops: z
			.boolean()
			.default(false)
			.describe("Whether it loops back from the last point to the first."),
		width: z.number().min(0.4).max(20).default(2.4).describe("Width in grid units."),
		cornerRadius: z
			.number()
			.min(0)
			.max(50)
			.default(3)
			.describe("Radius of the curve at each corner, in grid units; 0 = sharp corners."),
		showsCentreLine: z
			.boolean()
			.default(true)
			.describe("Whether it shows a centre line (kinds with markings only)."),
		heldUpBy: RoadHeldUpBySchema.default("pillars"),
		pillarSpacing: z
			.number()
			.min(1)
			.max(40)
			.default(4)
			.describe("With heldUpBy pillars: the distance between pillars, in grid units."),
		embankmentAngle: z
			.number()
			.min(10)
			.max(90)
			.default(45)
			.describe(
				"With heldUpBy embankment: the steepness of its sides in degrees; 45 = a sloped bank, 90 = straight walls (the road sits on a solid raised block).",
			),
		embankmentWidth: z
			.number()
			.min(0.05)
			.max(1)
			.default(1)
			.describe(
				"With heldUpBy embankment: the width of its top as a share of the road's width; 1 = as wide as the road, less = a narrower bank or wall under the middle of the road.",
			),
		showsRailings: z
			.boolean()
			.default(true)
			.describe("Whether elevated sections have low barriers along their edges."),
		traffic: RoadTrafficSchema.default(() => RoadTrafficSchema.parse({})),
		colors: colorSettings(
			'{ "surface": { "color": "#3a3a3a" } }; its colours are surface and embankment',
		),
		flow: RoadFlowSchema.default(() => RoadFlowSchema.parse({})),
		dataRow: DataRowRefSchema.nullable()
			.default(null)
			.describe(
				'The table row it follows, e.g. a row of a "from, to, amount" table: its width, flow and colours can read the row\'s columns as "row.<column>". null = none.',
			),
		data: dataBindings(
			'Its settings that follow data: "width", "vehicleCountAlong", "vehicleCountAgainst", e.g. { "vehicleCountAlong": { key: "row.amount", valueAtLowSetting: 0, valueAtHighSetting: 1000, lowSetting: 0, highSetting: 12 } }.',
		),
		isLocked: isLocked("its points"),
		isHidden: isHidden(
			", and vehicles can't be dropped onto it; vehicles already on it keep driving",
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
		drivingSide: DrivingSideSchema.default("right"),
		turnStyle: TurnStyleSchema.default("smooth").describe(
			"How vehicles take corners, unless a road or vehicle says otherwise.",
		),
		leansInTurns: z
			.boolean()
			.default(true)
			.describe(
				"Whether vehicles lean in turns, as far as their kind does (boats into them), unless a road or vehicle says otherwise.",
			),
		keepsDistance: z
			.boolean()
			.default(true)
			.describe(
				"Whether vehicles on the same road keep their distance behind slower ones; false = each drives at its own speed, through the others.",
			),
		overtakes: z
			.boolean()
			.default(true)
			.describe(
				"Whether vehicles overtake slower ones when the way is clear (only with keepsDistance); false = they queue behind.",
			),
	})
	.describe(
		"How vehicles drive and deal with each other. A road's traffic and a vehicle's follow can override some.",
	);

export const AreaKindSchema = z
	.enum(["water_01", "grass_01", "sand_01", "plaza_01", "raised_land_01"])
	.describe(
		"What the area is (numbered so each can get variants); sets its colour. raised_land_01 is meant for raised ground (rocks, plateaus).",
	);

// See docs/adr/0096-area-corner-heights.md.
export const AreaPointSchema = z
	.union([z.tuple([z.number(), z.number(), z.number().min(-30).max(30)]), Vec2Schema])
	.describe(
		"An area corner: [x, z], or [x, z, lift] to raise (or, negative, lower) the area's top at this corner by lift above its height: slopes, ramps and hills. The top never goes below the ground.",
	);

/** A water area's own water, overriding the world's `water` (ADR-0075). */
export const AreaWaterSchema = z
	.object({
		rippleStrength: z
			.number()
			.min(0)
			.max(1)
			.nullable()
			.default(null)
			.describe(
				"How rippled its surface is, 0 = mirror-calm, 1 = choppy (seen where the viewer's graphics settings show water reflections). null = the world's (water.rippleStrength).",
			),
		reflectionStrength: z
			.number()
			.min(0)
			.max(1)
			.nullable()
			.default(null)
			.describe(
				"How strongly it mirrors the world, 0 = not at all (only its ripples catch the lights), 1 = fully (seen where the viewer's graphics settings show water reflections). null = the world's (water.reflectionStrength).",
			),
	})
	.describe("With kind water_01: its own water, where it differs from the world's.");

// See docs/adr/0021-free-form-areas.md.
export const AreaSchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the areas."),
		kind: AreaKindSchema.default("grass_01"),
		name: z.string().default("").describe("Shown in the editor."),
		points: z
			.array(AreaPointSchema)
			.min(3)
			.describe("Outline corners as [x, z] or [x, z, lift], in order; the outline always closes."),
		height: z
			.number()
			.min(0)
			.max(30)
			.default(0)
			.describe(
				"How high its top stands above the base ground, in grid units: 0 = flat on the ground, above 0 = raised with cliff sides. Corners with a lift stand that much higher or lower.",
			),
		peaks: z
			.array(z.tuple([z.number(), z.number(), z.number().min(-30).max(30)]))
			.default([])
			.describe(
				"Points inside the area with a height of their own, as [x, z, lift]: the top rises (or, negative, dips) to height + lift there, sloping to the corners, for round hills and hollows. Never below the ground. Water stays level and ignores them.",
			),
		colors: colorSettings('{ "surface": { "color": "#4f9a55" } }; its colour is surface'),
		water: AreaWaterSchema.default(() => AreaWaterSchema.parse({})),
		isLocked: isLocked("its corners"),
		isHidden: isHidden(),
	})
	.describe("A free-form area on the ground (water, lawn, beach, square…) or raised land.");

export const FenceKindSchema = z
	.enum([
		"picket_fence_01",
		"rail_fence_01",
		"chain_link_fence_01",
		"stone_wall_01",
		"hedge_01",
		"railing_01",
		"guard_rail_01",
	])
	.describe(
		"What the fence looks like (numbered so each can get variants): picket_fence_01 = white garden pickets, rail_fence_01 = a farm's wooden rails, chain_link_fence_01 = a tall wire mesh on metal posts, stone_wall_01 = a low dry-stone wall, hedge_01 = a clipped hedge, railing_01 = a metal railing (quays, bridges), guard_rail_01 = a roadside crash barrier.",
	);

// See docs/adr/0103-fences.md.
export const FencePointSchema = z
	.union([
		z.tuple([z.number(), z.number(), z.number().min(0).max(50)]),
		z
			.tuple([z.number(), z.number()])
			.transform(([x, zPos]): [number, number, number] => [x, zPos, 0]),
	])
	.describe(
		"A fence point: [x, z], or [x, z, lift] to raise the fence that far above the ground there (on a wall, along a bridge). The fence otherwise stands on the ground under it, raised land and slopes included.",
	);

// See docs/adr/0103-fences.md.
export const FenceSchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the fences."),
		kind: FenceKindSchema.default("picket_fence_01"),
		name: z.string().default("").describe("Shown in the editor."),
		points: z
			.array(FencePointSchema)
			.min(2)
			.describe("Points in drawing order; posts stand at each one and are spaced in between."),
		loops: z
			.boolean()
			.default(false)
			.describe("Whether it closes from the last point back to the first."),
		cornerRadius: z
			.number()
			.min(0)
			.max(50)
			.default(0)
			.describe("Radius of the curve at each corner, in grid units; 0 = sharp corners."),
		height: z
			.number()
			.min(0.1)
			.max(10)
			.nullable()
			.default(null)
			.describe("How tall it is, in grid units; null = its kind's."),
		postSpacing: z
			.number()
			.min(0.3)
			.max(20)
			.nullable()
			.default(null)
			.describe(
				"The longest gap between two posts, in grid units (posts are spaced evenly between corners); null = its kind's.",
			),
		colors: colorSettings(
			'{ "leaves": { "color": "#3f7a32" } } (see each kind\'s colours in its description)',
		),
		builtShare: z
			.number()
			.min(0)
			.max(1)
			.default(1)
			.describe(
				"How much of it is built, from its first point: 1 = all of it, 0.5 = the first half (a fence going up).",
			),
		data: dataBindings(
			'Settings that follow a data value: { "builtShare": { key, valueAtFull } } builds value ÷ valueAtFull of it.',
		),
		isLocked: isLocked("its points"),
		isHidden: isHidden(),
	})
	.describe(
		"A fence, wall, hedge or railing drawn as a line of points; it stands on the ground under it.",
	);

export const GroundSchema = z
	.object({
		width: z.number().min(4).max(500).default(40).describe("Size along x, in grid units."),
		depth: z.number().min(4).max(500).default(30).describe("Size along z, in grid units."),
		colors: colorSettings('{ "surface": { "color": "#cfd8c4" } }; its colour is surface'),
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
		targetAltitude: z
			.number()
			.default(0)
			.describe(
				"How high above the base ground the point in the middle of the view is, in grid units; above 0 for a view that looks up (elevation below 0).",
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
		moodId: z
			.string()
			.nullable()
			.default(null)
			.describe(
				"The id of a mood (moods) that going to this view also puts on: its time of day, light, sky, water, weather and tilt-shift. null = the view leaves the look as it is.",
			),
	})
	.describe("A saved camera view: jump to it in the editor, or step through them in View mode.");

// See docs/adr/0062-camera-settings.md.
export const TurntableSchema = z
	.object({
		isOn: z
			.boolean()
			.default(false)
			.describe(
				"Whether View mode slowly circles the view after a while without input, like a model on a turntable; any input stops it.",
			),
		speed: z
			.number()
			.min(-30)
			.max(30)
			.default(4)
			.describe(
				"Degrees per second the view circles; positive turns the world anticlockwise seen from above, negative clockwise.",
			),
		delay: z
			.number()
			.min(1)
			.max(300)
			.default(10)
			.describe("Seconds without input in View mode before it starts."),
	})
	.describe("The turntable: View mode circling the view on its own.");

export const TiltShiftSchema = z
	.object({
		isOn: z
			.boolean()
			.default(false)
			.describe(
				"Whether View mode blurs the top and bottom of the view and keeps a band across it sharp, which makes the world look like a miniature (tilt-shift photography).",
			),
		blurStrength: z.number().min(0).max(1).default(0.5).describe("How strong the blur is, 0–1."),
		sharpBandHeight: z
			.number()
			.min(0.05)
			.max(1)
			.default(0.3)
			.describe("How much of the view's height the sharp band takes, 0–1."),
		sharpBandPosition: z
			.number()
			.min(0)
			.max(1)
			.default(0.5)
			.describe("Where the sharp band is, from the bottom of the view (0) to the top (1)."),
	})
	.describe("Tilt-shift: a miniature's blur above and below a sharp band.");

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
		highestElevation: z
			.number()
			.min(0)
			.max(90)
			.default(87)
			.describe(
				"How high the camera can tilt, in degrees above the ground: 90 = looking straight down.",
			),
		keepsOverGround: z
			.boolean()
			.default(true)
			.describe(
				"Whether the middle of the view stays over the ground, so panning and zooming can't lose the world.",
			),
		keepsIsometricAngle: z
			.boolean()
			.default(false)
			.describe(
				"Whether the camera keeps the isometric angle, like a classic isometric game: the tilt stays put and the view turns a quarter at a time, between the four diagonals.",
			),
		turntable: TurntableSchema.default(() => TurntableSchema.parse({})),
		tiltShift: TiltShiftSchema.default(() => TiltShiftSchema.parse({})),
	})
	.describe("How the camera behaves in this world.");

export const OnScreenSchema = z
	.object({
		showsTitle: z
			.boolean()
			.default(true)
			.describe("Whether the world's title shows, in the top-left corner."),
		showsSubtitle: z
			.boolean()
			.default(true)
			.describe("Whether the subtitle shows under the title."),
		showsTimeOfDay: z
			.boolean()
			.default(true)
			.describe("Whether the time of day shows under the title."),
		showsLabelCards: z
			.boolean()
			.default(true)
			.describe(
				"Whether objects' label cards show. false hides every card in View mode, whatever each object says.",
			),
		showsDetails: z
			.boolean()
			.default(true)
			.describe("Whether clicking an object opens the panel with its values."),
		showsViewpointBar: z
			.boolean()
			.default(true)
			.describe("Whether the bar that steps through the viewpoints shows."),
		showsDataSwitch: z
			.boolean()
			.default(true)
			.describe(
				"Whether the Map / Data switch shows, for a world with data: Data shows the world's tables and values as tables (also the accessible way to read the world).",
			),
		legend: z
			.array(
				z.object({
					label: z.string().describe('What it explains, in a word or two: "Size", "Roads".'),
					meaning: z
						.string()
						.default("")
						.describe('What it means: "30-day average Steam players, log scale".'),
				}),
			)
			.default([])
			.describe(
				"Chips under the title saying what each encoding means (ADR-0110), in order; [] = none.",
			),
		tileKeys: z
			.array(z.string())
			.default([])
			.describe(
				"Keys of the world's values shown as tiles along the bottom edge, the world's main numbers; [] = none.",
			),
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
				"Where the time comes from: fixed = `time`; cycle = days pass while motion plays, starting at `time`; clock = the viewer's own local time; data = the data value in `data.time` (hours, 0–24).",
			),
		dayLength: z
			.number()
			.min(10)
			.max(3600)
			.default(120)
			.describe("With timeSource cycle: how many seconds a whole day takes."),
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
		sunShadeContrast: z
			.number()
			.min(0)
			.max(1)
			.default(0.5)
			.describe(
				"How much darker shade is than sunlight, 0–1: higher moves light from the flat sky and ambient fill into the sun, for deeper shade and shadows while sunlit ground stays as bright; lower softens shade towards an overcast look. 0.5 = the theme's own balance.",
			),
		whenLightsAreOn: z
			.enum(["auto", "on", "off"])
			.default("auto")
			.describe(
				"The world's lit windows, lamps, cabins and headlights: auto = after dark (headlights only while driving), on = always, off = never. A light's own `whenOn` setting other than auto overrides this.",
			),
		data: dataBindings(
			'Settings that follow a data value: { "time": { key } } (with timeSource data) takes the hour from the value, 0–24.',
		),
	})
	.describe("The time of day, the sun, and when the world's lights are on.");

// See docs/adr/0070-sky.md. Colours left null follow the time of day (or the theme).
export const SkySchema = z
	.object({
		showsInPerspective: z
			.boolean()
			.default(true)
			.describe(
				"Whether the sky is drawn around the world in perspective. false shows the backdrop there too (e.g. a green screen).",
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
		showsSun: z
			.boolean()
			.default(true)
			.describe("Whether the sun shows in the sky by day, where the sunlight comes from."),
		showsMoon: z
			.boolean()
			.default(true)
			.describe("Whether the moon shows in the sky at night, opposite the sun."),
		starDensity: z
			.number()
			.min(0)
			.max(1)
			.default(0.6)
			.describe("How many stars come out at night: 0 = none, 1 = a full starry sky."),
	})
	.describe(
		"The sky around the world in perspective: its colours, the sun and moon, and the stars. The isometric diorama shows the backdrop instead. Clouds are in `weather`.",
	);

// See docs/adr/0075-reflective-water.md. Each water area can set its own.
export const WaterSchema = z
	.object({
		rippleStrength: z
			.number()
			.min(0)
			.max(1)
			.default(0.5)
			.describe(
				"How rippled the world's water is, 0 = mirror-calm, 1 = choppy, unless a water area sets its own (seen where the viewer's graphics settings show water reflections).",
			),
		reflectionStrength: z
			.number()
			.min(0)
			.max(1)
			.default(0.5)
			.describe(
				"How strongly the world's water mirrors the world, 0 = not at all (only its ripples catch the lights), 1 = fully, unless a water area sets its own (seen where the viewer's graphics settings show water reflections).",
			),
	})
	.describe("The world's water.");

const amount = (meaning: string, fallback = 0) =>
	z.number().min(0).max(1).default(fallback).describe(meaning);

// See docs/adr/0102-weather.md.
export const WeatherSchema = z
	.object({
		cloudCover: amount(
			"How cloudy it is: 0 = clear, 1 = many low-poly clouds around the world.",
			0.3,
		),
		cloudColor: HexColorSchema.nullable()
			.default(null)
			.describe("The clouds' colour, as #rrggbb. null = white, tinted by the time of day."),
		cloudSpeed: z
			.number()
			.min(0)
			.max(5)
			.default(1)
			.describe("How fast the clouds drift while motion plays: 0 = still, 1 = a gentle breeze."),
		rainAmount: amount("How hard it rains: 0 = dry, 1 = a downpour."),
		snowAmount: amount("How hard it snows: 0 = none, 1 = a blizzard."),
		fogDensity: amount(
			"How thick the fog is: 0 = none, 1 = only what's near can be seen. In the diorama, it fogs from the far side.",
		),
		hazeAmount: amount(
			"How hazy the distance is: 0 = clear, 1 = the far side fades into a pale haze (dust, smog, a hot day).",
		),
		lightningRate: amount(
			"How often lightning flashes: 0 = never, 1 = every few seconds (with rain, a storm).",
		),
		groundWetness: z
			.number()
			.min(0)
			.max(1)
			.nullable()
			.default(null)
			.describe(
				"How wet the ground and everything on it look (darker, a little glossy): 0 = dry, 1 = soaked. null = following the rain.",
			),
		snowCover: z
			.number()
			.min(0)
			.max(1)
			.nullable()
			.default(null)
			.describe(
				"How much snow has settled on what faces up (roofs, grass, roads, treetops): 0 = none, 1 = all white. null = following the snowfall.",
			),
		showsSplashes: z
			.boolean()
			.default(true)
			.describe("Whether small splashes open on the ground where raindrops land."),
		softensLight: z
			.boolean()
			.default(true)
			.describe(
				"Whether rain, snow and fog make it overcast: the sun dims, shadows soften and the sky greys, more as they grow. false = the light stays as set.",
			),
		data: dataBindings(
			'Data values that drive weather settings, by setting: "cloudCover", "rainAmount", "snowAmount", "fogDensity", "hazeAmount" or "lightningRate", each as value ÷ valueAtFull (up to 1). Only the settings that follow data.',
		),
	})
	.describe(
		"The world's weather: clouds, what falls, fog and haze, lightning, and how it leaves the ground.",
	);

// See docs/adr/0078-moods.md.
export const MoodSchema = z
	.object({
		id: z.string().min(1).describe("Unique id among the moods."),
		name: z.string().default("").describe("Shown in the list, e.g. Golden hour."),
		lighting: LightingSchema.default(() => LightingSchema.parse({})).describe(
			"The world's lighting with this mood (as `lighting`).",
		),
		sky: SkySchema.default(() => SkySchema.parse({})).describe(
			"The world's sky with this mood (as `sky`).",
		),
		water: WaterSchema.default(() => WaterSchema.parse({})).describe(
			"The world's water with this mood (as `water`).",
		),
		weather: WeatherSchema.default(() => WeatherSchema.parse({})).describe(
			"The world's weather with this mood (as `weather`).",
		),
		tiltShift: TiltShiftSchema.default(() => TiltShiftSchema.parse({})).describe(
			"The world's tilt-shift with this mood (as `camera.tiltShift`).",
		),
	})
	.describe(
		"A named look of the world, like Golden hour or Night: its time of day, light, sky, water, weather and tilt-shift, put on with one click or by going to a viewpoint that has it.",
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
		ground: GroundSchema.default(() => GroundSchema.parse({})),
		traffic: TrafficSchema.default(() => TrafficSchema.parse({})),
		lighting: LightingSchema.default(() => LightingSchema.parse({})),
		sky: SkySchema.default(() => SkySchema.parse({})),
		water: WaterSchema.default(() => WaterSchema.parse({})),
		weather: WeatherSchema.default(() => WeatherSchema.parse({})),
		moods: z
			.array(MoodSchema)
			.default([])
			.describe("Named looks of the world (time of day, light, sky, water, weather, tilt-shift)."),
		backdrop: BackdropSchema.default(() => BackdropSchema.parse({})),
		entities: z.array(EntitySchema).default([]).describe("The objects in the world."),
		roads: z.array(RoadSchema).default([]).describe("Roads, paths and hidden routes."),
		areas: z.array(AreaSchema).default([]).describe("Water, grass, sand, plazas and raised land."),
		fences: z.array(FenceSchema).default([]).describe("Fences, walls, hedges and railings."),
		data: WorldDataSchema.default(() => WorldDataSchema.parse({})),
		viewpoints: z
			.array(ViewpointSchema)
			.default([])
			.describe("Saved camera views, in the order View mode steps through them."),
		onScreen: OnScreenSchema.default(() => OnScreenSchema.parse({})),
		camera: CameraSettingsSchema.default(() => CameraSettingsSchema.parse({})),
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
			scene.fences.map((f) => f.id),
			["fences"],
			"fence id",
		);
		checkUnique(
			scene.data.values.map((d) => d.key),
			["data", "values"],
			"data key",
		);
		checkUnique(
			scene.data.tables.map((t) => t.key),
			["data", "tables"],
			"table key",
		);
		checkUnique(
			scene.data.sources.map((s) => s.id),
			["data", "sources"],
			"data source id",
		);
		checkUnique(
			scene.viewpoints.map((v) => v.id),
			["viewpoints"],
			"viewpoint id",
		);
		checkUnique(
			scene.moods.map((m) => m.id),
			["moods"],
			"mood id",
		);
	});

export type TScene = z.output<typeof SceneSchema>;
export type TSceneInput = z.input<typeof SceneSchema>;
export type TEntity = z.output<typeof EntitySchema>;
export type TEntityInput = z.input<typeof EntitySchema>;
export type TFollow = z.output<typeof FollowSchema>;
export type TDataValue = z.output<typeof DataValueSchema>;
export type TDataValueInput = z.input<typeof DataValueSchema>;
/** Values as settings read them: each one's key and value, nothing else needed. */
export type TReadableValues = readonly Pick<TDataValue, "key" | "value">[];
export type TDataTable = z.output<typeof DataTableSchema>;
export type TDataSource = z.output<typeof DataSourceSchema>;
export type TDataSourceKind = z.output<typeof DataSourceKindSchema>;
export type TDataPoint = z.output<typeof DataPointSchema>;
export type TWorldData = z.output<typeof WorldDataSchema>;
export type TRoad = z.output<typeof RoadSchema>;
export type TRoadInput = z.input<typeof RoadSchema>;
export type TRoadKind = z.output<typeof RoadKindSchema>;
export type TRoadPoint = z.output<typeof RoadPointSchema>;
export type TRoadHeldUpBy = z.output<typeof RoadHeldUpBySchema>;
export type TRoadTraffic = z.output<typeof RoadTrafficSchema>;
export type TDrivingLane = z.output<typeof DrivingLaneSchema>;
export type TArea = z.output<typeof AreaSchema>;
export type TAreaInput = z.input<typeof AreaSchema>;
export type TAreaKind = z.output<typeof AreaKindSchema>;
export type TAreaPoint = z.output<typeof AreaPointSchema>;
export type TAreaWater = z.output<typeof AreaWaterSchema>;
export type TFence = z.output<typeof FenceSchema>;
export type TFenceInput = z.input<typeof FenceSchema>;
export type TFenceKind = z.output<typeof FenceKindSchema>;
export type TFencePoint = z.output<typeof FencePointSchema>;
export type TGround = z.output<typeof GroundSchema>;
export type TDrivingSide = z.output<typeof DrivingSideSchema>;
export type TTurnStyle = z.output<typeof TurnStyleSchema>;
export type TTraffic = z.output<typeof TrafficSchema>;
export type TThemePreference = z.output<typeof ThemeSchema>;
export type TLighting = z.output<typeof LightingSchema>;
export type TLightingInput = z.input<typeof LightingSchema>;
export type TSky = z.output<typeof SkySchema>;
export type TBackdrop = z.output<typeof BackdropSchema>;
export type TWater = z.output<typeof WaterSchema>;
export type TWeather = z.output<typeof WeatherSchema>;
export type TMood = z.output<typeof MoodSchema>;
export type TMoodInput = z.input<typeof MoodSchema>;
export type TCameraSettings = z.output<typeof CameraSettingsSchema>;
export type TTurntable = z.output<typeof TurntableSchema>;
export type TTiltShift = z.output<typeof TiltShiftSchema>;
export type TTiltShiftInput = z.input<typeof TiltShiftSchema>;
export type TOnScreen = z.output<typeof OnScreenSchema>;
export type TViewpoint = z.output<typeof ViewpointSchema>;
export type TProjection = z.output<typeof ProjectionSchema>;
/** Where a viewpoint puts the camera: everything but its id, name and description. */
export type TViewPose = Pick<
	TViewpoint,
	"target" | "targetAltitude" | "azimuth" | "elevation" | "span" | "projection" | "fieldOfView"
>;
export type TVec2 = z.output<typeof Vec2Schema>;
export type TVec3 = z.output<typeof Vec3Schema>;
