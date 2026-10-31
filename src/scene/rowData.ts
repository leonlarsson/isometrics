import type {
	TDataCell,
	TDataPoint,
	TDataRowRef,
	TDataTable,
	TDataValue,
	TWorldData,
} from "./schema";

/**
 * Things that follow a table row (ADR-0108): an object or a road names a row
 * of one of the world's tables (`dataRow`), and everything it shows or follows
 * can read that row's columns as if they were values, under the key
 * `row.<column>`. Bindings, cards and tiles stay by key, so a hundred towers
 * share the same settings and differ only in which row they follow. No React.
 */

/** The start of a key that names a column of the thing's own row. */
export const ROW_KEY_PREFIX = "row.";

/** The key that names a column of the thing's own row: "players" → "row.players". */
export const rowKeyFor = (column: string) => `${ROW_KEY_PREFIX}${column}`;

/** The column a key names, if it names one of the thing's own row ("row.players" → "players"). */
export const columnOfKey = (key: string) =>
	key.startsWith(ROW_KEY_PREFIX) ? key.slice(ROW_KEY_PREFIX.length) : null;

/** A cell as text, to compare a row's key with a name. */
const cellText = (cell: TDataCell | null | undefined) =>
	cell === null || cell === undefined ? "" : String(cell).trim();

/**
 * A row's cell in a column, only if the row has it (ADR-0119): column names
 * come from data anyone wrote, and one called "constructor" or "toString"
 * mustn't read a built-in function instead of "no value".
 */
export const cellOf = (row: TDataTable["rows"][number], column: string) =>
	Object.hasOwn(row, column) ? row[column] : undefined;

/** What a row is called: its value in the key column, or its number (from 1) without one. */
export const rowKeyOf = (
	table: Pick<TDataTable, "keyColumn">,
	row: TDataTable["rows"][number],
	index: number,
) => (table.keyColumn ? cellText(cellOf(row, table.keyColumn)) : String(index + 1));

/** The rows of a table by what they're called. */
export const rowKeysOf = (table: Pick<TDataTable, "keyColumn" | "rows">) =>
	table.rows.map((row, index) => rowKeyOf(table, row, index));

/** A row of a table by what it's called (the key column's value, or its number). */
export const findRow = (table: Pick<TDataTable, "keyColumn" | "rows">, rowKey: string) => {
	const index = rowKeysOf(table).indexOf(rowKey.trim());
	return index === -1 ? undefined : table.rows[index];
};

/** Names compared loosely: case, spaces and punctuation don't matter ("Hunt: Showdown" = "hunt showdown"). */
export const looseName = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** The row whose key matches a name loosely, for assigning rows to things by their names. */
export const rowKeyMatching = (table: Pick<TDataTable, "keyColumn" | "rows">, name: string) => {
	const wanted = looseName(name);
	if (!wanted) {
		return undefined;
	}
	return rowKeysOf(table).find((key) => looseName(key) === wanted);
};

/** A row's column over the table's past rows: its value at each moment it had one. */
const columnHistory = (table: TDataTable, rowKey: string, column: string): TDataPoint[] =>
	table.history.flatMap(({ at, rows }) => {
		const index = rows.findIndex((row, i) => rowKeyOf(table, row, i) === rowKey);
		const cell = index === -1 ? null : cellOf(rows[index], column);
		return cell === null || cell === undefined || cell === "" ? [] : [{ at, value: cell }];
	});

/**
 * A row's columns as values, keyed `row.<column>`: named and with units as the
 * table's columns, their past from the table's past rows, watched against the
 * column's line. Empty cells are left out, so they read as no data.
 */
export const rowEntries = (table: TDataTable, rowKey: string): TDataValue[] => {
	const row = findRow(table, rowKey);
	if (!row) {
		return [];
	}
	return table.columns.flatMap((column): TDataValue[] => {
		const cell = cellOf(row, column.key);
		if (cell === null || cell === undefined || cell === "") {
			return [];
		}
		return [
			{
				key: rowKeyFor(column.key),
				name: column.name || column.key,
				value: cell,
				unit: column.unit,
				source: table.source,
				history: columnHistory(table, rowKey, column.key),
				threshold: column.threshold,
				about: column.about,
			},
		];
	});
};

/** The table a thing's row is in, if the world still has it. */
export const tableOfRow = (data: Pick<TWorldData, "tables">, ref: TDataRowRef | null) =>
	ref ? data.tables.find((table) => table.key === ref.tableKey) : undefined;

/** Per world data: what each row reads as, so things following the same row share one list. */
const cache = new WeakMap<TWorldData, Map<string, readonly TDataValue[]>>();

/**
 * What a thing that follows `ref` can read: the world's values, then its row's
 * columns as `row.<column>`. The world's values alone when it follows no row
 * (the same list, so memoised readers stay settled).
 */
export const valuesWithRow = (
	data: TWorldData,
	ref: TDataRowRef | null | undefined,
): readonly TDataValue[] => {
	if (!ref) {
		return data.values;
	}
	let byRow = cache.get(data);
	if (!byRow) {
		byRow = new Map();
		cache.set(data, byRow);
	}
	const id = `${ref.tableKey}\u0000${ref.rowKey}`;
	let values = byRow.get(id);
	if (!values) {
		const table = tableOfRow(data, ref);
		values = table ? [...data.values, ...rowEntries(table, ref.rowKey)] : data.values;
		byRow.set(id, values);
	}
	return values;
};

/** The columns a thing following a row of `table` can read, as keys with names, for pickers. */
export const rowColumnChoices = (table: TDataTable | undefined) =>
	(table?.columns ?? []).map((column) => ({
		key: rowKeyFor(column.key),
		name: column.name || column.key,
	}));
