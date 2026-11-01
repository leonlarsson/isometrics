import { useState } from "react";

import { pickFile } from "#/editor/fileActions";
import { suggestLegend } from "#/editor/legend";
import { isLinkAllowed, useAllowedLinks } from "#/editor/linkTrust";
import { LINK_FAILURES } from "#/editor/readLink";
import { readSpreadsheet, SPREADSHEET_TYPES } from "#/editor/readSpreadsheet";
import {
	keepArrivedValues,
	MOST_SOURCES_READ,
	readOnTheirOwn,
	refreshSource,
	sitesOf,
	useSourceStatus,
	useWaitingSources,
} from "#/editor/sourceRefresh";
import { newId, useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { useHasArrived } from "#/editor/worldData";
import { localDateTime } from "#/lib/when";
import { formatEntry, toDataKey } from "#/scene/format";
import {
	DataSourceSchema,
	DataValueSchema,
	type TDataSource,
	type TDataSourceKind,
	type TDataValue,
} from "#/scene/schema";

import { AllowedLinksDialog } from "./AllowedLinksDialog";
import { AllowSourcesDialog } from "./AllowSourcesDialog";
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
import { Tooltip } from "./Tooltip";

import styles from "./DataPanel.module.css";

/** What each kind of source is called (data study). */
const SOURCE_KIND_NAMES: Record<TDataSourceKind, string> = {
	file: "Spreadsheet",
	link: "Link",
	api: "API",
	push: "Pushed",
};

/** The site an address is on ("api.example.com"), or null when it isn't a web address. */
const siteOf = (url: string | null | undefined) => {
	try {
		return url ? new URL(url).host : null;
	} catch {
		return null;
	}
};

/**
 * What a source is called: its own name, else the site it reads (a list of sources all called
 * "API" says nothing), else its file, else its kind.
 */
const sourceNameOf = (source: TDataSource) =>
	source.name || siteOf(source.url) || source.fileName || SOURCE_KIND_NAMES[source.kind];

/** The longest a source's address is shown in its row; the whole of it is in its tooltip. */
const ADDRESS_SHOWN = 40;

/** A source's address for its row: without the site when that's already its name, and shortened. */
const shortAddressOf = (source: TDataSource) => {
	if (!source.url) {
		return null;
	}
	let shown = source.url.replace(/^https?:\/\//, "");
	const site = siteOf(source.url);
	if (site && sourceNameOf(source) === site) {
		shown = shown.slice(site.length) || "/";
	}
	return shown.length > ADDRESS_SHOWN ? `${shown.slice(0, ADDRESS_SHOWN - 1)}…` : shown;
};

/** Where a value or table comes from, in words: typed by hand, or its source (and where in it). */
const originOf = (source: TDataValue["source"], sources: readonly TDataSource[]): string => {
	if (!source) {
		return "typed by hand";
	}
	const found = sources.find((each) => each.id === source.sourceId);
	const name = found ? sourceNameOf(found) : `${source.sourceId} (gone)`;
	// A spreadsheet's "Sheet!column" in words: "Sheet › column".
	return source.path ? `from ${name}, ${source.path.replace("!", " › ")}` : `from ${name}`;
};

/** Values grouped by where they come from: typed by hand first, then each source's. */
const groupsOf = (values: readonly TDataValue[], sources: readonly TDataSource[]) => {
	const groups = [
		{ title: "Typed by hand", values: values.filter((value) => !value.source) },
		...sources.map((source) => ({
			title: `From ${sourceNameOf(source)}`,
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
	const [listsAllowed, setListsAllowed] = useState(false);
	const statuses = useSourceStatus();
	const waiting = useWaitingSources();
	const waitingIds = new Set(waiting.map((source) => source.id));
	const waitingAddresses = [...new Set(waiting.map((source) => source.url ?? ""))];
	// Long lists get a search, as values do: tables by name and key, sources by name, address or file.
	const [tableQuery, setTableQuery] = useState("");
	const [sourceQuery, setSourceQuery] = useState("");
	const matches = (text: string, query: string) =>
		text.toLowerCase().includes(query.trim().toLowerCase());
	const shownTables = tables.filter((table) => matches(`${table.name} ${table.key}`, tableQuery));
	const shownSources = sources.filter((source) =>
		matches(
			`${sourceNameOf(source)} ${source.url ?? ""} ${source.fileName ?? ""} ${SOURCE_KIND_NAMES[source.kind]}`,
			sourceQuery,
		),
	);
	// Which allowed sources the world reads on its own (the first few addresses): the rest say so.
	const allowedLinks = useAllowedLinks((s) => s.links);
	const dataIsOn = useEditor((s) => s.scene.data.isOn);
	const readIds = new Set(
		readOnTheirOwn(
			sources.filter(
				(source) =>
					(source.kind === "link" || source.kind === "api") &&
					source.url &&
					isLinkAllowed(source.url, allowedLinks),
			),
		).map((source) => source.id),
	);
	const [isReviewingWaiting, setReviewingWaiting] = useState(false);
	/** A source's status, short for its row; the exact error, if any, for its tooltip. */
	const statusOf = (source: TDataSource): { text: string; detail?: string } | null => {
		const status = statuses[source.id];
		if (waitingIds.has(source.id)) {
			return { text: "waiting for your yes" };
		}
		if (status?.reading) {
			return { text: "reading…" };
		}
		if (status?.error) {
			return {
				text: `couldn't read it: ${LINK_FAILURES[status.failure ?? "unreadable"].short}`,
				detail: status.error,
			};
		}
		if (
			(source.kind === "link" || source.kind === "api") &&
			source.url &&
			dataIsOn &&
			!readIds.has(source.id)
		) {
			return {
				text: `not read on its own: a world reads ${MOST_SOURCES_READ} at most`,
			};
		}
		if (status?.readAt) {
			return {
				text: `read ${formatWhen(status.readAt)}${source.refreshSeconds ? `, every ${source.refreshSeconds} s` : ""}`,
			};
		}
		// Read once, outside the app: it can't be read again from here.
		const isSnapshot = (source.kind === "link" || source.kind === "api") && !source.url;
		const lastRead = source.lastReadAt && `read ${localDateTime(source.lastReadAt)}`;
		if (isSnapshot) {
			return { text: lastRead ? `a snapshot, ${lastRead}` : "a snapshot" };
		}
		return lastRead ? { text: lastRead } : null;
	};
	/** The sources that failed to be read, by how (not those waiting for a yes: said above). */
	const failures = (["blocked", "status", "unreadable", "address", "offline"] as const)
		.map((failure) => ({
			failure,
			failed: sources.filter(
				(source) => !waitingIds.has(source.id) && statuses[source.id]?.failure === failure,
			),
		}))
		.filter(({ failed }) => failed.length > 0);
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
				{tables.length >= SEARCHABLE_FROM && (
					<SearchField
						label="Find a table"
						placeholder="Find a table…"
						value={tableQuery}
						onChange={setTableQuery}
					/>
				)}

				{tables.length > 0 && shownTables.length === 0 && (
					<Hint>{`No table matches “${tableQuery.trim()}”.`}</Hint>
				)}

				{tables.length > 0 ? (
					<List>
						{shownTables.map((table) => (
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
						{`This world reads data from ${waiting.length === 1 ? "an external source" : `${waiting.length} external sources`} this browser hasn't read before, from ${sitesOf(waiting)}. A world can come from anyone, so nothing is read from them until you allow ${waiting.length === 1 ? "it (Allow, on its row)" : "them (Allow, on each row, or all at once)"}.`}
					</Hint>
				)}

				{waitingAddresses.length > 1 && (
					<Button size="sm" icon="check" onClick={() => setReviewingWaiting(true)}>
						Review and allow…
					</Button>
				)}

				{/* Each way of failing explained once, for all the sources that failed that way. */}
				{failures.map(({ failure, failed }) => (
					<Hint key={failure}>
						<strong>
							{`${failed.length === 1 ? "A source" : `${failed.length} sources`} couldn't be read (${sitesOf(failed)}).`}
						</strong>

						{` ${LINK_FAILURES[failure].long}`}
					</Hint>
				))}

				{sources.length >= SEARCHABLE_FROM && (
					<SearchField
						label="Find a source"
						placeholder="Find a source…"
						value={sourceQuery}
						onChange={setSourceQuery}
					/>
				)}

				{sources.length > 0 && shownSources.length === 0 && (
					<Hint>{`No source matches “${sourceQuery.trim()}”.`}</Hint>
				)}

				{sources.length > 0 ? (
					<List>
						{shownSources.map((source) => {
							const address = shortAddressOf(source);
							const status = statusOf(source);
							return (
								<ListItem
									key={source.id}
									label={sourceNameOf(source)}
									meta={
										<>
											{SOURCE_KIND_NAMES[source.kind]}

											{address && (
												<>
													{" · "}

													<Tooltip label={source.url}>
														<span className={styles.address}>{address}</span>
													</Tooltip>
												</>
											)}

											{status && (
												<>
													{" · "}

													{status.detail ? (
														<Tooltip label={status.detail}>
															<span className={styles.status}>{status.text}</span>
														</Tooltip>
													) : (
														status.text
													)}
												</>
											)}
										</>
									}
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
													waitingIds.has(source.id) ? (
														// Waiting for a yes (ADR-0119): said in words, not a download icon.
														<Button
															size="sm"
															icon="check"
															onClick={() => void refreshSource(source, { asked: true })}
														>
															Allow
														</Button>
													) : (
														<IconButton
															icon="download"
															label="Read it again now"
															onClick={() => void refreshSource(source, { asked: true })}
														/>
													)
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
							);
						})}
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

					<Button variant="ghost" icon="lock" onClick={() => setListsAllowed(true)}>
						External sources this browser reads…
					</Button>
				</ButtonGroup>
			</Section>

			{dialogs}

			<AllowedLinksDialog open={listsAllowed} onClose={() => setListsAllowed(false)} />

			<AllowSourcesDialog
				open={isReviewingWaiting && waitingAddresses.length > 1}
				onOpenChange={setReviewingWaiting}
				addresses={waitingAddresses}
				later="Not now leaves them waiting: each can still be allowed on its own row, and any you allow forgotten later (External sources this browser reads…)."
			/>
		</>
	);
};
