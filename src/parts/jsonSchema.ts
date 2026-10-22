import { z } from "zod";

import { APP_NAME } from "#/lib/app";
import { sceneJsonSchema } from "#/scene/jsonSchema";

import { PARTS, type TAnyPart } from "./registry";

type TJsonSchema = Record<string, unknown> & { properties?: Record<string, TJsonSchema> };

/**
 * How to build a world, for people and AIs writing scene files by hand. The
 * schema itself only knows field names and types; this carries the meaning.
 */
const GUIDE = `A world (scene document) for ${APP_NAME}: a low-poly 3D miniature world that shows data. Fields with a default may be left out; invalid ones fall back to their defaults when the file is opened.

Coordinates: the ground is a flat slab centred on the origin, ground.width along x and ground.depth along z, in grid units (keep positions within ±width/2 and ±depth/2). Positions are [x, z]; heights (elevation, road point heights) go up. rotation is in degrees around the vertical axis, counter-clockwise seen from above. At rotation 0 a part's front faces +z and vehicles face +x.

Entities: kind picks the part; each kind's description says what it is and how big it is, and props takes that kind's parameters. Leave color and accent null to use the theme's colours. scale resizes the whole part.

Roads: points are [x, z], [x, z, height] or [x, z, height, width]; a height above 0 lifts the road (bridges, flyovers), and a width there overrides the road's width. closed: true makes a loop. Style "hidden" is an invisible route, e.g. a ferry line across water. A vehicle part drives along a road with follow: { roadId, speed, offset, reverse }; offset is the distance from the road's first point where it starts, and reverse drives it the other way (in the other lane).

Areas: polygons of [x, z] corners (water, grass, sand, plaza, or raised land with a height).

Data: data holds named values (key, label, value, unit). Show them on an entity by listing keys in label.dataKeys (a floating card above it) or details.dataKeys (tiles when it's opened in view mode).

Every id must be unique within its list, and follow.roadId must name a road in the same world.`;

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

/** One line per part: what it is, how big it is by default, what its colours paint. */
const describePart = (part: TAnyPart) => {
	const props = part.schema.parse({});
	const [width, depth] = part.footprint(props);
	return [
		`${part.name}: ${part.description}.`,
		`About ${round(width)} × ${round(depth)} grid units (x × z) and ${round(part.height(props))} tall at scale 1 with default props.`,
		`color paints the ${(part.colorLabel ?? "body").toLowerCase()}, accent the ${(part.accentLabel ?? "details").toLowerCase()}.`,
		part.canFollowPath ? "Can drive along a road (follow)." : "",
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
			title: part.name,
			description: describePart(part),
		})),
	};
	entity.allOf = PARTS.filter((part) => part.fields.length > 0).map((part) => ({
		if: { properties: { kind: { const: part.kind } }, required: ["kind"] },
		then: { properties: { props: propsSchema(part) } },
	}));
	return { ...schema, description: GUIDE };
};
