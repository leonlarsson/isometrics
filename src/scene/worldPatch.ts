import type { TScene } from "./schema";

/**
 * World patches (ADR-0118): the changes to a world, without the rest of it,
 * so an AI asked to change a world answers with a few lines, not the whole
 * world again. No React.
 *
 * A patch is shaped like the world, with the same field names, plus
 * `"isPatch": true`:
 *
 *     {
 *       "isPatch": true,
 *       "lighting": { "time": 19.5 },
 *       "entities": {
 *         "change": [{ "id": "lighthouse", "scale": 1.6 }],
 *         "add": [{ "id": "boat_2", "kind": "sailing_boat_01", "position": [12, 8] }],
 *         "remove": ["old_shed"]
 *       }
 *     }
 *
 * - A settings group (`lighting`, `meta`, `camera`, …) is merged in as JSON
 *   Merge Patch does (RFC 7396): the fields given change, groups inside merge
 *   the same way, a list is replaced whole, and `null` removes a field so its
 *   default applies.
 * - A list of things with ids (`entities`, `roads`, `areas`, `fences`,
 *   `viewpoints`, `moods`, and `data`'s `values` and `tables` by `key`,
 *   `sources` by `id`) takes `remove` (ids), `change` (each a merge patch for
 *   the thing with that id) and `add` (whole things), in that order.
 *
 * Why not JSON Patch (RFC 6902), the standard for patching JSON? It points at
 * things by their place in a list (`/entities/37/scale`). An AI writing a
 * patch for a world of hundreds of objects miscounts places, and every remove
 * shifts the places after it, so one slip changes the wrong object, silently.
 * Ids are what an AI gets right, and what the world already uses to name
 * things. This is the shape Kubernetes chose for the same reason ("strategic
 * merge patch": merge patch for objects, lists merged by a key), and it reads
 * like the world itself: whoever knows the world format can read a patch.
 */

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** A problem with a patch, where it is in the patch and what's wrong. */
export interface IPatchIssue {
	where: string;
	what: string;
}

/** What a patch changes, for saying it before it's put in place. */
export interface IPatchChanges {
	/** By list: the things added, changed (with which fields) and removed, by name. */
	lists: {
		list: string;
		added: string[];
		changed: { name: string; fields: string[] }[];
		removed: string[];
	}[];
	/** The settings groups changed, with which fields. */
	settings: { group: string; fields: string[] }[];
}

/** The world's lists of things, where they are and what names each thing. */
export const PATCH_LISTS = [
	{ path: ["entities"], id: "id", one: "object" },
	{ path: ["roads"], id: "id", one: "road" },
	{ path: ["areas"], id: "id", one: "area" },
	{ path: ["fences"], id: "id", one: "fence" },
	{ path: ["viewpoints"], id: "id", one: "viewpoint" },
	{ path: ["moods"], id: "id", one: "mood" },
	{ path: ["data", "values"], id: "key", one: "data value" },
	{ path: ["data", "tables"], id: "key", one: "data table" },
	{ path: ["data", "sources"], id: "id", one: "data source" },
] as const;

const LIST_TOP_KEYS = new Set<string>(PATCH_LISTS.map(({ path }) => path[0]));

/** Whether a document is a patch rather than a whole world. */
export const isWorldPatch = (value: unknown): value is TRecord =>
	isRecord(value) && value.isPatch === true;

/** JSON Merge Patch (RFC 7396): `patch` merged into `target`; null removes a field. */
export const mergePatch = (target: unknown, patch: unknown): unknown => {
	if (!isRecord(patch)) {
		return structuredClone(patch);
	}
	const result: TRecord = isRecord(target) ? { ...target } : {};
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) {
			delete result[key];
		} else {
			result[key] = mergePatch(result[key], value);
		}
	}
	return result;
};

/** How a thing is named in what a patch says: its name, else its id. */
const nameOf = (item: unknown, id: string) => {
	const name = isRecord(item) ? (item.name ?? item.title) : undefined;
	return typeof name === "string" && name.trim() ? name.trim() : id;
};

/** One list's `remove`, `change` and `add`, applied to its things. */
const applyToList = (
	items: unknown[],
	ops: unknown,
	where: string,
	id: string,
	issues: IPatchIssue[],
) => {
	const changes = {
		added: [] as string[],
		changed: [] as { name: string; fields: string[] }[],
		removed: [] as string[],
	};
	if (!isRecord(ops)) {
		issues.push({
			where,
			what: `a list in a patch is { "add": [...], "change": [...], "remove": [...] }, not ${Array.isArray(ops) ? "the whole list" : "this"}`,
		});
		return { items, changes };
	}
	for (const key of Object.keys(ops)) {
		if (key !== "add" && key !== "change" && key !== "remove") {
			issues.push({
				where: `${where}.${key}`,
				what: 'only "add", "change" and "remove" are understood here',
			});
		}
	}
	let list = [...items];
	const idOf = (item: unknown) => (isRecord(item) ? item[id] : undefined);
	const remove = ops.remove ?? [];
	if (!Array.isArray(remove)) {
		issues.push({ where: `${where}.remove`, what: `a list of ${id}s to remove` });
	} else {
		remove.forEach((gone, index) => {
			const at = list.findIndex((item) => idOf(item) === gone);
			if (at === -1) {
				issues.push({
					where: `${where}.remove[${index}]`,
					what: `there's nothing with ${id} "${String(gone)}" to remove`,
				});
				return;
			}
			changes.removed.push(nameOf(list[at], String(gone)));
			list = list.filter((_, each) => each !== at);
		});
	}
	const change = ops.change ?? [];
	if (!Array.isArray(change)) {
		issues.push({
			where: `${where}.change`,
			what: `a list of changes, each with the ${id} of what it changes`,
		});
	} else {
		change.forEach((patch, index) => {
			const target = isRecord(patch) ? patch[id] : undefined;
			const at = list.findIndex((item) => idOf(item) === target);
			if (!isRecord(patch) || target === undefined) {
				issues.push({
					where: `${where}.change[${index}]`,
					what: `a change needs the ${id} of what it changes`,
				});
				return;
			}
			if (at === -1) {
				issues.push({
					where: `${where}.change[${index}]`,
					what: `there's nothing with ${id} "${String(target)}" to change (to make one, put it in "add")`,
				});
				return;
			}
			const { [id]: _, ...fields } = patch;
			list[at] = mergePatch(list[at], fields);
			changes.changed.push({ name: nameOf(list[at], String(target)), fields: Object.keys(fields) });
		});
	}
	const add = ops.add ?? [];
	if (!Array.isArray(add)) {
		issues.push({ where: `${where}.add`, what: "a list of whole things to add" });
	} else {
		add.forEach((item, index) => {
			const added = idOf(item);
			if (!isRecord(item) || added === undefined) {
				issues.push({
					where: `${where}.add[${index}]`,
					what: `a thing to add needs its own ${id}`,
				});
				return;
			}
			if (list.some((each) => idOf(each) === added)) {
				issues.push({
					where: `${where}.add[${index}]`,
					what: `${id} "${String(added)}" is already there (to change it, put it in "change")`,
				});
				return;
			}
			list.push(structuredClone(item));
			changes.added.push(nameOf(item, String(added)));
		});
	}
	return { items: list, changes };
};

/**
 * A patch applied to a world: the patched world (to read with `readWorld`
 * like any other), what's wrong with the patch, and what it changes. What's
 * wrong is left out of the patched world; the rest still applies.
 */
export const applyWorldPatch = (
	world: TScene,
	patch: TRecord,
): { world: TRecord; issues: IPatchIssue[]; changes: IPatchChanges } => {
	const result = structuredClone(world) as unknown as TRecord;
	const issues: IPatchIssue[] = [];
	const changes: IPatchChanges = { lists: [], settings: [] };

	for (const { path, id, one } of PATCH_LISTS) {
		const ops =
			path.length === 1
				? patch[path[0]]
				: isRecord(patch[path[0]])
					? (patch[path[0]] as TRecord)[path[1]]
					: undefined;
		if (ops === undefined) {
			continue;
		}
		const holder = (path.length === 1 ? result : (result[path[0]] as TRecord)) ?? {};
		const key = path[path.length - 1];
		const applied = applyToList(
			Array.isArray(holder[key]) ? (holder[key] as unknown[]) : [],
			ops,
			path.join("."),
			id,
			issues,
		);
		holder[key] = applied.items;
		changes.lists.push({ list: one, ...applied.changes });
	}

	for (const [key, value] of Object.entries(patch)) {
		if (key === "isPatch" || key === "version" || (LIST_TOP_KEYS.has(key) && key !== "data")) {
			continue;
		}
		if (!(key in result)) {
			issues.push({ where: key, what: "isn't part of a world" });
			continue;
		}
		if (key === "data") {
			// The data group's own settings (isOn); its lists were patched above.
			if (!isRecord(value)) {
				issues.push({ where: "data", what: "the data group's changes, { ... }" });
				continue;
			}
			const own = Object.fromEntries(
				Object.entries(value).filter(([field]) => !["values", "tables", "sources"].includes(field)),
			);
			if (Object.keys(own).length > 0) {
				result.data = mergePatch(result.data, own);
				changes.settings.push({ group: "data", fields: Object.keys(own) });
			}
			continue;
		}
		if (!isRecord(value)) {
			issues.push({
				where: key,
				what: `the changes to ${key}, as { "field": value }, not a whole value`,
			});
			continue;
		}
		result[key] = mergePatch(result[key], value);
		changes.settings.push({ group: key, fields: Object.keys(value) });
	}
	return { world: result, issues, changes };
};

/** What a patch changes, in a sentence: "Changes Lighthouse (scale); adds Boat 2; removes Old shed; changes lighting (time)." */
export const describePatchChanges = ({ lists, settings }: IPatchChanges) => {
	const parts = [
		...lists.flatMap(({ added, changed, removed }) => [
			...changed.map(({ name, fields }) => `changes ${name} (${fields.join(", ")})`),
			...(added.length > 0 ? [`adds ${added.join(", ")}`] : []),
			...(removed.length > 0 ? [`removes ${removed.join(", ")}`] : []),
		]),
		...settings.map(({ group, fields }) => `changes ${group} (${fields.join(", ")})`),
	];
	if (parts.length === 0) {
		return "Changes nothing.";
	}
	const sentence = parts.join("; ");
	return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
};
