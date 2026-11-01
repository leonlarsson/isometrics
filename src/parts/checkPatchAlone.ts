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
	SceneSchema,
	ViewpointSchema,
	WorldDataSchema,
} from "#/scene/schema";
import { applyWorldPatch, PATCH_LISTS } from "#/scene/worldPatch";

import { checkWorld, type IWorldIssue } from "./checkWorld";

/**
 * Checking a patch (ADR-0118) on its own, without the world it's for: what a
 * patch kept by link (ADR-0120) must pass, so only patches are kept, never
 * any JSON with `"isPatch": true`. No React.
 *
 * - Its fields are the world's own (and `isPatch`, `version`); a list of
 *   things holds only `remove` (ids), `change` (each with its thing's id) and
 *   `add`.
 * - What it adds and the settings it merges are put on an empty world and
 *   checked as a world is (`checkWorld`): every problem counts, none repaired.
 * - Each change's fields are fields of that kind of thing, each value one
 *   that field takes (`null` puts back its default). A thing's own settings
 *   (`props`, `colors`, `lights`) depend on its kind, which only its world
 *   knows: checked there, when the patch is put in place.
 */

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Each list's things' schema, by the list's path. */
const ITEM_SCHEMAS: Record<string, z.ZodObject> = {
	entities: EntitySchema,
	roads: RoadSchema,
	areas: AreaSchema,
	fences: FenceSchema,
	viewpoints: ViewpointSchema,
	moods: MoodSchema,
	"data.values": DataValueSchema,
	"data.tables": DataTableSchema,
	"data.sources": DataSourceSchema,
};

const WORLD_FIELDS = new Set([...Object.keys(SceneSchema.shape), "isPatch", "version"]);
const DATA_FIELDS = new Set(Object.keys(WorldDataSchema.shape));
const LIST_FIELDS = new Set(["remove", "change", "add"]);

/** The value at a path in the patch, if any. */
const at = (patch: TRecord, path: readonly string[]) =>
	path.reduce<unknown>((node, key) => (isRecord(node) ? node[key] : undefined), patch);

/** What's wrong with one list's `remove`, `change` and `add`. */
const listProblems = (
	where: string,
	node: unknown,
	idKey: string,
	schema: z.ZodObject,
): IWorldIssue[] => {
	if (!isRecord(node)) {
		return [{ where, what: "a list's changes are an object of remove, change and add" }];
	}
	const problems: IWorldIssue[] = [];
	const problem = (at: string, what: string) => problems.push({ where: at, what });
	for (const key of Object.keys(node)) {
		if (!LIST_FIELDS.has(key)) {
			problem(`${where}.${key}`, "a list takes only remove, change and add");
		}
	}
	const { remove, change, add } = node;
	if (
		remove !== undefined &&
		!(Array.isArray(remove) && remove.every((id) => typeof id === "string"))
	) {
		problem(`${where}.remove`, `the ${idKey}s of the things to remove, as a list of strings`);
	}
	if (add !== undefined && !(Array.isArray(add) && add.every(isRecord))) {
		problem(`${where}.add`, "whole things to add, as a list of objects");
	}
	if (change === undefined) {
		return problems;
	}
	if (!Array.isArray(change)) {
		problem(`${where}.change`, "the changes, as a list of objects");
		return problems;
	}
	const fields = schema.shape as Record<string, z.ZodType>;
	change.forEach((each, index) => {
		const here = `${where}.change[${index}]`;
		if (!isRecord(each) || typeof each[idKey] !== "string") {
			problem(here, `each change names its thing by "${idKey}"`);
			return;
		}
		for (const [key, value] of Object.entries(each)) {
			const field = Object.hasOwn(fields, key) ? fields[key] : undefined;
			if (!field) {
				problem(`${here}.${key}`, "isn't a field of this kind of thing");
				continue;
			}
			// null puts the field back to its default (JSON Merge Patch).
			if (value === null) {
				continue;
			}
			const parsed = field.safeParse(value);
			if (!parsed.success) {
				problem(`${here}.${key}`, parsed.error.issues[0]?.message ?? "not a value it takes");
			}
		}
	});
	return problems;
};

/** The patch with only what it adds and the settings it merges: what an empty world can check. */
const withoutChanges = (patch: TRecord): TRecord => {
	const probe = structuredClone(patch);
	for (const { path } of PATCH_LISTS) {
		const parent = at(probe, path.slice(0, -1));
		const key = path[path.length - 1];
		if (isRecord(parent) && isRecord(parent[key])) {
			const add = (parent[key] as TRecord).add;
			parent[key] = { add: Array.isArray(add) ? add : [] };
		}
	}
	return probe;
};

/** Every problem a patch has on its own; empty when it's a patch that can be kept. */
export const checkPatchAlone = (patch: TRecord): IWorldIssue[] => {
	const problems: IWorldIssue[] = [];
	for (const key of Object.keys(patch)) {
		if (!WORLD_FIELDS.has(key)) {
			problems.push({ where: key, what: "isn't a field of the world" });
		}
	}
	if (isRecord(patch.data)) {
		for (const key of Object.keys(patch.data)) {
			if (!DATA_FIELDS.has(key)) {
				problems.push({ where: `data.${key}`, what: "isn't a field of the world's data" });
			}
		}
	}
	for (const { path, id } of PATCH_LISTS) {
		const node = at(patch, path);
		if (node !== undefined) {
			const name = path.join(".");
			problems.push(...listProblems(name, node, id, ITEM_SCHEMAS[name]));
		}
	}
	if (problems.length > 0) {
		return problems;
	}
	// What it adds and the settings it merges, on an empty world, checked as a world is.
	const { world, issues } = applyWorldPatch(
		SceneSchema.parse({ version: 1 }),
		withoutChanges(patch),
	);
	const check = checkWorld(world);
	return [
		...issues.map((issue) => ({ where: `patch ${issue.where}`, what: issue.what })),
		...check.problems,
	];
};
