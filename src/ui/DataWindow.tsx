import { useState } from "react";

import { dataGroupsOf, hasAnyData, originOf } from "#/editor/dataList";
import { pickFile } from "#/editor/fileActions";
import { readSpreadsheet, SPREADSHEET_TYPES } from "#/editor/readSpreadsheet";
import { newId, type TDataWindowAt, useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { formatEntry, toDataKey } from "#/scene/format";
import { DataSourceSchema, DataValueSchema, type TDataSource } from "#/scene/schema";

import { AddDataPage } from "./AddDataPage";
import { Button } from "./Button";
import { DataList } from "./DataList";
import { DataSourcePage } from "./DataSourcePage";
import { DataTablePage } from "./DataTablePage";
import { DataValuePage } from "./DataValuePage";
import { Hint, SearchField, Section } from "./fields";
import { ReadLinkDialog } from "./ReadLinkDialog";
import { type ISpreadsheetReading, ReadSpreadsheetDialog } from "./ReadSpreadsheetDialog";
import { ShowValueInWorld } from "./ShowInWorld";
import { SplitDialog } from "./SplitDialog";
import { useNarrowLayout } from "./useNarrowLayout";

import styles from "./DataWindow.module.css";

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

/** The world's values and tables by key, to find what a read added. */
const keysNow = () => {
	const { values, tables } = useEditor.getState().scene.data;
	return {
		values: new Set(values.map((value) => value.key)),
		tables: new Set(tables.map((table) => table.key)),
	};
};

/** What a read added since `before`: a table first (rows are what most worlds place), else a value. */
const addedSince = (before: ReturnType<typeof keysNow>): TDataWindowAt | null => {
	const { values, tables } = useEditor.getState().scene.data;
	const table = tables.find((each) => !before.tables.has(each.key));
	if (table) {
		return { kind: "table", key: table.key };
	}
	const value = values.find((each) => !before.values.has(each.key));
	return value ? { kind: "value", key: value.key } : null;
};

/**
 * The Data window (ADR-0123), like Preferences: the world's data as one list
 * on the left (by where it came from, with a search), and what's picked on the
 * right: a value, a table, a source, or Add data. Adding data ends at Show it
 * in the world for what was added. On phones it fills the screen: the list,
 * then what's picked, with a way back.
 */
export const DataWindow = () => {
	const at = useEditor((s) => s.dataWindow);
	const openDataWindow = useEditor((s) => s.openDataWindow);
	const data = useEditor((s) => s.scene.data);
	const upsertData = useEditor((s) => s.upsertData);
	const narrow = useNarrowLayout();
	const [query, setQuery] = useState("");
	const [reading, setReading] = useState<ISpreadsheetReading | null>(null);
	const [readsLink, setReadsLink] = useState(false);
	// What was there before a read, to open what it added; and the key of what was just added.
	const [before, setBefore] = useState<ReturnType<typeof keysNow> | null>(null);
	const [newKey, setNewKey] = useState<string | null>(null);
	const open = at !== null;
	const groups = dataGroupsOf(data, query);
	const isFirst = !hasAnyData(data);

	const go = (next: TDataWindowAt) => {
		setNewKey(null);
		openDataWindow(next);
	};

	const readFile = async (source?: TDataSource) => {
		const picked = await pickSpreadsheet(source);
		if (picked) {
			setBefore(keysNow());
			setReading(picked);
		}
	};

	/** A read dialog closed: open what it added, said as the next step. */
	const finishReading = () => {
		if (before) {
			const added = addedSince(before);
			if (added) {
				openDataWindow(added);
				setNewKey(
					added.kind === "source" || added.kind === "start" || added.kind === "add"
						? null
						: added.key,
				);
			}
		}
		setBefore(null);
	};

	const typeANumber = () => {
		let key = toDataKey("new value");
		let n = 1;
		while (data.values.some((value) => value.key === key)) {
			key = `new_value_${++n}`;
		}
		upsertData(DataValueSchema.parse({ key, name: "New value", value: 0 }));
		openDataWindow({ kind: "value", key });
		setNewKey(key);
	};

	const value = at?.kind === "value" ? data.values.find((each) => each.key === at.key) : undefined;
	const table = at?.kind === "table" ? data.tables.find((each) => each.key === at.key) : undefined;
	const source = at?.kind === "source" ? data.sources.find((each) => each.id === at.id) : undefined;
	const addPage = (
		<AddDataPage
			isFirst={isFirst}
			onFile={() => void readFile()}
			onLink={() => {
				setBefore(keysNow());
				setReadsLink(true);
			}}
			onType={typeANumber}
		/>
	);

	const page = value ? (
		<>
			<header className={styles.pageHead}>
				<h3 className={styles.pageTitle}>{value.name || value.key}</h3>

				<p className={styles.pageAbout}>
					<strong className={styles.bigValue}>{formatEntry(value)}</strong>

					{` · ${originOf(value.source, data.sources)}`}
				</p>
			</header>

			<Section
				icon="globe"
				title={newKey === value.key ? "Next: show it in the world" : "Show it in the world"}
			>
				<ShowValueInWorld value={value} />
			</Section>

			<DataValuePage
				key={value.key}
				value={value}
				source={data.sources.find((each) => each.id === value.source?.sourceId) ?? null}
				origin={originOf(value.source, data.sources)}
				onReadAgain={(again) => void readFile(again)}
			/>
		</>
	) : table ? (
		<DataTablePage
			key={table.key}
			table={table}
			origin={originOf(table.source, data.sources)}
			isNew={newKey === table.key}
		/>
	) : source ? (
		<DataSourcePage
			key={source.id}
			source={source}
			onReadFileAgain={(again) => void readFile(again)}
		/>
	) : at?.kind === "add" || isFirst ? (
		addPage
	) : (
		<>
			<Hint>
				Pick a value or a table on the left to see it and what shows it, or add more data.
			</Hint>

			{addPage}
		</>
	);
	// Phones show one column: the list at the start, else what's picked.
	const showsPage = !narrow || (at !== null && at.kind !== "start") || isFirst;

	return (
		<>
			<SplitDialog
				open={open}
				onOpenChange={(next) => !next && openDataWindow(null)}
				title="Data"
				actions={
					<Button size="sm" variant="primary" icon="plus" onClick={() => go({ kind: "add" })}>
						Add data
					</Button>
				}
				navLabel="The world's data"
				nav={
					isFirst ? (
						<Hint>Nothing added yet.</Hint>
					) : (
						<>
							<SearchField
								label="Find data"
								placeholder="Find data…"
								value={query}
								onChange={setQuery}
							/>

							<DataList groups={groups} at={at} onOpen={go} />

							{groups.length === 0 && <Hint>{`Nothing matches “${query.trim()}”.`}</Hint>}
						</>
					)
				}
				showsPage={showsPage}
				onBack={isFirst ? undefined : () => go({ kind: "start" })}
				backLabel="Back to all data"
			>
				{page}
			</SplitDialog>

			{reading && (
				<ReadSpreadsheetDialog
					reading={reading}
					onClose={() => {
						setReading(null);
						finishReading();
					}}
				/>
			)}

			{readsLink && (
				<ReadLinkDialog
					onClose={() => {
						setReadsLink(false);
						finishReading();
					}}
					onSpreadsheet={(sheet) => {
						setReadsLink(false);
						setReading(sheet);
					}}
				/>
			)}
		</>
	);
};
