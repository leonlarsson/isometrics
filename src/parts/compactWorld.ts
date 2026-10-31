import type { z } from "zod";

import {
	AreaSchema,
	DataSourceSchema,
	DataTableSchema,
	DataValueSchema,
	EntitySchema,
	FenceSchema,
	MoodSchema,
	RoadSchema,
	SCENE_VERSION,
	SceneSchema,
	type TScene,
	ViewpointSchema,
} from "#/scene/schema";

import { getPart } from "./registry";

/**
 * A world with everything at its default left out (ADR-0117): the same world
 * once read (`readWorld` fills the defaults back in), a fraction of the size.
 * For the prompt Build with your AI copies, so neither it nor the answer is a
 * wall of defaults. No React.
 */

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isSame = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** `value` without what equals `defaults`, field by field, into groups; undefined if all of it does. */
const withoutDefaults = (value: unknown, defaults: unknown): unknown => {
	if (isSame(value, defaults)) {
		return undefined;
	}
	if (!isRecord(value) || !isRecord(defaults)) {
		return value;
	}
	const kept: TRecord = {};
	for (const [key, field] of Object.entries(value)) {
		const left = withoutDefaults(field, defaults[key]);
		if (left !== undefined) {
			kept[key] = left;
		}
	}
	return kept;
};

/**
 * What an item of a list would be with only what it must have: the schema's
 * defaults, with the fields it can't do without (an id, a kind, points)
 * taken from the item.
 */
const defaultsOf = (schema: z.ZodType, item: TRecord) => {
	const given: TRecord = {};
	for (let attempt = 0; attempt < 12; attempt++) {
		const result = schema.safeParse(given);
		if (result.success) {
			return { defaults: result.data, required: Object.keys(given) };
		}
		const key = result.error.issues[0]?.path[0];
		if (typeof key !== "string" || !(key in item) || key in given) {
			return { defaults: undefined, required: [] };
		}
		given[key] = item[key];
	}
	return { defaults: undefined, required: [] };
};

/** A list's items without their defaults; an object's props also without its part's. */
const compactList = (items: readonly unknown[], schema: z.ZodType, isObjects = false) =>
	items.map((item) => {
		if (!isRecord(item)) {
			return item;
		}
		const { defaults, required } = defaultsOf(schema, item);
		const compact = (withoutDefaults(item, defaults) ?? {}) as TRecord;
		// What it can't do without stays, even where it's the default (an id, a kind, points).
		for (const key of ["id", "key", "kind", ...required]) {
			if (key in item) {
				compact[key] = item[key];
			}
		}
		const part = isObjects && typeof item.kind === "string" ? getPart(item.kind) : undefined;
		if (part && isRecord(compact.props)) {
			const props = withoutDefaults(compact.props, part.schema.parse({}));
			if (props === undefined || (isRecord(props) && Object.keys(props).length === 0)) {
				delete compact.props;
			} else {
				compact.props = props;
			}
		}
		return compact;
	});

const LISTS: { path: readonly string[]; schema: z.ZodType; isObjects?: boolean }[] = [
	{ path: ["entities"], schema: EntitySchema, isObjects: true },
	{ path: ["roads"], schema: RoadSchema },
	{ path: ["areas"], schema: AreaSchema },
	{ path: ["fences"], schema: FenceSchema },
	{ path: ["viewpoints"], schema: ViewpointSchema },
	{ path: ["moods"], schema: MoodSchema },
	{ path: ["data", "values"], schema: DataValueSchema },
	{ path: ["data", "tables"], schema: DataTableSchema },
	{ path: ["data", "sources"], schema: DataSourceSchema },
];

/** The world with what's at its default left out: `readWorld` reads it back as it was. */
export const compactWorld = (scene: TScene): TRecord => {
	const world = structuredClone(scene) as unknown as TRecord;
	// Lists first, item by item; then the world's own settings against a new world's.
	for (const { path, schema, isObjects } of LISTS) {
		const holder = path.length === 1 ? world : (world[path[0]] as TRecord);
		const key = path[path.length - 1];
		const items = holder[key];
		if (Array.isArray(items)) {
			holder[key] = compactList(items, schema, isObjects);
		}
	}
	const defaults = SceneSchema.parse({ version: SCENE_VERSION }) as unknown as TRecord;
	const compact: TRecord = { version: SCENE_VERSION };
	for (const [key, value] of Object.entries(world)) {
		if (key === "version") {
			continue;
		}
		const isList = Array.isArray(value);
		const left = isList
			? value.length > 0
				? value
				: undefined
			: withoutDefaults(value, defaults[key]);
		if (left !== undefined && !(isRecord(left) && Object.keys(left).length === 0)) {
			compact[key] = left;
		}
	}
	// The data group's lists were compacted above, item by item; keep them whole.
	if (isRecord(world.data)) {
		const data = (compact.data ?? {}) as TRecord;
		for (const key of ["values", "tables", "sources"]) {
			const items = world.data[key];
			if (Array.isArray(items) && items.length > 0) {
				data[key] = items;
			} else {
				delete data[key];
			}
		}
		if (Object.keys(data).length > 0) {
			compact.data = data;
		}
	}
	return compact;
};
