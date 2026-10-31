import { toDataKey } from "./format";
import {
	DataColumnSchema,
	DataSourceRefSchema,
	type TDataSource,
	type TDataTable,
	type TDataValue,
	type TWorldData,
} from "./schema";

/**
 * Spreadsheets read into a world's data (data study, step 2): a file's rows
 * typed column by column, a guess at what they hold (a table, values over
 * time, a value per column or one per row), the values and tables that
 * makes, and putting them in the world. CSV text is parsed here; Excel files
 * are read in the editor (`editor/readSpreadsheet.ts`) into the same rows.
 */

/** A cell as a file gives it: text, a number, yes/no, a date, or nothing. */
export type TSheetCell = string | number | boolean | Date | null;

export type TColumnKind = "number" | "date" | "text";

export interface ISheetColumn {
	/** Its header as written, or "Column 3" without one. */
	name: string;
	/** Its header as a data key, unique among the sheet's columns. */
	key: string;
	kind: TColumnKind;
	/** The unit every number in it has after it, as written ("%", " min"); "" for none. */
	unit: string;
	/** Its cells, read: numbers in a number column, ISO dates in a date column, else text; null when empty. */
	cells: (number | string | null)[];
	/** Every row has a different, non-empty cell in it, so it can name the rows. */
	namesRows: boolean;
}

/** A sheet read and typed: its columns, each with a cell for every row. */
export interface ISheet {
	columns: ISheetColumn[];
	rowCount: number;
}

/** The delimiter a CSV uses: whichever of comma, semicolon and tab its first line has most of. */
const delimiterOf = (text: string): string => {
	const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
	let quoted = false;
	for (const char of text) {
		if (char === '"') {
			quoted = !quoted;
		} else if (!quoted && (char === "\n" || char === "\r")) {
			break;
		} else if (!quoted && char in counts) {
			counts[char] += 1;
		}
	}
	return Object.entries(counts).reduce((best, each) => (each[1] > best[1] ? each : best))[0];
};

/** CSV text as rows of cells (RFC 4180: quoted cells may hold delimiters, quotes and line breaks). */
export const parseCsv = (text: string): { rows: string[][]; delimiter: string } => {
	const source = text.replace(/^﻿/, "");
	const delimiter = delimiterOf(source);
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	for (let i = 0; i < source.length; i += 1) {
		const char = source[i];
		if (quoted) {
			if (char === '"' && source[i + 1] === '"') {
				cell += '"';
				i += 1;
			} else if (char === '"') {
				quoted = false;
			} else {
				cell += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === delimiter) {
			row.push(cell);
			cell = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && source[i + 1] === "\n") {
				i += 1;
			}
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else {
			cell += char;
		}
	}
	if (cell !== "" || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return { rows, delimiter };
};

/** What sheets write for "nothing here" in a column of numbers or dates. */
const BLANK_WORDS = new Set(["", "-", "–", "—", "n/a", "#n/a", "null"]);

const isBlank = (cell: TSheetCell) =>
	cell === null || (typeof cell === "string" && BLANK_WORDS.has(cell.trim().toLowerCase()));

/**
 * Text as a number and the unit after it ("92%", "12 min", "1,234.5"), or
 * null. With `decimalComma` (files from where 1.234,5 is a number) the comma
 * is the decimal point and dots and spaces group thousands.
 */
export const readNumber = (
	text: string,
	decimalComma: boolean,
): { value: number; unit: string } | null => {
	const match = /^([-+−]?)\s*(\d[\d\s.,'’]*)(.*)$/.exec(text.trim());
	if (!match) {
		return null;
	}
	const [, sign, digits, rest] = match;
	// A unit is short text without digits: "2023-01-01" or "3.1.2" isn't a number.
	if (/\d/.test(rest) || rest.trim().length > 8) {
		return null;
	}
	const grouped = digits.trimEnd().replace(/[\s'’]/g, "");
	// Thousands are grouped by dots (with a decimal comma) or commas, three digits at a time.
	const plain = decimalComma
		? grouped.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")
		: grouped.replace(/,(?=\d{3}(\D|$))/g, "");
	if (!/^\d+(\.\d+)?$/.test(plain)) {
		return null;
	}
	const value = Number(plain) * (sign === "-" || sign === "−" ? -1 : 1);
	// What follows the number, as written, with a space if there was one ("12 min" → " min").
	const spaced = digits !== digits.trimEnd() || /^\s/.test(rest);
	const unit = rest.trim() === "" ? "" : `${spaced ? " " : ""}${rest.trim()}`;
	return { value, unit };
};

const ISO_DATE =
	/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01])([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?)?$/;
const DAY_MONTH_YEAR = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** A date as ISO text: the day alone when it has no time of day. */
const isoOf = (date: Date) =>
	date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0
		? date.toISOString().slice(0, 10)
		: date.toISOString();

/** A column's dates as ISO text, or null if it isn't one of dates. */
const readDates = (name: string, cells: TSheetCell[]): (string | null)[] | null => {
	const filled = cells.filter((cell) => !isBlank(cell));
	if (filled.length === 0) {
		return null;
	}
	// A column of years: its header says so, and every cell is one.
	if (
		/^(year|years|år|jahr)$/i.test(name.trim()) &&
		filled.every((cell) => /^[12]\d{3}$/.test(String(cell).trim()))
	) {
		return cells.map((cell) => (isBlank(cell) ? null : String(cell).trim()));
	}
	// 3/4/2026: day first unless a second part above 12 says the month comes first.
	const slashed = filled.map((cell) =>
		typeof cell === "string" ? DAY_MONTH_YEAR.exec(cell.trim()) : null,
	);
	const monthFirst = slashed.some((match) => match && Number(match[2]) > 12);
	const readOne = (cell: TSheetCell): string | null | undefined => {
		if (isBlank(cell)) {
			return null;
		}
		if (cell instanceof Date) {
			return Number.isNaN(cell.getTime()) ? undefined : isoOf(cell);
		}
		if (typeof cell !== "string") {
			return undefined;
		}
		const text = cell.trim();
		if (ISO_DATE.test(text)) {
			return text.replace(" ", "T");
		}
		const match = DAY_MONTH_YEAR.exec(text);
		if (!match) {
			return undefined;
		}
		const [day, month] = monthFirst
			? [Number(match[2]), Number(match[1])]
			: [Number(match[1]), Number(match[2])];
		return day >= 1 && day <= 31 && month >= 1 && month <= 12
			? `${match[3]}-${pad(month)}-${pad(day)}`
			: undefined;
	};
	const read = cells.map(readOne);
	return read.every((cell) => cell !== undefined) ? (read as (string | null)[]) : null;
};

/** A column's numbers and their shared unit, or null if it isn't one of numbers. */
const readNumbers = (
	cells: TSheetCell[],
	decimalComma: boolean,
): { cells: (number | null)[]; unit: string } | null => {
	let unit: string | null = null;
	const read: (number | null)[] = [];
	for (const cell of cells) {
		if (isBlank(cell)) {
			read.push(null);
			continue;
		}
		const number =
			typeof cell === "number"
				? { value: cell, unit: "" }
				: typeof cell === "string"
					? readNumber(cell, decimalComma)
					: null;
		if (!number || (unit !== null && number.unit !== unit)) {
			return null;
		}
		unit = number.unit;
		read.push(number.value);
	}
	return unit === null ? null : { cells: read, unit };
};

const textOf = (cell: TSheetCell): string | null => {
	if (cell === null) {
		return null;
	}
	if (cell instanceof Date) {
		return isoOf(cell);
	}
	const text = String(cell).trim();
	return text === "" ? null : text;
};

/** A key not in `taken`: the base, else the base with _2, _3… (and taken from then on). */
const uniqueKey = (base: string, taken: Set<string>) => {
	let key = base;
	for (let n = 2; taken.has(key); n += 1) {
		key = `${base}_${n}`;
	}
	taken.add(key);
	return key;
};

/**
 * A sheet's rows (the first is the header) read and typed: each column as
 * dates, numbers or text, whichever all its cells read as. Empty rows and
 * empty columns without a header are left out.
 */
export const readSheet = (
	rows: readonly (readonly TSheetCell[])[],
	{ decimalComma = false }: { decimalComma?: boolean } = {},
): ISheet => {
	const filled = rows.filter((row) => row.some((cell) => textOf(cell) !== null));
	const [header = [], ...body] = filled;
	const width = Math.max(0, ...filled.map((row) => row.length));
	const keys = new Set<string>();
	const columns: ISheetColumn[] = [];
	for (let index = 0; index < width; index += 1) {
		const raw = body.map((row) => row[index] ?? null);
		const heading = textOf(header[index] ?? null);
		if (heading === null && raw.every((cell) => textOf(cell) === null)) {
			continue;
		}
		const name = heading ?? `Column ${index + 1}`;
		const dates = readDates(name, raw);
		const numbers = dates ? null : readNumbers(raw, decimalComma);
		const cells = dates ?? numbers?.cells ?? raw.map(textOf);
		const named = cells.filter((cell) => cell !== null).map(String);
		columns.push({
			name,
			key: uniqueKey(toDataKey(name), keys),
			kind: dates ? "date" : numbers ? "number" : "text",
			unit: numbers?.unit ?? "",
			cells,
			namesRows: named.length === body.length && new Set(named).size === named.length,
		});
	}
	return { columns, rowCount: body.length };
};

/** What a sheet is read as, and which of its columns say what. */
export type TSheetReading =
	/** A table, its rows named by a column's cells ("" = by their order). */
	| { readsAs: "table"; keyColumn: string }
	/** Values over time: each column of numbers a value, its rows past values at the dates in a column. */
	| { readsAs: "history"; dateColumn: string }
	/** A value for each column, from the last row. */
	| { readsAs: "valuePerColumn" }
	/** A value for each row, named by one column, its value in another. */
	| { readsAs: "valuePerRow"; nameColumn: string; valueColumn: string };

export type TReadsAs = TSheetReading["readsAs"];

/** Why a sheet can't be read a way, in words for a greyed-out option; null if it can. */
export const whyNotReadAs = (sheet: ISheet, readsAs: TReadsAs): string | null => {
	if (sheet.rowCount === 0) {
		return "no rows";
	}
	if (readsAs === "history") {
		if (!sheet.columns.some((column) => column.kind === "date")) {
			return "no column of dates";
		}
		return sheet.columns.some((column) => column.kind === "number") ? null : "no column of numbers";
	}
	if (readsAs === "valuePerRow") {
		if (sheet.columns.length < 2) {
			return "only one column";
		}
		return sheet.columns.some((column) => column.namesRows) ? null : "no column names every row";
	}
	return null;
};

/** The column that best names a table's rows: text that names every row, else anything that does. */
export const rowNamingColumn = (sheet: ISheet): string =>
	(
		sheet.columns.find((column) => column.kind === "text" && column.namesRows) ??
		sheet.columns.find((column) => column.namesRows)
	)?.key ?? "";

/** The reading a sheet's shape suggests, and a valid reading of each kind it can be read as. */
export const readingAs = (sheet: ISheet, readsAs: TReadsAs): TSheetReading => {
	if (readsAs === "history") {
		return {
			readsAs,
			dateColumn: sheet.columns.find((column) => column.kind === "date")?.key ?? "",
		};
	}
	if (readsAs === "valuePerRow") {
		const nameColumn =
			sheet.columns.find((column) => column.kind === "text" && column.namesRows) ??
			sheet.columns.find((column) => column.namesRows);
		const valueColumn =
			sheet.columns.find((column) => column !== nameColumn && column.kind === "number") ??
			sheet.columns.find((column) => column !== nameColumn);
		return { readsAs, nameColumn: nameColumn?.key ?? "", valueColumn: valueColumn?.key ?? "" };
	}
	if (readsAs === "valuePerColumn") {
		return { readsAs };
	}
	return { readsAs, keyColumn: rowNamingColumn(sheet) };
};

/**
 * What a sheet most likely holds: values over time if it has dates and
 * numbers, values if it has one row, a value per row if it's a column of
 * names and one of values, else a table.
 */
export const guessReading = (sheet: ISheet): TSheetReading => {
	if (sheet.rowCount >= 2 && whyNotReadAs(sheet, "history") === null) {
		return readingAs(sheet, "history");
	}
	if (sheet.rowCount === 1) {
		return readingAs(sheet, "valuePerColumn");
	}
	if (
		sheet.columns.length === 2 &&
		sheet.columns.some((column) => column.kind === "text" && column.namesRows)
	) {
		return readingAs(sheet, "valuePerRow");
	}
	return readingAs(sheet, "table");
};

/** The values and tables read from a source, before they're put in the world. */
export interface IReadData {
	values: TDataValue[];
	tables: TDataTable[];
}

/**
 * The values and tables a sheet gives, read as `reading`. They name the
 * source and where in it each came from (a column, a row, or the sheet for a
 * table), which is how reading it again finds them. Keys are made from names
 * and made unique when they're put in the world (`putReadData`).
 */
export const dataFromSheet = (
	sheet: ISheet,
	reading: TSheetReading,
	{
		sourceId,
		sheetName = null,
		tableName,
	}: { sourceId: string; sheetName?: string | null; tableName: string },
): IReadData => {
	const column = (key: string) => sheet.columns.find((each) => each.key === key);
	const where = (path: string) =>
		DataSourceRefSchema.parse({ sourceId, path: sheetName ? `${sheetName}!${path}` : path });
	const keys = new Set<string>();
	const value = (
		name: string,
		cell: number | string | null,
		unit: string,
		path: string,
		history: TDataValue["history"] = [],
	): TDataValue => ({
		key: uniqueKey(toDataKey(name), keys),
		name,
		value: cell ?? "",
		unit,
		source: where(path),
		history,
		threshold: null,
	});

	if (reading.readsAs === "table") {
		return {
			values: [],
			tables: [
				{
					key: toDataKey(tableName),
					name: tableName,
					source: DataSourceRefSchema.parse({ sourceId, path: sheetName ?? "" }),
					keyColumn: column(reading.keyColumn) ? reading.keyColumn : "",
					columns: sheet.columns.map(({ key, name, unit }) =>
						DataColumnSchema.parse({ key, name, unit }),
					),
					rows: Array.from({ length: sheet.rowCount }, (_, index) =>
						Object.fromEntries(sheet.columns.map((each) => [each.key, each.cells[index]])),
					),
					history: [],
				},
			],
		};
	}
	if (reading.readsAs === "history") {
		const dates = column(reading.dateColumn);
		if (!dates) {
			return { values: [], tables: [] };
		}
		return {
			values: sheet.columns
				.filter((each) => each.kind === "number")
				.map((each) => {
					const history = dates.cells
						.map((at, index) => ({ at, value: each.cells[index] }))
						.filter(
							(point): point is { at: string; value: number } =>
								typeof point.at === "string" && typeof point.value === "number",
						)
						.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
					return value(each.name, history.at(-1)?.value ?? null, each.unit, each.name, history);
				}),
			tables: [],
		};
	}
	if (reading.readsAs === "valuePerColumn") {
		const last = sheet.rowCount - 1;
		return {
			values: sheet.columns.map((each) => value(each.name, each.cells[last], each.unit, each.name)),
			tables: [],
		};
	}
	const names = column(reading.nameColumn);
	const values = column(reading.valueColumn);
	if (!names || !values) {
		return { values: [], tables: [] };
	}
	return {
		values: names.cells.flatMap((name, index) =>
			name === null ? [] : [value(String(name), values.cells[index], values.unit, String(name))],
		),
		tables: [],
	};
};

const sameOrigin = (a: TDataValue["source"], b: TDataValue["source"]): boolean =>
	a !== null && b !== null && a.sourceId === b.sourceId && a.path === b.path;

/**
 * The world's data with what a source gave put in: the source added or
 * updated, and each value and table it gave replacing the one it gave before
 * from the same place (keeping that one's key and name, so whatever follows
 * it still does), or added with a key not yet taken. What it gave before and
 * doesn't now stays, as it last was.
 */
export const putReadData = (data: TWorldData, source: TDataSource, read: IReadData): TWorldData => {
	const valueKeys = new Set(data.values.map((each) => each.key));
	const values = [...data.values];
	for (const incoming of read.values) {
		const index = values.findIndex((each) => sameOrigin(each.source, incoming.source));
		if (index === -1) {
			values.push({ ...incoming, key: uniqueKey(incoming.key, valueKeys) });
		} else {
			const before = values[index];
			values[index] = {
				...incoming,
				key: before.key,
				name: before.name,
				unit: incoming.unit || before.unit,
			};
		}
	}
	const tableKeys = new Set(data.tables.map((each) => each.key));
	const tables = [...data.tables];
	for (const incoming of read.tables) {
		const index = tables.findIndex((each) => sameOrigin(each.source, incoming.source));
		if (index === -1) {
			tables.push({ ...incoming, key: uniqueKey(incoming.key, tableKeys) });
		} else {
			tables[index] = { ...incoming, key: tables[index].key, name: tables[index].name };
		}
	}
	const sources = data.sources.some((each) => each.id === source.id)
		? data.sources.map((each) => (each.id === source.id ? source : each))
		: [...data.sources, source];
	return { values, tables, sources };
};
