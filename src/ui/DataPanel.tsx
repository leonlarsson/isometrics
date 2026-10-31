import { useState } from "react";

import { pickFile } from "#/editor/fileActions";
import { suggestLegend } from "#/editor/legend";
import { nameOfLink } from "#/editor/readLink";
import { readSpreadsheet, SPREADSHEET_TYPES } from "#/editor/readSpreadsheet";
import {
	keepArrivedValues,
	refreshSource,
	useSourceStatus,
	useWaitingSources,
} from "#/editor/sourceRefresh";
import { newId, useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { useHasArrived } from "#/editor/worldData";
import { formatEntry, toDataKey } from "#/scene/format";
import {
	DataSourceSchema,
	DataValueSchema,
	type TDataSource,
	type TDataSourceKind,
	type TDataValue,
} from "#/scene/schema";

import { Button, ButtonGroup, IconButton } from "./Button";
import { DataTableDialog } from "./DataTableDialog";
import { DataValuePage } from "./DataValuePage";
import {
	CheckboxGroupField,
	FieldGroup,
	GroupLabel,
	Hint,
	resetToDefault,
	SearchField,
	Section,
	TextField,
} from "./fields";
import { List, ListItem } from "./List";
import { ReadLinkDialog } from "./ReadLinkDialog";
import { type ISpreadsheetReading, ReadSpreadsheetDialog } from "./ReadSpreadsheetDialog";
import { formatWhen, Sparkline } from "./Sparkline";

import styles from "./DataPanel.module.css";

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

/** Values grouped by where they come from: typed by hand first, then each source's. */
const groupsOf = (values: readonly TDataValue[], sources: readonly TDataSource[]) => {
	const groups = [
		{ title: "Typed by hand", values: values.filter((value) => !value.source) },
		...sources.map((source) => ({
			title: `From ${source.name || SOURCE_KIND_NAMES[source.kind]}`,
			values: values.filter((value) => value.source?.sourceId === source.id),
		})),
		{
			title: "From a source that's gone",
			values: values.filter(
				(value) => value.source && !sources.some((source) => source.id === value.source?.sourceId),
			),
		},
	];
	return groups.filter((group) => group.values.length > 0);
};

/** Past this many values, the list gets a search. */
const SEARCHABLE_FROM = 9;

/**
 * The world's values, a row each (data study): its name, a sparkline of its
 * past values if it has any, and its value. A row opens the value's own page.
 */
const ValueList = ({
	values,
	sources,
}: {
	values: readonly TDataValue[];
	sources: readonly TDataSource[];
}) => {
	const openValue = useEditor((s) => s.openValue);
	const [query, setQuery] = useState("");
	const wanted = query.trim().toLowerCase();
	const found = wanted
		? values.filter((value) => `${value.name} ${value.key}`.toLowerCase().includes(wanted))
		: values;
	const groups = groupsOf(found, sources);

	return (
		<>
			{values.length >= SEARCHABLE_FROM && (
				<SearchField
					label="Find a value"
					placeholder="Find a value…"
					value={query}
					onChange={setQuery}
				/>
			)}

			{groups.map((group) => (
				<div key={group.title} className={styles.group}>
					{groups.length > 1 && <GroupLabel>{group.title}</GroupLabel>}

					<List>
						{group.values.map((value) => (
							<ListItem
								key={value.key}
								label={value.name || value.key}
								meta={
									<span className={styles.valueMeta}>
										<Sparkline
											points={value.history}
											label={`${value.name || value.key} over time`}
										/>

										<span>{formatEntry(value)}</span>
									</span>
								}
								onClick={() => openValue(value.key)}
							/>
						))}
					</List>
				</div>
			))}

			{values.length === 0 && (
				<Hint>No values yet. Add one, or read some from a spreadsheet under Sources.</Hint>
			)}

			{values.length > 0 && found.length === 0 && <Hint>No values match “{query.trim()}”.</Hint>}
		</>
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
 * What View mode shows of the data besides cards (ADR-0110): the legend's
 * chips under the title (suggested from what follows data, then edited), and
 * tiles for the world's main values along the bottom.
 */
const DashboardSection = () => {
	const legend = useEditor((s) => s.scene.onScreen.legend);
	const tileKeys = useEditor((s) => s.scene.onScreen.tileKeys);
	const values = useEditor((s) => s.scene.data.values);
	const commit = useEditor((s) => s.commit);
	const setLegend = (next: typeof legend, coalesce?: string) =>
		commit(
			(scene) => {
				scene.onScreen.legend = next;
			},
			coalesce ? { coalesce: `legend:${coalesce}` } : undefined,
		);
	return (
		<Section
			id="data.dashboard"
			icon="tag"
			title="Legend and tiles"
			keywords="legend chips encoding key tiles dashboard view mode main values"
		>
			<Hint>
				Chips under the title say what sizes, roads and colours mean; tiles show the world's main
				values along the bottom, in View mode.
			</Hint>

			{legend.map((entry, index) => (
				<FieldGroup
					// biome-ignore lint/suspicious/noArrayIndexKey: chips are edited in place, by position
					key={index}
					title={`Chip ${index + 1}`}
				>
					<TextField
						label="Label"
						value={entry.label}
						onChange={(label) =>
							setLegend(
								legend.map((each, i) => (i === index ? { ...each, label } : each)),
								`${index}:label`,
							)
						}
						hasNoDefault
					/>

					<TextField
						label="Meaning"
						value={entry.meaning}
						onChange={(meaning) =>
							setLegend(
								legend.map((each, i) => (i === index ? { ...each, meaning } : each)),
								`${index}:meaning`,
							)
						}
						hasNoDefault
					/>

					<Button
						size="sm"
						icon="trash"
						onClick={() => setLegend(legend.filter((_, i) => i !== index))}
					>
						Remove chip
					</Button>
				</FieldGroup>
			))}

			<ButtonGroup>
				<Button
					size="sm"
					icon="plus"
					onClick={() => setLegend([...legend, { label: "Size", meaning: "" }])}
				>
					Add a chip
				</Button>

				<Button
					size="sm"
					icon="search"
					onClick={() => {
						const suggested = suggestLegend(useEditor.getState().scene);
						if (suggested.length === 0) {
							notify(
								"Nothing follows data yet",
								"Make a size, a road's flow or a colour follow a value, then suggest again.",
							);
							return;
						}
						setLegend(suggested);
					}}
				>
					Suggest from what follows data
				</Button>
			</ButtonGroup>

			{values.length > 0 ? (
				<CheckboxGroupField
					label="Tiles"
					options={values.map((entry) => ({ value: entry.key, label: entry.name || entry.key }))}
					value={tileKeys}
					onChange={(keys) =>
						commit((scene) => {
							scene.onScreen.tileKeys = keys;
						})
					}
					inherit={resetToDefault(
						tileKeys,
						[],
						() =>
							commit((scene) => {
								scene.onScreen.tileKeys = [];
							}),
						"none",
					)}
				/>
			) : (
				<Hint>Tiles show the world's values: add one above first.</Hint>
			)}
		</Section>
	);
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
	const [readsLink, setReadsLink] = useState(false);
	const statuses = useSourceStatus();
	const waiting = useWaitingSources();
	const waitingIds = new Set(waiting.map((source) => source.id));
	const hasArrived = useHasArrived();
	const [openTableKey, setOpenTableKey] = useState<string | null>(null);
	const openTable = tables.find((table) => table.key === openTableKey);
	const openValueKey = useEditor((s) => s.openValueKey);
	const openValue = useEditor((s) => s.openValue);
	const valueShown = values.find((value) => value.key === openValueKey);

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
		openValue(key);
	};

	const dialogs = (
		<>
			{reading && <ReadSpreadsheetDialog reading={reading} onClose={() => setReading(null)} />}

			{readsLink && (
				<ReadLinkDialog
					onClose={() => setReadsLink(false)}
					onSpreadsheet={(sheet) => {
						setReadsLink(false);
						setReading(sheet);
					}}
				/>
			)}

			{openTable && (
				<DataTableDialog
					table={openTable}
					origin={originOf(openTable.source, sources)}
					onClose={() => setOpenTableKey(null)}
				/>
			)}
		</>
	);

	// A value open on its own page (the header's breadcrumb leads back).
	if (valueShown) {
		return (
			<>
				<DataValuePage
					value={valueShown}
					source={sources.find((source) => source.id === valueShown.source?.sourceId) ?? null}
					origin={originOf(valueShown.source, sources)}
					onReadAgain={readFrom}
				/>

				{dialogs}
			</>
		);
	}

	return (
		<>
			{hasArrived && (
				<Section icon="clock" title="Read since the world opened">
					<Hint>
						Links and APIs gave newer values since the world opened. They show everywhere now, but
						the world keeps what it had until you keep these (one undo step).
					</Hint>

					<Button size="sm" icon="check" onClick={keepArrivedValues}>
						Keep these values
					</Button>
				</Section>
			)}

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
				<ValueList values={values} sources={sources} />
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
						A table holds rows, one for each warehouse, shop or line. Read one from a spreadsheet
						under Sources.
					</Hint>
				)}
			</Section>

			<DashboardSection />

			<Section
				id="data.sources"
				icon="file"
				title="Sources"
				keywords="data import read spreadsheet csv excel api link"
			>
				{waiting.length > 0 && (
					<Hint>
						{`This world reads data from ${waiting.length === 1 ? "an address" : `${waiting.length} addresses`} this browser hasn't read before: ${[...new Set(waiting.map((source) => nameOfLink(source.url ?? "")))].join(", ")}. A world can come from anyone, so nothing is read from them until you allow each one (its download button).`}
					</Hint>
				)}

				{sources.length > 0 ? (
					<List>
						{sources.map((source) => (
							<ListItem
								key={source.id}
								label={source.name || SOURCE_KIND_NAMES[source.kind]}
								meta={[
									SOURCE_KIND_NAMES[source.kind],
									source.url ?? (source.fileName === source.name ? null : source.fileName),
									// Read once, outside the app: it can't be read again from here.
									(source.kind === "link" || source.kind === "api") && !source.url && "a snapshot",
									// An address this browser hasn't said yes to (ADR-0119): not read until allowed.
									waitingIds.has(source.id) && "not read until you allow it",
									statuses[source.id]?.reading
										? "reading…"
										: statuses[source.id]?.error
											? `couldn't read it: ${statuses[source.id]?.error}`
											: statuses[source.id]?.readAt
												? `read ${formatWhen(statuses[source.id]?.readAt ?? "")}${source.refreshSeconds ? `, every ${source.refreshSeconds} s` : ""}`
												: source.lastReadAt &&
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

										{(source.kind === "link" || source.kind === "api") &&
											(source.url ? (
												<IconButton
													icon="download"
													label={
														waitingIds.has(source.id)
															? `Allow reading ${nameOfLink(source.url)}, and read it now`
															: "Read it again now"
													}
													onClick={() => void refreshSource(source, { asked: true })}
												/>
											) : (
												// A snapshot (read once, outside the app): shown greyed with why, not hidden.
												<IconButton
													icon="download"
													label="Read it again (a snapshot: it has no link to read again)"
													disabled
													onClick={() => undefined}
												/>
											))}

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
						over time, a table of rows, or a value for each column or row; or from a link or an API,
						read again while the world is open.
					</Hint>
				)}

				<ButtonGroup>
					<Button icon="upload" onClick={() => readFrom()}>
						Read a spreadsheet…
					</Button>

					<Button icon="download" onClick={() => setReadsLink(true)}>
						Read a link or API…
					</Button>
				</ButtonGroup>
			</Section>

			{dialogs}
		</>
	);
};
