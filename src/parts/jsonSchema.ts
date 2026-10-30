import { z } from "zod";

import { FENCE_STYLE_LABELS, FENCE_STYLE_LIST } from "#/fences/registry";
import { APP_NAME } from "#/lib/app";
import { sceneJsonSchema } from "#/scene/jsonSchema";
import { isHiddenRoute, ROAD_STYLES } from "#/scene/roads";
import type { TRoadStyle } from "#/scene/schema";

import { PARTS, partName, type TAnyPart } from "./registry";
import { type IColorSpec, type ILightSpec, LIGHT_SHAPES_WITH_REACH } from "./types";

type TJsonSchema = Record<string, unknown> & { properties?: Record<string, TJsonSchema> };

const HIDDEN_STYLES = (Object.keys(ROAD_STYLES) as TRoadStyle[])
	.filter(isHiddenRoute)
	.map((style) => `"${style}"`)
	.join(", ");

/**
 * How to build a world, for people and AIs writing scene files by hand. The
 * schema itself only knows field names and types; this carries the meaning.
 */
const GUIDE = `A world (scene document) for ${APP_NAME}: a low-poly 3D miniature world that shows data. Fields with a default may be left out; invalid ones fall back to their defaults when the file is opened.

Coordinates: the ground is a flat slab centred on the origin, ground.width along x and ground.depth along z, in grid units (keep positions within ±width/2 and ±depth/2). Positions are [x, z]; heights (elevation, road point heights) go up. rotation is in degrees around the vertical axis, counter-clockwise seen from above. At rotation 0 a part's front faces +z and vehicles face +x.

Entities: kind picks the part; each kind's description says what it is and how big it is, and props takes that kind's parameters. scale resizes the whole part.

Colours: each kind lists its colours by id in the catalogue (a house has roof and door, a car body and windows). An entity's colors holds settings only for the ones that differ from the kind's defaults, by id: color (#rrggbb), transparency (0 solid to 1 clear, for the see-through ones the catalogue marks, like glass), and data: { "color": { key, valueAtLowColor, valueAtHighColor, lowColor, highColor } } to take it from a data value, where key is the key of an entry in the world's data. A value holding a CSS colour (red, #ff0000, rgb(255, 0, 0), hsl(0, 100%, 50%)) is used as it is; a number is placed on a colour scale, lowColor at valueAtLowColor (0 by default) and highColor at valueAtHighColor (100 by default), mixed in between, like a heatmap. A value that's neither leaves the colour as set. Older worlds have color and accent on the entity for its first two colours; write colors instead. Examples: a red roof; a tower that turns from green to red as an occupancy value goes from 50 to 100:
"colors": { "roof": { "color": "#c0392b" } }
"colors": { "facade": { "data": { "color": { "key": "occupancy", "valueAtLowColor": 50, "valueAtHighColor": 100, "lowColor": "#2bb58c", "highColor": "#e0483b" } } } }

Roads: points are [x, z], [x, z, height] or [x, z, height, width]; a height above 0 lifts the road (bridges, flyovers), and a width there overrides the road's width. loops: true makes a loop. Styles ${HIDDEN_STYLES} are invisible routes, e.g. a ferry line across water. A vehicle part drives along a road with follow: { roadId, speed, offset, reverse }; offset is the distance from the road's first point where it starts, and reverse drives it the other way (in the other lane).

Areas: polygons of [x, z] corners (water, grass, sand, plaza, or raised land with a height).

Fences: fences, walls, hedges and railings, each a line of points ([x, z], or [x, z, lift] to raise it that far above the ground there) with a style; it stands on the ground under it, raised land included. Posts stand at every point and are spaced evenly in between (postSpacing, the style's by default); hedges and walls show no posts, so for them postSpacing is the longest straight section. loops: true closes it; cornerRadius rounds its corners. colors works as for entities, by the style's colour ids (in fences.style's descriptions). builtShare (0–1) builds only the first part of it, and data: { "builtShare": { key, valueAtFull } } takes that from a data value, e.g. a site fence that grows with a project's progress.

Time of day: lighting.time sets the hour (sun, sky, and lit windows, lamps and headlights after dark); leave it null for plain daylight. lighting.timeSource can make the time pass (cycle), follow the viewer's clock, or come from a data value (data, with timeKey).

Lights: each kind lists its lights by id (windows, headlights, lamp…). An entity's lights holds settings only for the ones that differ, by id: whenOn (auto = after dark, on = always, off = never, schedule = during the periods in schedule, like a timer: [{ "from": 5, "until": 8 }, { "from": 19, "until": 24 }] in hours, a period ending before it starts runs past midnight; needs a time of day), comesOn (after dark or on a schedule: atOnce = fully once it's dark enough or for the whole period, oneByOne = window lights' panes one after another as it gets darker or over a period's first hour and going dark over its last, gradually = fading in and out the same way; each kind's default is in the catalogue), color, strength, reach (beams and pools), litPanes (window lights: the part of its own panes that are lit, 0–1; a building's panes are split between its window lights, so each lights only its own), and data: settings that follow a data value, by setting, each { key, onAbove, valueAtFull }, where key is the key of an entry in the world's data: "on" turns it on while the value is a number above onAbove (0 by default) or the text on, yes or true, day and night, instead of whenOn; "strength" is the value divided by valueAtFull (up to 3); "litPanes" is the value divided by valueAtFull (up to 1, all panes), e.g. lit windows following occupancy; "color" reads its value like a colour's data (above); "schedule" (with whenOn schedule) takes its periods from a text value of times of day, like opening hours, "09:00-17:30" or "7-9, 16:30-19". A value that's missing or doesn't read that way leaves the setting as it is. Only list what differs from the kind's defaults (in the catalogue). The light_01 kind is a light on its own. Example: a lamp that glows red while an alert value is above 0, brighter with a queue, white headlights that reach further:
"lights": { "lamp": { "color": "#ff3b3b", "data": { "on": { "key": "alert" }, "strength": { "key": "queue", "valueAtFull": 50 } } } }
"lights": { "headlights": { "color": "#ffffff", "reach": 5 } }

Data: data holds named values (key, label, value, unit). Show them on an entity by listing keys in label.dataKeys (a floating card above it) or details.dataKeys (tiles when it's opened in view mode).

Viewpoints: prepared camera views (target, azimuth, elevation, span), stepped through in View mode like slides; give each a name and a description of what the data there shows.

Every id must be unique within its list, and follow.roadId must name a road in the same world.

Templates: /templates.json on this site lists complete worlds (e.g. /templates/brightwater.json) to learn from or start with.`;

/** A part's props as JSON Schema, with each inspector field's label as its description. */
const propsSchema = (part: TAnyPart): TJsonSchema => {
	const { $schema: _, ...schema } = z.toJSONSchema(part.schema, { io: "input" }) as TJsonSchema;
	for (const field of part.fields) {
		const prop = schema.properties?.[field.key];
		if (prop && prop.description === undefined) {
			prop.description = field.label;
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
		light.shape === "windows" ? `litPanes ${light.litPanes ?? 1}` : "",
		light.shape === "windows"
			? `weight ${light.weight ?? 1} (its part of the panes, against its other window lights')`
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
		fence.properties.style = {
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
