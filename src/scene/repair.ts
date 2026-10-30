import type { z } from "zod";

import { upgradeLegacyIds } from "./legacy";
import { parseScene } from "./migrate";
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
} from "./schema";

/**
 * Repair a saved world that no longer validates, instead of rejecting it
 * (ADR-0026). While the app is a playground the scene format changes without
 * migrations, so an older save or file may hold values this version can't
 * read. Rather than refuse the whole world over one bad value, keep
 * everything that is still valid:
 *
 * - each object, road, area, fence, data value, viewpoint and mood is checked on its own;
 * - an invalid field is removed so its default applies;
 * - an invalid entry in a list (one road point, one data key) is dropped;
 * - an item that still can't be read (e.g. it has no id) is removed;
 * - duplicate ids keep their first item.
 *
 * Framework-free so it is unit-tested; callers keep the original as a backup.
 */

export interface IRepairReport {
	/** Items dropped because they couldn't be repaired. */
	removed: {
		objects: number;
		roads: number;
		areas: number;
		fences: number;
		values: number;
		tables: number;
		sources: number;
		viewpoints: number;
		moods: number;
	};
	/** Invalid fields reset to their default, or invalid list entries dropped. */
	fixed: number;
	/** The world came from a newer version of the app. */
	newerVersion: boolean;
	/** The world had no version number. */
	missingVersion: boolean;
}

/** Stop after this many fixes to one value: something is badly wrong with it. */
const MAX_FIXES = 50;

type TPath = readonly PropertyKey[];

/**
 * Remove whatever an issue points at: inside a list, the whole list entry on
 * the path (e.g. one road point); otherwise the field itself, so its default
 * applies. Returns false when there was nothing to remove (a missing field).
 */
const removeAt = (root: unknown, path: TPath): boolean => {
	let container = root;
	for (let i = 0; i < path.length; i++) {
		const key = path[i];
		if (Array.isArray(container)) {
			if (typeof key === "number" && key < container.length) {
				container.splice(key, 1);
				return true;
			}
			return false;
		}
		if (typeof container !== "object" || container === null || typeof key === "symbol") {
			return false;
		}
		const record = container as Record<string | number, unknown>;
		if (i === path.length - 1) {
			if (key in record) {
				delete record[key];
				return true;
			}
			return false;
		}
		container = record[key];
	}
	return false;
};

/** The cleaned input and how many fixes it took, or null if it can't be repaired. */
const repairValue = (
	schema: z.ZodType,
	value: unknown,
): { value: unknown; fixes: number } | null => {
	const current = structuredClone(value);
	for (let fixes = 0; fixes <= MAX_FIXES; fixes++) {
		const result = schema.safeParse(current);
		if (result.success) {
			return { value: current, fixes };
		}
		const issue = result.error.issues[0];
		if (!issue || issue.path.length === 0 || !removeAt(current, issue.path)) {
			return null;
		}
	}
	return null;
};

/** The world's lists, by where they are in it, each repaired item by item. */
const LISTS = [
	{ path: ["entities"], schema: EntitySchema, id: "id", counter: "objects" },
	{ path: ["roads"], schema: RoadSchema, id: "id", counter: "roads" },
	{ path: ["areas"], schema: AreaSchema, id: "id", counter: "areas" },
	{ path: ["fences"], schema: FenceSchema, id: "id", counter: "fences" },
	{ path: ["data", "values"], schema: DataValueSchema, id: "key", counter: "values" },
	{ path: ["data", "tables"], schema: DataTableSchema, id: "key", counter: "tables" },
	{ path: ["data", "sources"], schema: DataSourceSchema, id: "id", counter: "sources" },
	{ path: ["viewpoints"], schema: ViewpointSchema, id: "id", counter: "viewpoints" },
	{ path: ["moods"], schema: MoodSchema, id: "id", counter: "moods" },
] as const;

type TSceneKey = keyof typeof SceneSchema.shape;
/** Top-level fields that hold lists (or only groups of lists, like data). */
const LIST_KEYS = new Set<string>(LISTS.map(({ path }) => path[0]));

/** What's at a path in a record, if every step is a record. */
const readPath = (record: Record<string, unknown>, path: readonly string[]): unknown =>
	path.reduce<unknown>(
		(at, key) =>
			typeof at === "object" && at !== null && !Array.isArray(at)
				? (at as Record<string, unknown>)[key]
				: undefined,
		record,
	);

/** Set what's at a path in a record, making the groups on the way. */
const writePath = (record: Record<string, unknown>, path: readonly string[], value: unknown) => {
	let at = record;
	for (const key of path.slice(0, -1)) {
		const next = at[key];
		at[key] = typeof next === "object" && next !== null && !Array.isArray(next) ? next : {};
		at = at[key] as Record<string, unknown>;
	}
	at[path[path.length - 1]] = value;
};

/**
 * Every other top-level field is a world setting, repaired on its own. Taken
 * from the schema, so a new setting can't be forgotten here (and silently
 * reset whenever a world needs repairing for another reason).
 */
const SETTINGS = (Object.keys(SceneSchema.shape) as TSceneKey[]).filter(
	(key) => key !== "version" && !LIST_KEYS.has(key),
);

/** Repair a world (see above). Throws if the input doesn't look like a world at all. */
export const repairScene = (input: unknown): { scene: TScene; report: IRepairReport } => {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		throw new Error("A world must be a JSON object");
	}
	// Old ids aren't broken, just renamed: upgrade them rather than reset them.
	const raw = upgradeLegacyIds(input) as Record<string, unknown>;
	const hasVersion = typeof raw.version === "number";
	if (!hasVersion && !LISTS.some(({ path }) => Array.isArray(readPath(raw, path)))) {
		throw new Error("This doesn’t look like a world: it has no version, objects, roads or areas");
	}

	const report: IRepairReport = {
		removed: {
			objects: 0,
			roads: 0,
			areas: 0,
			fences: 0,
			values: 0,
			tables: 0,
			sources: 0,
			viewpoints: 0,
			moods: 0,
		},
		fixed: 0,
		newerVersion: hasVersion && (raw.version as number) > SCENE_VERSION,
		missingVersion: !hasVersion,
	};
	const cleaned: Record<string, unknown> = { version: SCENE_VERSION };

	for (const key of SETTINGS) {
		const repaired = repairValue(SceneSchema.shape[key], raw[key]);
		if (repaired) {
			cleaned[key] = repaired.value;
			report.fixed += repaired.fixes;
		} else {
			// Leave it out so the scene's default applies.
			report.fixed += 1;
		}
	}

	for (const { path, schema, id, counter } of LISTS) {
		const items = readPath(raw, path);
		if (items !== undefined && !Array.isArray(items)) {
			report.fixed += 1;
		}
		const kept: unknown[] = [];
		const seen = new Set<unknown>();
		for (const item of Array.isArray(items) ? items : []) {
			const repaired = repairValue(schema, item);
			const itemId = (repaired?.value as Record<string, unknown> | undefined)?.[id];
			if (!repaired || seen.has(itemId)) {
				report.removed[counter] += 1;
				continue;
			}
			seen.add(itemId);
			kept.push(repaired.value);
			report.fixed += repaired.fixes;
		}
		writePath(cleaned, path, kept);
	}

	return { scene: SceneSchema.parse(cleaned), report };
};

/**
 * Parse a world strictly, and repair it only if that fails. `report` is null
 * when the world was fine as it was.
 */
export const parseOrRepairScene = (
	input: unknown,
): { scene: TScene; report: IRepairReport | null } => {
	try {
		return { scene: parseScene(input), report: null };
	} catch {
		return repairScene(input);
	}
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** A short, plain description of what a repair changed, for the user. */
export const describeRepairs = (report: IRepairReport) => {
	const { objects, roads, areas, fences, values, tables, sources, viewpoints, moods } =
		report.removed;
	const removed = [
		objects && plural(objects, "object", "objects"),
		roads && plural(roads, "road", "roads"),
		areas && plural(areas, "area", "areas"),
		fences && plural(fences, "fence", "fences"),
		values && plural(values, "data value", "data values"),
		tables && plural(tables, "data table", "data tables"),
		sources && plural(sources, "data source", "data sources"),
		viewpoints && plural(viewpoints, "viewpoint", "viewpoints"),
		moods && plural(moods, "mood", "moods"),
	].filter((part): part is string => Boolean(part));
	const removedCount =
		objects + roads + areas + fences + values + tables + sources + viewpoints + moods;

	const parts: string[] = [];
	if (report.newerVersion) {
		parts.push("It was made by a newer version of the app.");
	}
	if (report.missingVersion) {
		parts.push("It had no version number.");
	}
	if (removed.length > 0) {
		const list =
			removed.length === 1
				? removed[0]
				: `${removed.slice(0, -1).join(", ")} and ${removed.at(-1)}`;
		parts.push(`${list} couldn’t be read and ${removedCount === 1 ? "was" : "were"} left out.`);
	}
	if (report.fixed > 0) {
		parts.push(
			`${plural(report.fixed, "smaller detail", "smaller details")} (like a colour or a road point) couldn’t be read and ${report.fixed === 1 ? "was" : "were"} reset or left out.`,
		);
	}
	if (parts.length === 0) {
		parts.push("Nothing had to change.");
	}
	return parts.join(" ");
};
