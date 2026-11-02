import { describeJson, readValue } from "./jsonSource";
import type { TDataPoint, TDataValue } from "./schema";
import { dataFromSheet, type ISheet, readingAs, whyNotReadAs } from "./sheets";

/**
 * What one value could be read from, in a source (ADR-0123): the numbers in
 * what a link or API answers, and a spreadsheet's columns, each with what it
 * holds now. "Read it from a source…" lists them to pick one, and the value
 * then follows it, keeping its name, key and everything that shows it.
 */

export interface IFieldChoice {
	/** Its id among one reading's choices. */
	id: string;
	/** What it is, in words: “totalUsers”, each entry's “sent”, by “day”, Stats › sent. */
	label: string;
	/** Where in the source the value is read from (its `source`, without the source's id). */
	ref: { path: string; field: string; dateField: string };
	value: TDataValue["value"];
	history: TDataPoint[];
}

/** What a value could follow in what a link or API answered: single numbers and texts, and lists over time. */
export const fieldChoicesInJson = (json: unknown): IFieldChoice[] => {
	const { numbers, texts, lists } = describeJson(json);
	const singles = numbers.map(
		(number): IFieldChoice => ({
			id: `value:${number.path}`,
			label: `“${number.path}”`,
			ref: { path: number.path, field: "", dateField: "" },
			value: number.value,
			history: [],
		}),
	);
	const words = texts.map(
		(text): IFieldChoice => ({
			id: `value:${text.path}`,
			label: `“${text.path}”`,
			ref: { path: text.path, field: "", dateField: "" },
			value: text.value,
			history: [],
		}),
	);
	const overTime = lists.flatMap((list) => {
		const dateField = list.fields.find((field) => field.kind === "date")?.path;
		if (!dateField) {
			return [];
		}
		// Numbers, and texts and yes/no too: a value can hold either, and so can its past values.
		return list.fields
			.filter((field) => field.kind === "number" || field.kind === "text")
			.flatMap((field): IFieldChoice[] => {
				const ref = { path: list.path, field: field.path, dateField };
				const read = readValue(json, { sourceId: "", maxRowCount: null, ...ref });
				const at = list.path ? ` (the list at “${list.path}”)` : "";
				return read
					? [
							{
								id: `history:${list.path}:${field.path}`,
								label: `each entry's “${field.path}”, by its “${dateField}”${at}`,
								ref,
								...read,
							},
						]
					: [];
			});
	});
	return [...singles, ...words, ...overTime];
};

/**
 * The columns a value could follow in a spreadsheet: with dates, each column
 * of numbers over time (its last row now); without, each column's last row.
 * A sheet's name joins the label and the path when there are several.
 */
export const fieldChoicesInSheets = (
	sheets: readonly { name: string | null; sheet: ISheet }[],
): IFieldChoice[] =>
	sheets.flatMap(({ name, sheet }) => {
		const sheetName = sheets.length > 1 ? name : null;
		const readsAs =
			sheet.rowCount >= 2 && whyNotReadAs(sheet, "history") === null ? "history" : "valuePerColumn";
		return dataFromSheet(sheet, readingAs(sheet, readsAs), {
			sourceId: "",
			sheetName,
			tableName: "",
		}).values.map(
			(value): IFieldChoice => ({
				id: `column:${value.source?.path ?? value.key}`,
				label: sheetName ? `${sheetName} › “${value.name}”` : `the “${value.name}” column`,
				ref: { path: value.source?.path ?? value.name, field: "", dateField: "" },
				value: value.value,
				history: value.history,
			}),
		);
	});
