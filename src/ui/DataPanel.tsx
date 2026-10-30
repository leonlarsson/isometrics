import { useState } from "react";

import { useEditor } from "#/editor/store";
import { formatEntry, toDataKey } from "#/scene/format";
import {
	DataValueSchema,
	type TDataSource,
	type TDataSourceKind,
	type TDataTable,
	type TDataValue,
} from "#/scene/schema";

import { Button, IconButton } from "./Button";
import { Hint, Input, Section } from "./fields";
import { List, ListItem } from "./List";

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
	return source.path ? `from ${name}, ${source.path}` : `from ${name}`;
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

/** One table: its name, its size, and where it comes from. */
const TableRow = ({ table, sources }: { table: TDataTable; sources: readonly TDataSource[] }) => (
	<ListItem
		label={table.name || table.key}
		meta={`${table.rows.length} rows × ${table.columns.length} columns · ${originOf(table.source, sources)}`}
		stacked
	/>
);

/**
 * The Data tab (data study, docs/data-study): the world's values, its tables
 * and the sources they're read from. It edits what the world keeps; values
 * that arrive while it's open show on cards and in the view, not here.
 */
export const DataPanel = () => {
	const { values, tables, sources } = useEditor((s) => s.scene.data);
	const upsertData = useEditor((s) => s.upsertData);

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
							<TableRow key={table.key} table={table} sources={sources} />
						))}
					</List>
				) : (
					<Hint>
						A table holds rows, like one per warehouse or player, and objects can each take one.
						Tables come from a spreadsheet or an API.
					</Hint>
				)}
			</Section>

			<Section
				id="data.sources"
				icon="file"
				title="Sources"
				keywords="data import spreadsheet api link"
			>
				{sources.length > 0 ? (
					<List>
						{sources.map((source) => (
							<ListItem
								key={source.id}
								label={source.name || SOURCE_KIND_NAMES[source.kind]}
								meta={[
									SOURCE_KIND_NAMES[source.kind],
									source.url ?? source.fileName,
									source.lastReadAt && `read ${new Date(source.lastReadAt).toLocaleString()}`,
								]
									.filter(Boolean)
									.join(" · ")}
								stacked
							/>
						))}
					</List>
				) : (
					<Hint>
						Values and tables can be read from a spreadsheet, a link to a sheet or CSV, or an API,
						instead of typed by hand.
					</Hint>
				)}
			</Section>
		</>
	);
};
