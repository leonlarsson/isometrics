import { useState } from "react";

import { isSnapshot, SOURCE_KIND_NAMES, siteOf, sourceNameOf } from "#/editor/dataList";
import { LINK_FAILURES } from "#/editor/readLink";
import { refreshSource } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { formatEntry } from "#/scene/format";
import type { TDataSource } from "#/scene/schema";

import { AllowedLinksDialog } from "./AllowedLinksDialog";
import { Button, ButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Hint, resetToDefault, Section, TextField } from "./fields";
import { List, ListItem } from "./List";
import { everyInWords, useSourceStatuses } from "./useSourceStatuses";

import styles from "./DataWindow.module.css";

/** What a kind of source is, in a sentence. */
const kindInWords = (source: TDataSource) =>
	source.kind === "file"
		? "A spreadsheet file, read from someone's computer. It's read again only when you pick the file again."
		: isSnapshot(source)
			? "A snapshot: read once, outside this app. It has no address to read again."
			: source.kind === "push"
				? "Values pushed to the world from outside."
				: "A link or API, read by this browser while the world is open.";

/**
 * A source in the Data window (ADR-0123): what it is, how it's doing, Allow
 * when it waits for a yes (ADR-0119), reading it again, what it gives (each
 * opens), its name, and removing it.
 */
export const DataSourcePage = ({
	source,
	onReadFileAgain,
}: {
	source: TDataSource;
	onReadFileAgain: (source: TDataSource) => void;
}) => {
	const { values, tables } = useEditor((s) => s.scene.data);
	const commit = useEditor((s) => s.commit);
	const openDataWindow = useEditor((s) => s.openDataWindow);
	const removeDataSource = useEditor((s) => s.removeDataSource);
	const { statusOf, waitingIds } = useSourceStatuses();
	const [confirmsRemove, setConfirmsRemove] = useState(false);
	const [listsAllowed, setListsAllowed] = useState(false);
	const status = statusOf(source);
	const isWaiting = waitingIds.has(source.id);
	const isReadable = (source.kind === "link" || source.kind === "api") && Boolean(source.url);
	const givesValues = values.filter((value) => value.source?.sourceId === source.id);
	const givesTables = tables.filter((table) => table.source?.sourceId === source.id);
	const rename = (name: string) =>
		commit(
			(scene) => {
				const found = scene.data.sources.find((each) => each.id === source.id);
				if (found) {
					found.name = name;
				}
			},
			{ coalesce: `source-name:${source.id}` },
		);
	const failure = status.tone === "failed" ? status.detail : null;
	const failureKind = useSourceFailure(source.id);

	return (
		<>
			<header className={styles.pageHead}>
				<h3 className={styles.pageTitle}>{sourceNameOf(source)}</h3>

				<p className={styles.pageAbout}>{kindInWords(source)}</p>
			</header>

			{isWaiting && (
				<Section icon="lock" title="Waiting for your yes">
					<Hint>
						{`Reading it tells ${siteOf(source.url) ?? "its site"} that someone is looking. A world can come from anyone, so nothing is read from it until you allow it, and then only this address.`}
					</Hint>

					<ButtonGroup>
						<Button
							variant="primary"
							icon="check"
							onClick={() => void refreshSource(source, { asked: true })}
						>
							Allow and read it
						</Button>
					</ButtonGroup>
				</Section>
			)}

			<Section icon="info" title="What it is">
				<dl className={styles.facts}>
					<dt>Kind</dt>

					<dd>{SOURCE_KIND_NAMES[source.kind]}</dd>

					{source.url && (
						<>
							<dt>Address</dt>

							<dd className={styles.address}>{source.url}</dd>
						</>
					)}

					{source.fileName && (
						<>
							<dt>File</dt>

							<dd>{source.fileName}</dd>
						</>
					)}

					{isReadable && source.refreshSeconds && (
						<>
							<dt>Read again</dt>

							<dd>{`${everyInWords(source.refreshSeconds)}, while the world is open`}</dd>
						</>
					)}

					<dt>Now</dt>

					<dd>{status.text}</dd>

					{source.about && (
						<>
							<dt>About</dt>

							<dd>{source.about}</dd>
						</>
					)}
				</dl>

				{failure && failureKind && (
					<Hint>
						<strong>{failure}</strong>

						{` ${LINK_FAILURES[failureKind].long}`}
					</Hint>
				)}

				<ButtonGroup>
					{source.kind === "file" && (
						<Button size="sm" icon="upload" onClick={() => onReadFileAgain(source)}>
							Read it again…
						</Button>
					)}

					{isReadable && !isWaiting && (
						<Button
							size="sm"
							icon="download"
							onClick={() => void refreshSource(source, { asked: true })}
						>
							Read it now
						</Button>
					)}

					{isReadable && (
						<Button size="sm" variant="ghost" icon="lock" onClick={() => setListsAllowed(true)}>
							External sources this browser reads…
						</Button>
					)}
				</ButtonGroup>

				<TextField
					label="Name"
					value={source.name}
					placeholder={sourceNameOf({ ...source, name: "" })}
					onChange={rename}
					inherit={resetToDefault(source.name, "", () => rename(""), "its site or file")}
				/>
			</Section>

			<Section icon="chart" title="What it gives">
				{givesValues.length + givesTables.length > 0 ? (
					<List>
						{givesValues.map((value) => (
							<ListItem
								key={`value:${value.key}`}
								label={value.name || value.key}
								meta={formatEntry(value)}
								onClick={() => openDataWindow({ kind: "value", key: value.key })}
							/>
						))}

						{givesTables.map((table) => (
							<ListItem
								key={`table:${table.key}`}
								label={table.name || table.key}
								meta={`table · ${table.rows.length.toLocaleString()} rows`}
								onClick={() => openDataWindow({ kind: "table", key: table.key })}
							/>
						))}
					</List>
				) : (
					<Hint>
						{isWaiting ? "Nothing until it's allowed and read." : "Nothing from it is kept now."}
					</Hint>
				)}
			</Section>

			<div className={styles.pageFoot}>
				<Button size="sm" icon="trash" variant="danger" onClick={() => setConfirmsRemove(true)}>
					Remove source…
				</Button>
			</div>

			<ConfirmDialog
				open={confirmsRemove}
				onOpenChange={setConfirmsRemove}
				title={`Remove ${sourceNameOf(source)}?`}
				description={`What it gave stays in the world, as typed by hand, and isn't read again.`}
				confirmLabel="Remove source"
				danger
				onConfirm={() => removeDataSource(source.id)}
			/>

			<AllowedLinksDialog open={listsAllowed} onClose={() => setListsAllowed(false)} />
		</>
	);
};

/** How a source failed to be read, if it did. */
const useSourceFailure = (id: string) => {
	const { failures } = useSourceStatuses();
	return failures.find(({ failed }) => failed.some((source) => source.id === id))?.failure ?? null;
};
