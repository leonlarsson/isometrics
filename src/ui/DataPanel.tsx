import { useState } from "react";

import { pickFile } from "#/editor/fileActions";
import { readSpreadsheet, SPREADSHEET_TYPES } from "#/editor/readSpreadsheet";
import { newId, useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { formatEntry, toDataKey } from "#/scene/format";
import {
	DataSourceSchema,
	DataValueSchema,
	type TDataSource,
	type TDataSourceKind,
	type TDataValue,
} from "#/scene/schema";

import { Button, IconButton } from "./Button";
import { DataTableDialog } from "./DataTableDialog";
import { Hint, Input, Section } from "./fields";
import { List, ListItem } from "./List";
import { type ISpreadsheetReading, ReadSpreadsheetDialog } from "./ReadSpreadsheetDialog";

import styles from "./DataPanel.module.css";

/** Values may be numbers or text; keep numbers numeric so formatting works. */
const parseValue = (raw: string): number | string => {
	const trimmed = raw.trim();
	if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}
	return raw;
};

/** What each kind of source is called (data study). */
const SOURCE_KIND_NAMES: Record<TDataSourceKind, string> = {
	file: "Spreadsheet",
	link: "Link",
	api: "API",
	push: "Pushed",
};

/** Where a value or table comes from, in words: typed by hand, or its source (and where in it). */
const originOf = (source: TDataValue["source"], sources: readonly TDataSource[]): string => {
	if (!source) {
		return "typed by hand";
	}
	const found = sources.find((each) => each.id === source.sourceId);
	const name = found ? found.name || SOURCE_KIND_NAMES[found.kind] : `${source.sourceId} (gone)`;
	// A spreadsheet's "Sheet!column" in words: "Sheet › column".
	return source.path ? `from ${name}, ${source.path.replace("!", " › ")}` : `from ${name}`;
};

/** One value: its name, then value and unit side by side, then where it comes from and how it reads. */
const DataRow = ({ entry, sources }: { entry: TDataValue; sources: readonly TDataSource[] }) => {
	const upsertData = useEditor((s) => s.upsertData);
	const removeData = useEditor((s) => s.removeData);
	const [rawValue, setRawValue] = useState<string | null>(null);
	const pastValues = entry.history.length;
	const origin = `${originOf(entry.source, sources)}${pastValues > 0 ? ` · ${pastValues} past values` : ""}`;

	return (
		<li className={styles.row}>
			<div className={styles.nameRow}>
				<Input
					ariaLabel="Name"
					value={entry.name}
					placeholder="Name"
					onChange={(name) => upsertData({ ...entry, name })}
				/>

				<IconButton icon="trash" label="Remove value" onClick={() => removeData(entry.key)} />
			</div>

			<div className={styles.valueRow}>
				<Input
					ariaLabel="Value"
					value={rawValue ?? String(entry.value)}
					placeholder="Value"
					onChange={(raw) => {
						setRawValue(raw);
						upsertData({ ...entry, value: parseValue(raw) });
					}}
					onBlur={() => setRawValue(null)}
				/>

				<Input
					ariaLabel="Unit"
					value={entry.unit}
					placeholder="Unit"
					onChange={(unit) => upsertData({ ...entry, unit })}
				/>
			</div>

			<span className={styles.meta}>
				<code>{entry.key}</code> · shows as <strong>{formatEntry(entry)}</strong> · {origin}
			</span>
		</li>
	);
};

/**
 * A spreadsheet picked and read, ready for the dialog that reads it into
 * the world: into `source` when reading it again, else into a new source.
 */
const pickSpreadsheet = async (source?: TDataSource): Promise<ISpreadsheetReading | null> => {
	const file = await pickFile(SPREADSHEET_TYPES);
	if (!file) {
		return null;
	}
	try {
		const sheets = await readSpreadsheet(file);
		return {
			fileName: file.name,
			sheets,
			isAgain: source !== undefined,
			source: source
				? {
						...source,
						fileName: file.name,
						name: source.name === source.fileName ? file.name : source.name,
					}
				: DataSourceSchema.parse({
						id: newId("source"),
						name: file.name,
						kind: "file",
						fileName: file.name,
					}),
		};
	} catch (error) {
		notify(
			`Couldn't read ${file.name}`,
			error instanceof Error ? error.message : "It isn't a spreadsheet this can read.",
			"error",
		);
		return null;
	}
};

/**
 * The Data tab (data study, docs/data-study): the world's values, its tables
 * and the sources they're read from. It edits what the world keeps; values
 * that arrive while it's open show on cards and in the view, not here.
 */
export const DataPanel = () => {
	const { values, tables, sources } = useEditor((s) => s.scene.data);
	const upsertData = useEditor((s) => s.upsertData);
	const removeDataTable = useEditor((s) => s.removeDataTable);
	const removeDataSource = useEditor((s) => s.removeDataSource);
	const [reading, setReading] = useState<ISpreadsheetReading | null>(null);
	const [openTableKey, setOpenTableKey] = useState<string | null>(null);
	const openTable = tables.find((table) => table.key === openTableKey);

	const readFrom = async (source?: TDataSource) => {
		const picked = await pickSpreadsheet(source);
		if (picked) {
			setReading(picked);
		}
	};

	const addValue = () => {
		let key = toDataKey("new value");
		let n = 1;
		while (values.some((d) => d.key === key)) {
			key = `new_value_${++n}`;
		}
		upsertData(DataValueSchema.parse({ key, name: "New value", value: 0 }));
	};

	return (
		<>
			<Section
				id="data.values"
				icon="chart"
				title="Values"
				keywords="data numbers"
				actions={
					<Button size="sm" icon="plus" onClick={addValue}>
						Add
					</Button>
				}
			>
				<Hint>
					These numbers feed the labels and detail tiles. Units are added right after the value, so
					type {"“ min”"} (with a space) or {"“%”"}.
				</Hint>

				{values.length > 0 && (
					<ul className={styles.list}>
						{values.map((entry) => (
							<DataRow key={entry.key} entry={entry} sources={sources} />
						))}
					</ul>
				)}
			</Section>

			<Section id="data.tables" icon="list" title="Tables" keywords="data rows columns table">
				{tables.length > 0 ? (
					<List>
						{tables.map((table) => (
							<ListItem
								key={table.key}
								label={table.name || table.key}
								meta={`${table.rows.length.toLocaleString()} rows × ${table.columns.length} columns · ${originOf(table.source, sources)}`}
								stacked
								onClick={() => setOpenTableKey(table.key)}
								actions={
									<IconButton
										icon="trash"
										label="Remove table"
										onClick={() => removeDataTable(table.key)}
									/>
								}
							/>
						))}
					</List>
				) : (
					<Hint>
						A table holds rows, one for each warehouse, player or line. Read one from a spreadsheet
						under Sources.
					</Hint>
				)}
			</Section>

			<Section
				id="data.sources"
				icon="file"
				title="Sources"
				keywords="data import read spreadsheet csv excel api link"
			>
				{sources.length > 0 ? (
					<List>
						{sources.map((source) => (
							<ListItem
								key={source.id}
								label={source.name || SOURCE_KIND_NAMES[source.kind]}
								meta={[
									SOURCE_KIND_NAMES[source.kind],
									source.url ?? (source.fileName === source.name ? null : source.fileName),
									source.lastReadAt &&
										`read ${new Date(source.lastReadAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
								]
									.filter(Boolean)
									.join(" · ")}
								stacked
								actions={
									<>
										{source.kind === "file" && (
											<IconButton
												icon="upload"
												label="Read it again…"
												onClick={() => readFrom(source)}
											/>
										)}

										<IconButton
											icon="trash"
											label="Remove source (its values and tables stay)"
											onClick={() => removeDataSource(source.id)}
										/>
									</>
								}
							/>
						))}
					</List>
				) : (
					<Hint>
						Read values and tables from a spreadsheet (CSV or Excel) instead of typing them: values
						over time, a table of rows, or a value for each column or row. Read it again when it
						changes. Links and APIs come later.
					</Hint>
				)}

				<Button icon="upload" onClick={() => readFrom()}>
					Read a spreadsheet…
				</Button>
			</Section>

			{reading && <ReadSpreadsheetDialog reading={reading} onClose={() => setReading(null)} />}

			{openTable && (
				<DataTableDialog
					table={openTable}
					origin={originOf(openTable.source, sources)}
					onClose={() => setOpenTableKey(null)}
				/>
			)}
		</>
	);
};
