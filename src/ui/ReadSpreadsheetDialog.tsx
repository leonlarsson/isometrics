import { useMemo, useState } from "react";

import type { ISpreadsheetSheet } from "#/editor/readSpreadsheet";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { formatEntry } from "#/scene/format";
import type { TDataSource, TWorldData } from "#/scene/schema";
import {
	dataFromSheet,
	guessReading,
	type ISheet,
	readingAs,
	readSheet,
	rowNamingColumn,
	type TReadsAs,
	type TSheetReading,
	whyNotReadAs,
} from "#/scene/sheets";

import { DataTableView } from "./DataTableView";
import { Dialog } from "./Dialog";
import { Hint, resetToDefault, SelectField, TextField } from "./fields";

import styles from "./ReadSpreadsheetDialog.module.css";

/** A file picked to read, and the source it's read into (one already in the world when reading again). */
export interface ISpreadsheetReading {
	fileName: string;
	sheets: ISpreadsheetSheet[];
	source: TDataSource;
	/** The source is already in the world: this reads it again. */
	isAgain: boolean;
}

const READS_AS: { value: TReadsAs; label: string; hint: string }[] = [
	{ value: "table", label: "A table", hint: "Each line becomes a row of a table." },
	{
		value: "history",
		label: "Values over time",
		hint: "Each column of numbers becomes a value: its lines are its past values, the latest its value now.",
	},
	{
		value: "valuePerColumn",
		label: "A value for each column",
		hint: "Each column becomes a value, from the last line.",
	},
	{
		value: "valuePerRow",
		label: "A value for each row",
		hint: "Each line becomes a value, named by one column, with its value in another.",
	},
];

/** A table's name from its file (or its sheet): "top-clubs.csv" → "Top clubs". */
const tableNameOf = (fileName: string, sheetName: string | null) => {
	const base = (sheetName ?? fileName.replace(/\.[^.]+$/, "")).replace(/[-_]+/g, " ").trim();
	return base.charAt(0).toUpperCase() + base.slice(1);
};

/** What reading the sheet starts as: as the source's table was read before, else the guess. */
const startingReading = (
	sheet: ISheet,
	source: TDataSource,
	data: TWorldData,
	sheetName: string | null,
): TSheetReading => {
	const before = data.tables.find(
		(table) => table.source?.sourceId === source.id && table.source.path === (sheetName ?? ""),
	);
	if (!before) {
		return guessReading(sheet);
	}
	return {
		readsAs: "table",
		keyColumn: sheet.columns.some((column) => column.key === before.keyColumn)
			? before.keyColumn
			: rowNamingColumn(sheet),
	};
};

/** "1 value", "3 tables". */
const count = (n: number, one: string, many: string) =>
	`${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * Reading a spreadsheet into the world (data study, step 2): which sheet,
 * what it's read as (a table, values over time, a value per column or per
 * row; ways it can't be read are greyed out, saying why), and a preview of
 * what it adds. Mounted for one file at a time.
 */
export const ReadSpreadsheetDialog = ({
	reading: { fileName, sheets, source, isAgain },
	onClose,
}: {
	reading: ISpreadsheetReading;
	onClose: () => void;
}) => {
	const data = useEditor((s) => s.scene.data);
	const putReadData = useEditor((s) => s.putReadData);
	const typed = useMemo(
		() => sheets.map((each) => readSheet(each.rows, { decimalComma: each.decimalComma })),
		[sheets],
	);
	const [sheetIndex, setSheetIndex] = useState(() =>
		Math.max(
			0,
			typed.findIndex((sheet) => sheet.rowCount > 0),
		),
	);
	const sheet = typed[sheetIndex];
	const sheetName = sheets.length > 1 ? sheets[sheetIndex].name : null;
	const [reading, setReading] = useState(() => startingReading(sheet, source, data, sheetName));
	const defaultTableName =
		data.tables.find(
			(table) => table.source?.sourceId === source.id && table.source.path === (sheetName ?? ""),
		)?.name ?? tableNameOf(fileName, sheetName);
	const [tableName, setTableName] = useState(defaultTableName);
	const guess = guessReading(sheet);

	const pickSheet = (index: number) => {
		setSheetIndex(index);
		const name = sheets.length > 1 ? sheets[index].name : null;
		setReading(startingReading(typed[index], source, data, name));
		setTableName(tableNameOf(fileName, name));
	};

	const read = useMemo(
		() =>
			dataFromSheet(sheet, reading, {
				sourceId: source.id,
				sheetName,
				tableName: tableName.trim() || defaultTableName,
			}),
		[sheet, reading, source.id, sheetName, tableName, defaultTableName],
	);
	const table = read.tables[0];
	const pastValues = read.values.reduce((sum, value) => sum + value.history.length, 0);
	const summary = table
		? `${isAgain ? "Updates" : "Adds"} a table of ${count(table.rows.length, "row", "rows")} and ${count(table.columns.length, "column", "columns")}.`
		: read.values.length > 0
			? `${isAgain ? "Updates" : "Adds"} ${count(read.values.length, "value", "values")}${pastValues > 0 ? ` with ${count(pastValues, "past value", "past values")}` : ""}.`
			: "Nothing to add: this sheet has no rows to read this way.";
	const leftOut =
		reading.readsAs === "history"
			? sheet.columns.filter(
					(column) => column.kind !== "number" && column.key !== reading.dateColumn,
				)
			: [];
	const columnName = (key: string) =>
		sheet.columns.find((column) => column.key === key)?.name ?? key;
	const firstDates = sheet.columns.find((column) => column.kind === "date")?.key ?? "";

	const confirm = () => {
		putReadData({ ...source, lastReadAt: new Date().toISOString() }, read);
		notify(`Read ${fileName}`, summary);
		onClose();
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => !open && onClose()}
			title={isAgain ? "Read a spreadsheet again" : "Read a spreadsheet"}
			description={fileName}
			wide
			confirm={{
				label: isAgain ? "Read again" : "Add to the world",
				onConfirm: confirm,
				disabled: read.values.length === 0 && read.tables.length === 0,
			}}
		>
			<div className={styles.layout}>
				<div className={styles.settings}>
					{sheets.length > 1 && (
						<SelectField<string>
							label="Sheet"
							value={String(sheetIndex)}
							options={sheets.map((each, index) => ({
								value: String(index),
								label: typed[index].rowCount > 0 ? (each.name ?? "") : `${each.name} (empty)`,
								disabled: typed[index].rowCount === 0,
							}))}
							onChange={(value) => pickSheet(Number(value))}
							hasNoDefault
						/>
					)}

					<SelectField<TReadsAs>
						label="Read it as"
						value={reading.readsAs}
						options={READS_AS.map(({ value, label }) => {
							const why = whyNotReadAs(sheet, value);
							return { value, label: why ? `${label} (${why})` : label, disabled: why !== null };
						})}
						onChange={(readsAs) => setReading(readingAs(sheet, readsAs))}
						inherit={resetToDefault(
							reading.readsAs,
							guess.readsAs,
							() => setReading(guess),
							READS_AS.find((each) => each.value === guess.readsAs)?.label,
						)}
						hint={READS_AS.find((each) => each.value === reading.readsAs)?.hint}
					/>

					{reading.readsAs === "table" && (
						<>
							<SelectField<string>
								label="Rows are named by"
								value={reading.keyColumn}
								options={[
									{ value: "", label: "Nothing (by their order)" },
									...sheet.columns.map((column) => ({
										value: column.key,
										label: column.namesRows
											? column.name
											: `${column.name} (not different on every row)`,
										disabled: !column.namesRows,
									})),
								]}
								onChange={(keyColumn) => setReading({ readsAs: "table", keyColumn })}
								inherit={resetToDefault(
									reading.keyColumn,
									rowNamingColumn(sheet),
									() => setReading({ readsAs: "table", keyColumn: rowNamingColumn(sheet) }),
									columnName(rowNamingColumn(sheet)),
								)}
								hint="Each row's name, like a warehouse's or a player's: what an object will pick its row by."
							/>

							<TextField
								label="Table name"
								value={tableName}
								onChange={setTableName}
								inherit={resetToDefault(tableName, defaultTableName, () =>
									setTableName(defaultTableName),
								)}
							/>
						</>
					)}

					{reading.readsAs === "history" && (
						<SelectField<string>
							label="Dates in"
							value={reading.dateColumn}
							options={sheet.columns
								.filter((column) => column.kind === "date")
								.map((column) => ({ value: column.key, label: column.name }))}
							onChange={(dateColumn) => setReading({ readsAs: "history", dateColumn })}
							inherit={resetToDefault(
								reading.dateColumn,
								firstDates,
								() => setReading({ readsAs: "history", dateColumn: firstDates }),
								columnName(firstDates),
							)}
						/>
					)}

					{reading.readsAs === "valuePerRow" && (
						<>
							<SelectField<string>
								label="Names in"
								value={reading.nameColumn}
								options={sheet.columns.map((column) => ({
									value: column.key,
									label: column.namesRows
										? column.name
										: `${column.name} (not different on every row)`,
									disabled: !column.namesRows,
								}))}
								onChange={(nameColumn) => setReading({ ...reading, nameColumn })}
								hasNoDefault
							/>

							<SelectField<string>
								label="Values in"
								value={reading.valueColumn}
								options={sheet.columns
									.filter((column) => column.key !== reading.nameColumn)
									.map((column) => ({ value: column.key, label: column.name }))}
								onChange={(valueColumn) => setReading({ ...reading, valueColumn })}
								hasNoDefault
							/>
						</>
					)}

					{leftOut.length > 0 && (
						<Hint>Left out, not numbers: {leftOut.map((column) => column.name).join(", ")}.</Hint>
					)}
				</div>

				<div className={styles.preview}>
					<p className={styles.summary}>{summary}</p>

					{table && (
						<DataTableView
							columns={table.columns}
							rows={table.rows}
							keyColumn={table.keyColumn}
							mostRows={8}
						/>
					)}

					{read.values.length > 0 && (
						<ul className={styles.values}>
							{read.values.slice(0, 12).map((value) => (
								<li key={value.key}>
									<span className={styles.valueName}>{value.name}</span>

									<strong>{formatEntry(value)}</strong>

									{value.history.length > 0 && (
										<span className={styles.past}>
											{`${count(value.history.length, "past value", "past values")}, from ${value.history[0].at}`}
										</span>
									)}
								</li>
							))}
						</ul>
					)}

					{read.values.length > 12 && (
						<Hint>and {(read.values.length - 12).toLocaleString()} more values</Hint>
					)}
				</div>
			</div>
		</Dialog>
	);
};
