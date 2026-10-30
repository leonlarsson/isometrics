import { z } from "zod";

import { FENCE_STYLE_LABELS, FENCE_STYLE_LIST } from "#/fences/registry";
import { APP_NAME } from "#/lib/app";
import { sceneJsonSchema } from "#/scene/jsonSchema";
import { isHiddenRoute, ROAD_KINDS } from "#/scene/roads";
import type { TRoadKind } from "#/scene/schema";

import { PARTS, partName, type TAnyPart } from "./registry";
import {
	type IColorSpec,
	type ILightSpec,
	LIGHT_SHAPES_WITH_REACH,
	type TFieldSpec,
} from "./types";

type TJsonSchema = Record<string, unknown> & { properties?: Record<string, TJsonSchema> };

const HIDDEN_KINDS = (Object.keys(ROAD_KINDS) as TRoadKind[])
	.filter(isHiddenRoute)
	.map((kind) => `"${kind}"`)
	.join(", ");

/**
 * How to build a world, for people and AIs writing scene files by hand. The
 * schema itself only knows field names and types; this carries the meaning.
 */
const GUIDE = `A world (scene document) for ${APP_NAME}: a low-poly 3D miniature world that shows data. Fields with a default may be left out; invalid ones fall back to their defaults when the file is opened.

Coordinates: the ground is a flat slab centred on the origin, ground.width along x and ground.depth along z, in grid units (keep positions within ±width/2 and ±depth/2). Positions are [x, z]; y goes up. altitude is how high above the base ground something stands (objects, road points, a viewpoint's target); lift is how far above what it stands on (a fence point above the ground under it, an area corner above the area's height); height is how tall something is. Angles: azimuth is a compass direction (degrees counter-clockwise from +x seen from above), elevation an angle above the horizontal.

Objects (entities): kind picks the part; each kind's description says what it is and how big it is, and props takes that kind's parameters. scale resizes the whole part. rotation is [x, y, z] in degrees: y turns it around the vertical, counter-clockwise seen from above, then z and x tip it about its own axes. At [0, 0, 0] a part's front faces +z and vehicles face +x. Switches read as statements (showsChimney, isLocked, isHidden).

Colours: each kind lists its colours by id (a house has roof and door, a car body and windows), and so do roads (surface, embankment), areas (surface), the ground (surface) and fences (by kind). Their colors hold settings only for the ones that differ from the defaults, by id: color (#rrggbb), transparency (0 solid to 1 clear, for the see-through ones the description marks, like glass), and data: { "color": { key, valueAtLowColor, valueAtHighColor, lowColor, highColor } } to take it from a data value, where key is the key of an entry in the world's data. A value holding a CSS colour (red, #ff0000, rgb(255, 0, 0), hsl(0, 100%, 50%)) is used as it is; a number is placed on a colour scale, lowColor at valueAtLowColor (0 by default) and highColor at valueAtHighColor (100 by default), mixed in between, like a heatmap. A value that's neither leaves the colour as set. Examples: a red roof; a tower that turns from green to red as an occupancy value goes from 50 to 100; a road coloured by congestion:
"colors": { "roof": { "color": "#c0392b" } }
"colors": { "facade": { "data": { "color": { "key": "occupancy", "valueAtLowColor": 50, "valueAtHighColor": 100, "lowColor": "#2bb58c", "highColor": "#e0483b" } } } }
"colors": { "surface": { "data": { "color": { "key": "congestion" } } } }

Roads: points are [x, z], [x, z, altitude] or [x, z, altitude, width]; an altitude above 0 lifts the road (bridges, flyovers), and a width there overrides the road's width. loops: true makes a loop. heldUpBy says what holds raised sections up. Kinds ${HIDDEN_KINDS} are invisible routes, e.g. a ferry line across water. A road's traffic sets how vehicles drive on it (drivingLane, and turnStyle and leansInTurns, null = the world's traffic). A vehicle part drives along a road with follow: { roadId, speed, startDistance, drivesTheOtherWay }; startDistance is the distance from the road's first point where it starts, and drivesTheOtherWay drives it against the order of its points (in the other lane).

Areas: polygons of [x, z] or [x, z, lift] corners (water, grass, sand, plaza, or raised land with a height), with peaks inside for hills. A water area's water overrides the world's water.

Fences: fences, walls, hedges and railings, each a line of points ([x, z], or [x, z, lift] to raise it that far above the ground there) with a kind; it stands on the ground under it, raised land included. Posts stand at every point and are spaced evenly in between (postSpacing, the kind's by default); hedges and walls show no posts, so for them postSpacing is the longest straight section. loops: true closes it; cornerRadius rounds its corners. builtShare (0–1) builds only the first part of it, and data: { "builtShare": { key, valueAtFull } } takes that from a data value, e.g. a site fence that grows with a project's progress.

Traffic: traffic holds how vehicles drive in the whole world: drivingSide, turnStyle, leansInTurns, keepsDistance and overtakes.

Time of day: lighting.time sets the hour (sun, sky, and lit windows, lamps and headlights after dark); leave it null for plain daylight. lighting.timeSource can make the time pass (cycle), follow the viewer's clock, or come from a data value (data, with lighting.data: { "time": { "key": "hour" } }).

Weather: weather holds the clouds (cloudCover, cloudColor, cloudSpeed), rain, snow, fog, haze and lightning, and how wet and snowy the ground looks; weather.data takes any of cloudCover, rainAmount, snowAmount, fogDensity, hazeAmount and lightningRate from a data value (value ÷ valueAtFull, up to 1).

Lights: each kind lists its lights by id (windows, headlights, lamp…). An entity's lights holds settings only for the ones that differ, by id: whenOn (auto = after dark, on = always, off = never, schedule = during the periods in schedule, like a timer: [{ "from": 5, "until": 8 }, { "from": 19, "until": 24 }] in hours, a period ending before it starts runs past midnight; needs a time of day), comesOn (after dark or on a schedule: atOnce = fully once it's dark enough or for the whole period, oneByOne = window lights' panes one after another as it gets darker or over a period's first hour and going dark over its last, gradually = fading in and out the same way; each kind's default is in its description), color, strength, reach (beams and pools), litPaneShare (window lights: the share of its own panes that are lit, 0–1; a building's panes are split between its window lights by paneWeight, so each lights only its own), and data: settings that follow a data value, by setting, each { key, switchesOnAbove, valueAtFull }, where key is the key of an entry in the world's data: "on" turns it on while the value is a number above switchesOnAbove (0 by default) or the text on, yes or true, day and night, instead of whenOn; "strength" is the value divided by valueAtFull (up to 3); "litPaneShare" is the value divided by valueAtFull (up to 1, all panes), e.g. lit windows following occupancy; "color" reads its value like a colour's data (above); "schedule" (with whenOn schedule) takes its periods from a text value of times of day, like opening hours, "09:00-17:30" or "7-9, 16:30-19". A value that's missing or doesn't read that way leaves the setting as it is. Only list what differs from the kind's defaults. The light_01 kind is a light on its own. Example: a lamp that glows red while an alert value is above 0, brighter with a queue, white headlights that reach further:
"lights": { "lamp": { "color": "#ff3b3b", "data": { "on": { "key": "alert" }, "strength": { "key": "queue", "valueAtFull": 50 } } } }
"lights": { "headlights": { "color": "#ffffff", "reach": 5 } }

Data: data holds named values (key, name, value, unit). Show them on an entity by listing keys in label.dataKeys (a floating card above it, shown while label.isShown) or details.dataKeys (tiles when it's opened in view mode).

Viewpoints: prepared camera views (target, targetAltitude, azimuth, elevation, span), stepped through in View mode like slides; give each a name and a description of what the data there shows.

Every id must be unique within its list, and follow.roadId must name a road in the same world.

Templates: /templates.json on this site lists complete worlds (e.g. /templates/brightwater.json) to learn from or start with.`;

/** What a number prop measures, from its name (ADR-0104): counts, angles, seconds, else grid units. */
const measureOf = (key: string) => {
	if (/Count$/.test(key)) {
		return "a whole number";
	}
	if (/(Angle|Tilt)$/.test(key)) {
		return "in degrees";
	}
	if (/Seconds/.test(key)) {
		return "in seconds";
	}
	if (/(Share|Strength)$/.test(key)) {
		return "0 to 1";
	}
	return "in grid units";
};

/** A prop's description from its inspector field: its label, what it measures, or its choices. */
const describeField = (field: TFieldSpec) => {
	switch (field.type) {
		case "number":
			return `${field.label}, ${measureOf(field.key)}.`;
		case "select":
			return `${field.label}: ${field.options.map((option) => `${option.value} (${option.label})`).join(", ")}.`;
		case "dataKey":
			return `${field.label}: the key of a value in the world's data, or "" for none.`;
		default:
			return `${field.label}.`;
	}
};

/** A part's props as JSON Schema, each described from its inspector field unless it says more itself. */
const propsSchema = (part: TAnyPart): TJsonSchema => {
	const { $schema: _, ...schema } = z.toJSONSchema(part.schema, { io: "input" }) as TJsonSchema;
	for (const field of part.fields) {
		const prop = schema.properties?.[field.key];
		if (prop && prop.description === undefined) {
			prop.description = describeField(field);
		}
	}
	return schema;
};

const round = (value: number) => Math.round(value * 10) / 10;

/** One light for the catalogue: its id, name, shape and defaults, e.g. "lamp (Lamp, pool, colour #ffe8a3, strength 1, reach 2.3)". */
const describeLight = (light: ILightSpec) =>
	`${light.id} (${[
		light.name,
		light.shape,
		`colour ${typeof light.color === "string" ? light.color : "the theme's lamplight"}`,
		`strength ${light.strength ?? 1}`,
		LIGHT_SHAPES_WITH_REACH.includes(light.shape) ? `reach ${light.reach ?? 1}` : "",
		light.shape === "windows" ? `litPaneShare ${light.litPaneShare ?? 1}` : "",
		light.shape === "windows"
			? `paneWeight ${light.paneWeight ?? 1} (its part of the panes, against its other window lights')`
			: "",
		light.description ? `“${light.description}”` : "",
		{
			dark: "on after dark",
			driving: "on after dark only while driving",
			always: "on day and night",
		}[light.when ?? "dark"],
		`comes on ${{ atOnce: "at once", oneByOne: "one pane at a time", gradually: "gradually" }[light.comesOn ?? "atOnce"]}`,
	]
		.filter(Boolean)
		.join(", ")})`;

/** One colour for the catalogue: its id, name and default, e.g. "roof (Roof, default #f07b4f)". */
const describeColor = (color: IColorSpec) =>
	`${color.id} (${color.name}, default ${typeof color.default === "string" ? color.default : "from the theme"}${color.seeThrough ? `; see-through, transparency ${color.seeThrough.transparency} by default` : ""})`;

/** One line per part: what it is, how big it is by default, its colours and lights. */
const describePart = (part: TAnyPart) => {
	const props = part.schema.parse({});
	const [width, depth] = part.footprint(props);
	return [
		`${partName(part)}: ${part.description}.`,
		`About ${round(width)} × ${round(depth)} grid units (x × z) and ${round(part.height(props))} tall at scale 1 with default props.`,
		part.colors.length
			? `Colours (settings in colors, by id): ${part.colors.map(describeColor).join("; ")}.`
			: "",
		part.canFollowPath ? "Can drive along a road (follow)." : "",
		part.lights?.length
			? `Lights (settings in lights, by id): ${part.lights.map(describeLight).join("; ")}.`
			: "",
	]
		.filter(Boolean)
		.join(" ");
};

/**
 * The scene JSON Schema (`sceneJsonSchema`) completed with the part registry:
 * every part kind with a description, each kind's props, and a guide to the
 * format. Lives here because `scene/` can't know the parts. Served at /schema.json.
 */
export const worldJsonSchema = () => {
	const schema = sceneJsonSchema() as TJsonSchema;
	const entity = (schema.properties?.entities as { items?: TJsonSchema } | undefined)?.items;
	if (!entity?.properties) {
		return { ...schema, description: GUIDE };
	}
	entity.properties.kind = {
		description: "Which part this is.",
		oneOf: PARTS.map((part) => ({
			const: part.kind,
			title: partName(part),
			description: describePart(part),
		})),
	};
	const fence = (schema.properties?.fences as { items?: TJsonSchema } | undefined)?.items;
	if (fence?.properties) {
		fence.properties.kind = {
			description: "What the fence looks like.",
			oneOf: FENCE_STYLE_LIST.map((style) => ({
				const: style.id,
				title: FENCE_STYLE_LABELS[style.id],
				description: `${style.description}. ${round(style.height)} tall, ${style.showsPosts === false ? "in straight sections up to" : "posts up to"} ${round(style.postSpacing)} apart by default. Colours (settings in colors, by id): ${style.colors.map(describeColor).join("; ")}.`,
			})),
		};
	}
	entity.allOf = PARTS.filter((part) => part.fields.length > 0).map((part) => ({
		if: { properties: { kind: { const: part.kind } }, required: ["kind"] },
		then: { properties: { props: propsSchema(part) } },
	}));
	return { ...schema, description: GUIDE };
};
