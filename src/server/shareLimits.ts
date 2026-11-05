/**
 * How much a share can hold (ADR-0145). A shared link is public and kept for
 * up to 30 days, so it must not be a cheap place to keep anything else (a page
 * of text, a file), and what a stranger shares must not freeze the tab of
 * whoever opens it. These limits apply only when sharing: worlds saved in a
 * browser or opened from a file are never held to them (a limit is never
 * tightened on what people already have). No Cloudflare imports here.
 */

/** A world is kept at most this big, as kept (defaults left out): Stockholm is about 519 kB. */
export const MOST_SHARED_WORLD_BYTES = 1_500_000;

/** A prefab is kept at most this big: a few pieces, a fifth of a world, as before. */
export const MOST_SHARED_PREFAB_BYTES = 300_000;

/** No text in a share is longer than this: titles, labels, data values, descriptions, keys. */
export const MOST_TEXT_LENGTH = 2000;

/** Most of each kind of thing a shared world holds: Stockholm has 1,144 objects, 25 areas. */
export const MOST_SHARED_ITEMS = {
	entities: 10_000,
	roads: 1000,
	areas: 1000,
	fences: 1000,
	prefabs: 500,
	/** Every table's rows together, and their past rows. */
	dataRows: 20_000,
} as const;

/** Most pieces and fences in a shared prefab (or in each of a world's prefabs). */
export const MOST_PREFAB_ITEMS = { entities: 2000, fences: 200 } as const;

/** No list in a share is longer than this (a road's points, a table's columns, anything). */
export const MOST_LIST_LENGTH = 20_000;

/** What's over a limit, where and what, in words for whoever sent it. */
export interface IShareLimitProblem {
	where: string;
	what: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const count = (value: number) => value.toLocaleString("en");

/**
 * The first text longer than MOST_TEXT_LENGTH (a value or a key), or list
 * longer than MOST_LIST_LENGTH, anywhere in `value`, with its path, or null.
 * Paths read as `entities[3].label`.
 */
export const tooLongIn = (value: unknown): IShareLimitProblem | null => {
	const walk = (at: unknown, path: string): IShareLimitProblem | null => {
		if (typeof at === "string") {
			return at.length > MOST_TEXT_LENGTH
				? {
						where: path || "(the whole thing)",
						what: `a text of ${count(at.length)} characters: at most ${count(MOST_TEXT_LENGTH)} can be shared`,
					}
				: null;
		}
		if (Array.isArray(at)) {
			if (at.length > MOST_LIST_LENGTH) {
				return {
					where: path || "(the whole thing)",
					what: `a list of ${count(at.length)}: at most ${count(MOST_LIST_LENGTH)} can be shared`,
				};
			}
			for (const [index, item] of at.entries()) {
				const found = walk(item, `${path}[${index}]`);
				if (found) {
					return found;
				}
			}
			return null;
		}
		if (isRecord(at)) {
			for (const [key, item] of Object.entries(at)) {
				if (key.length > MOST_TEXT_LENGTH) {
					return {
						where: path || "(the whole thing)",
						what: `a name (key) of ${count(key.length)} characters: at most ${count(MOST_TEXT_LENGTH)} can be shared`,
					};
				}
				const found = walk(item, path ? `${path}.${key}` : key);
				if (found) {
					return found;
				}
			}
		}
		return null;
	};
	return walk(value, "");
};

const lengthOf = (value: unknown) => (Array.isArray(value) ? value.length : 0);

/** A prefab's pieces and fences over MOST_PREFAB_ITEMS, at `where`, or null. */
export const tooManyInPrefab = (prefab: unknown, where = ""): IShareLimitProblem | null => {
	if (!isRecord(prefab)) {
		return null;
	}
	for (const list of ["entities", "fences"] as const) {
		const length = lengthOf(prefab[list]);
		if (length > MOST_PREFAB_ITEMS[list]) {
			return {
				where: where ? `${where}.${list}` : list,
				what: `${count(length)} of them: a shared prefab has at most ${count(MOST_PREFAB_ITEMS[list])}`,
			};
		}
	}
	return null;
};

/** A world's (or a patch's) lists over MOST_SHARED_ITEMS, or null. */
export const tooManyInWorld = (world: unknown): IShareLimitProblem | null => {
	if (!isRecord(world)) {
		return null;
	}
	for (const list of ["entities", "roads", "areas", "fences", "prefabs"] as const) {
		// A patch changes lists by remove, change and add: what it adds counts.
		const field = world[list];
		const length = lengthOf(field) + (isRecord(field) ? lengthOf(field.add) : 0);
		if (length > MOST_SHARED_ITEMS[list]) {
			return {
				where: list,
				what: `${count(length)} of them: a shared world has at most ${count(MOST_SHARED_ITEMS[list])}`,
			};
		}
	}
	const prefabs = world.prefabs;
	for (const [index, prefab] of (Array.isArray(prefabs) ? prefabs : []).entries()) {
		const found = tooManyInPrefab(prefab, `prefabs[${index}]`);
		if (found) {
			return found;
		}
	}
	const data = world.data;
	const tables = isRecord(data) && Array.isArray(data.tables) ? data.tables : [];
	let rows = 0;
	for (const table of tables) {
		if (isRecord(table)) {
			rows += lengthOf(table.rows);
			for (const moment of Array.isArray(table.history) ? table.history : []) {
				rows += isRecord(moment) ? lengthOf(moment.rows) : 0;
			}
		}
	}
	if (rows > MOST_SHARED_ITEMS.dataRows) {
		return {
			where: "data.tables",
			what: `${count(rows)} rows in all (past rows included): a shared world has at most ${count(MOST_SHARED_ITEMS.dataRows)}`,
		};
	}
	return null;
};

/** The size of a text in bytes, as kept (UTF-8). */
export const bytesOf = (text: string) => new TextEncoder().encode(text).length;

/** A size in words: "519 kB", "1.5 MB". */
export const sizeInWords = (bytes: number) =>
	bytes >= 1_000_000
		? `${(bytes / 1_000_000).toLocaleString("en", { maximumFractionDigits: 1 })} MB`
		: `${Math.ceil(bytes / 1000).toLocaleString("en")} kB`;
