import { toDataKey } from "./format";
import {
	DataColumnSchema,
	DataSourceRefSchema,
	type TDataCell,
	type TDataPoint,
	type TDataSource,
	type TDataTable,
	type TDataValue,
	type TWorldData,
} from "./schema";
import type { IReadData } from "./sheets";

/**
 * Links and APIs that answer in JSON (ADR-0113): finding what's in a response
 * (numbers to keep as values, lists to keep as tables or as a value's past),
 * reading a value or a table out of it by path, and reading a source again
 * into the same values and tables. No React, no fetching: the editor fetches
 * (`editor/readLink.ts`), this reads what came back.
 */

/** Where something is in a JSON response: keys and list indexes joined by dots ("data.0.rank"); "" = the whole. */
export type TJsonPath = string;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** What's at a path in a response; undefined if nothing is. */
export const readJsonPath = (json: unknown, path: TJsonPath): unknown => {
	if (path === "") {
		return json;
	}
	let at: unknown = json;
	for (const part of path.split(".")) {
		if (Array.isArray(at)) {
			at = at[Number(part)];
		} else if (isRecord(at)) {
			at = at[part];
		} else {
			return undefined;
		}
	}
	return at;
};

/** A path one step further in. */
const join = (path: TJsonPath, part: string | number) =>
	path === "" ? String(part) : `${path}.${part}`;

/** A JSON value as a data cell: numbers and text as they are, yes/no as text, anything else empty. */
export const jsonCell = (value: unknown): TDataCell | null => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "boolean") {
		return value ? "yes" : "no";
	}
	return null;
};

/** Whether text reads as a date: ISO dates and date-times ("2026-10-30", "2026-10-30T14:00:00Z"). */
const ISO_DATE = /^\d{4}-\d{2}(-\d{2})?([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
export const looksLikeDate = (value: unknown) =>
	typeof value === "string" && ISO_DATE.test(value.trim());

/** A field of a list's entries: its path in each entry and what it holds. */
export interface IJsonField {
	path: TJsonPath;
	kind: "number" | "text" | "date";
}

/** A list of entries found in a response: where it is, how long, and its entries' fields. */
export interface IJsonList {
	path: TJsonPath;
	length: number;
	fields: IJsonField[];
}

/** A single number found in a response. */
export interface IJsonNumber {
	path: TJsonPath;
	value: number;
}

/** What a response holds that a world can keep (ADR-0113). */
export interface IJsonContents {
	numbers: IJsonNumber[];
	lists: IJsonList[];
}

/** How many entries of a list are looked at to find its fields. */
const ENTRIES_LOOKED_AT = 50;

/** The fields of a list's entries (one level of nesting deep: "stats.kills"), with what each holds. */
const fieldsOf = (entries: readonly unknown[]): IJsonField[] => {
	const seen = new Map<string, Set<IJsonField["kind"]>>();
	const note = (path: string, value: unknown) => {
		const kind = looksLikeDate(value)
			? "date"
			: typeof value === "number"
				? "number"
				: typeof value === "string" || typeof value === "boolean"
					? "text"
					: null;
		if (kind) {
			seen.set(path, (seen.get(path) ?? new Set()).add(kind));
		}
	};
	for (const entry of entries.slice(0, ENTRIES_LOOKED_AT)) {
		if (!isRecord(entry)) {
			continue;
		}
		for (const [key, value] of Object.entries(entry)) {
			if (isRecord(value)) {
				for (const [inner, innerValue] of Object.entries(value)) {
					note(`${key}.${inner}`, innerValue);
				}
			} else {
				note(key, value);
			}
		}
	}
	return [...seen].map(([path, kinds]) => ({
		path,
		// Mixed numbers and text read as text; a date column is dates only.
		kind: kinds.size === 1 ? [...kinds][0] : "text",
	}));
};

/**
 * Everything worth keeping in a response: its numbers (not inside lists), and
 * its lists of entries with their fields. Looked for a few levels deep.
 */
export const describeJson = (json: unknown, depth = 4): IJsonContents => {
	const contents: IJsonContents = { numbers: [], lists: [] };
	const visit = (value: unknown, path: TJsonPath, left: number) => {
		if (typeof value === "number" && Number.isFinite(value)) {
			contents.numbers.push({ path, value });
		} else if (Array.isArray(value)) {
			if (value.some(isRecord)) {
				contents.lists.push({ path, length: value.length, fields: fieldsOf(value) });
			}
		} else if (isRecord(value) && left > 0) {
			for (const [key, inner] of Object.entries(value)) {
				visit(inner, join(path, key), left - 1);
			}
		}
	};
	visit(json, "", depth);
	return contents;
};

/** A field's last part as a name people read: "stats.kills" → "Kills", "rankScore" → "Rank score". */
export const nameOfField = (path: TJsonPath) => {
	const last = path.split(".").at(-1) ?? path;
	const words = last
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The first text field that's different in every entry: what names each row. */
export const guessKeyField = (entries: readonly unknown[], fields: readonly IJsonField[]) =>
	fields.find((field) => {
		if (field.kind !== "text") {
			return false;
		}
		const cells = entries.map((entry) => jsonCell(readJsonPath(entry, field.path)));
		return (
			cells.every((cell) => cell !== null && cell !== "") && new Set(cells).size === cells.length
		);
	})?.path ?? "";

/** A list's entries as rows, by the columns' fields. */
const rowsOf = (entries: readonly unknown[], columns: TDataTable["columns"]) =>
	entries.map((entry) =>
		Object.fromEntries(
			columns.map((column) => [
				column.key,
				jsonCell(readJsonPath(entry, column.field || column.key)),
			]),
		),
	);

/** A list's entries as a value's past values: each entry's date and value, oldest first. */
export const historyFromList = (
	entries: readonly unknown[],
	field: TJsonPath,
	dateField: TJsonPath,
): TDataPoint[] =>
	entries
		.flatMap((entry): TDataPoint[] => {
			const at = readJsonPath(entry, dateField);
			const value = jsonCell(readJsonPath(entry, field));
			return looksLikeDate(at) && value !== null ? [{ at: String(at).trim(), value }] : [];
		})
		.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

/** What a reading picks out of a response, as the link dialog builds it. */
export type TJsonPick =
	| { kind: "value"; path: TJsonPath; name: string; unit?: string }
	| {
			kind: "history";
			path: TJsonPath;
			field: TJsonPath;
			dateField: TJsonPath;
			name: string;
			unit?: string;
	  }
	| {
			kind: "table";
			path: TJsonPath;
			name: string;
			/** Fields kept as columns, in order. */
			fields: TJsonPath[];
			/** The field naming each row; "" = rows by their order. */
			keyField: TJsonPath;
			maxRowCount: number | null;
	  };

/** A column's key from its field: "stats.kills" → "stats_kills". */
const columnKeyOf = (field: TJsonPath) => toDataKey(field);

/**
 * The values and tables a source's picks make of a response, each knowing
 * where it came from, so reading again finds them (`putReadData`).
 */
export const dataFromJson = (
	json: unknown,
	sourceId: string,
	picks: readonly TJsonPick[],
): IReadData => {
	const read: IReadData = { values: [], tables: [] };
	for (const pick of picks) {
		if (pick.kind === "table") {
			const list = readJsonPath(json, pick.path);
			const entries = Array.isArray(list) ? list : [];
			const columns = pick.fields.map((field) =>
				DataColumnSchema.parse({ key: columnKeyOf(field), name: nameOfField(field), field }),
			);
			const kept = pick.maxRowCount === null ? entries : entries.slice(0, pick.maxRowCount);
			read.tables.push({
				key: toDataKey(pick.name),
				name: pick.name,
				source: DataSourceRefSchema.parse({
					sourceId,
					path: pick.path,
					maxRowCount: pick.maxRowCount,
				}),
				keyColumn: pick.keyField ? columnKeyOf(pick.keyField) : "",
				columns,
				rows: rowsOf(kept, columns),
				history: [],
			});
			continue;
		}
		const source = DataSourceRefSchema.parse({
			sourceId,
			path: pick.path,
			...(pick.kind === "history" ? { field: pick.field, dateField: pick.dateField } : {}),
		});
		const value = readValue(json, source);
		if (value) {
			read.values.push({
				key: toDataKey(pick.name),
				name: pick.name,
				unit: pick.unit ?? "",
				source,
				threshold: null,
				about: "",
				numberStyle: null,
				...value,
			});
		}
	}
	return read;
};

/** A value as its source says to read it from a response: one value, or a list's latest with its past. */
export const readValue = (
	json: unknown,
	source: Pick<TDataValue, "source">["source"] & object,
): Pick<TDataValue, "value" | "history"> | null => {
	const found = readJsonPath(json, source.path);
	if (source.dateField) {
		const history = Array.isArray(found)
			? historyFromList(found, source.field, source.dateField)
			: [];
		const latest = history.at(-1);
		return latest ? { value: latest.value, history } : null;
	}
	const cell = jsonCell(found);
	return cell === null ? null : { value: cell, history: [] };
};

/** A table's rows as its source says to read them from a response, by its columns' fields. */
export const readTableRows = (json: unknown, table: TDataTable): TDataTable["rows"] | null => {
	if (!table.source) {
		return null;
	}
	const list = readJsonPath(json, table.source.path);
	if (!Array.isArray(list)) {
		return null;
	}
	const max = table.source.maxRowCount;
	return rowsOf(max === null ? list : list.slice(0, max), table.columns);
};

/** What reading a source again gave: each value's and table's new reading, by key. */
export interface ISourceReading {
	values: { key: string; value: TDataCell; history: TDataPoint[] }[];
	tables: { key: string; rows: TDataTable["rows"] }[];
}

/**
 * Reading a JSON source again (ADR-0113): every value and table of the world
 * that's read from `source`, read from the response by its own path. What the
 * response no longer has is left out, so it stays as it last was.
 */
export const readSourceAgain = (
	data: Pick<TWorldData, "values" | "tables">,
	source: Pick<TDataSource, "id">,
	json: unknown,
): ISourceReading => ({
	values: data.values.flatMap((value) => {
		if (value.source?.sourceId !== source.id) {
			return [];
		}
		const read = readValue(json, value.source);
		return read ? [{ key: value.key, ...read }] : [];
	}),
	tables: data.tables.flatMap((table) => {
		if (table.source?.sourceId !== source.id) {
			return [];
		}
		const rows = readTableRows(json, table);
		return rows ? [{ key: table.key, rows }] : [];
	}),
});
