import type { Draft } from "immer";
import { useState } from "react";

import {
	hasNoAddress,
	siteOf,
	sourceKindOf,
	sourceNameOf,
	tableInWords,
	valueInWords,
} from "#/editor/dataList";
import { allowLink } from "#/editor/linkTrust";
import { LINK_FAILURES } from "#/editor/readLink";
import { refreshSource } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { webAddress } from "#/lib/webAddress";
import { formatEntry } from "#/scene/format";
import type { TDataSource } from "#/scene/schema";

import { AllowedLinksDialog } from "./AllowedLinksDialog";
import { Button, ButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Hint, resetToDefault, Section, SelectField, TextField } from "./fields";
import { List, ListItem } from "./List";
import { PageKind } from "./PageKind";
import { REFRESH_OPTIONS } from "./ReadLinkDialog";
import { everyInWords, useSourceStatuses } from "./useSourceStatuses";

import styles from "./DataWindow.module.css";

/** What a kind of source is, in a sentence. */
const kindInWords = (source: TDataSource) =>
	source.kind === "file"
		? "A spreadsheet file, read from someone's computer. It's read again only when you pick the file again."
		: hasNoAddress(source)
			? "Put in from outside this app by whoever made the world (by hand or by an AI). It has no address, so it can't be read again."
			: source.kind === "push"
				? "Values pushed to the world from outside."
				: "A link or API, read by this browser while the world is open.";

/** How often it's read again: the usual choices, and the source's own if it's another (a world written outside the app). */
const refreshOptionsFor = (seconds: number | null) =>
	seconds === null || REFRESH_OPTIONS.some((option) => option.value === String(seconds))
		? REFRESH_OPTIONS
		: [
				...REFRESH_OPTIONS,
				{ value: String(seconds), label: everyInWords(seconds).replace(/^every/, "Every") },
			];

/**
 * A link's or API's address, changed on purpose: typed, then Use this address.
 * Typed here, it's this browser's yes to the new address (as in Read a link or
 * API…, ADR-0119), and it's read at once; the values and tables it gave keep
 * where in the answer they're read from. A source with no address gets one
 * this way and can be read again.
 */
const SourceAddressField = ({
	source,
	onListAllowed,
}: {
	source: TDataSource;
	onListAllowed: () => void;
}) => {
	const commit = useEditor((s) => s.commit);
	const [typed, setTyped] = useState(source.url ?? "");
	const next = typed.trim();
	const isChanged = next !== (source.url ?? "");
	const isValid = webAddress(next) !== null;

	const use = () => {
		allowLink(next);
		commit((scene) => {
			const found = scene.data.sources.find((each) => each.id === source.id);
			if (found) {
				found.url = next;
			}
		});
		void refreshSource({ ...source, url: next }, { asked: true });
	};

	return (
		<>
			<TextField
				label="Address"
				value={typed}
				placeholder="https://api.example.com/stats"
				onChange={setTyped}
				hasNoDefault
				hint={
					isChanged && next !== "" && !isValid
						? "An address starts with https:// (or http://)."
						: source.url
							? "Where it's read from. A new address is allowed in this browser and read at once."
							: "It has none, so it can't be read again. Give it one to read it from now on."
				}
			/>

			<ButtonGroup>
				<Button size="sm" icon="check" disabled={!isChanged || !isValid} onClick={use}>
					Use this address
				</Button>

				{source.url && (
					<Button size="sm" variant="ghost" icon="lock" onClick={onListAllowed}>
						External sources this browser reads…
					</Button>
				)}
			</ButtonGroup>
		</>
	);
};

/**
 * A source in the Data window (ADR-0123): what it is, how it's doing, Allow
 * when it waits for a yes (ADR-0119), reading it again, what it gives (each
 * opens), its name, and removing it.
 */
export const DataSourcePage = ({
	source,
	onReadFileAgain,
	onChangeKept,
}: {
	source: TDataSource;
	onReadFileAgain: (source: TDataSource) => void;
	/** Change what's kept from a link or API: read it again with what's kept ticked. */
	onChangeKept: (source: TDataSource) => void;
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
	/** Change this source (typing in a field is one undo step per field, `coalesce`). */
	const change = (recipe: (found: Draft<TDataSource>) => void, coalesce?: string) =>
		commit(
			(scene) => {
				const found = scene.data.sources.find((each) => each.id === source.id);
				if (found) {
					recipe(found);
				}
			},
			coalesce ? { coalesce: `source-${coalesce}:${source.id}` } : undefined,
		);
	const rename = (name: string) =>
		change((found) => {
			found.name = name;
		}, "name");
	const failure = status.tone === "failed" ? status.detail : null;
	const failureKind = useSourceFailure(source.id);

	return (
		<>
			<header className={styles.pageHead}>
				<PageKind icon="download" kind="Source" />

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

			<Section icon="info" title="How it's doing">
				<dl className={styles.facts}>
					<dt>Kind</dt>

					<dd>{sourceKindOf(source)}</dd>

					{source.fileName && (
						<>
							<dt>File</dt>

							<dd>{source.fileName}</dd>
						</>
					)}

					<dt>Status</dt>

					<dd>
						{isWaiting
							? "Not read yet, until you allow it (above)"
							: `${status.text.charAt(0).toUpperCase()}${status.text.slice(1)}`}
					</dd>
				</dl>

				{failure && failureKind && (
					<Hint>
						<strong>{failure}</strong>

						{` ${LINK_FAILURES[failureKind].long}`}
					</Hint>
				)}

				{(source.kind === "file" || (isReadable && !isWaiting)) && (
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
					</ButtonGroup>
				)}
			</Section>

			<Section icon="edit" title="Settings">
				<TextField
					label="Name"
					value={source.name}
					placeholder={sourceNameOf({ ...source, name: "" })}
					onChange={rename}
					inherit={resetToDefault(source.name, "", () => rename(""), "its site or file")}
				/>

				{(source.kind === "link" || source.kind === "api") && (
					<SourceAddressField source={source} onListAllowed={() => setListsAllowed(true)} />
				)}

				{isReadable && (
					<SelectField
						label="Read it again"
						value={source.refreshSeconds === null ? "" : String(source.refreshSeconds)}
						options={refreshOptionsFor(source.refreshSeconds)}
						onChange={(seconds) =>
							change((found) => {
								found.refreshSeconds = seconds ? Number(seconds) : null;
							})
						}
						inherit={resetToDefault(
							source.refreshSeconds,
							null,
							() =>
								change((found) => {
									found.refreshSeconds = null;
								}),
							"only when asked",
						)}
						hint="While the world is open, by this browser. What arrives shows at once, and isn't saved until you keep it."
					/>
				)}

				<TextField
					label="Note"
					value={source.about}
					placeholder="What it is, for whoever opens the world"
					onChange={(about) =>
						change((found) => {
							found.about = about;
						}, "about")
					}
					inherit={resetToDefault(
						source.about,
						"",
						() =>
							change((found) => {
								found.about = "";
							}),
						"none",
					)}
				/>
			</Section>

			<Section icon="chart" title="What it gives">
				{givesValues.length + givesTables.length > 0 ? (
					<List>
						{givesValues.map((value) => (
							<ListItem
								key={`value:${value.key}`}
								label={`${value.name || value.key}: ${formatEntry(value)}`}
								meta={valueInWords(value, [source]).short}
								stacked
								onClick={() => openDataWindow({ kind: "value", key: value.key })}
							/>
						))}

						{givesTables.map((table) => (
							<ListItem
								key={`table:${table.key}`}
								label={table.name || table.key}
								meta={tableInWords(table, [source]).short}
								stacked
								onClick={() => openDataWindow({ kind: "table", key: table.key })}
							/>
						))}
					</List>
				) : (
					<Hint>
						{isWaiting ? "Nothing until it's allowed and read." : "Nothing from it is kept now."}
					</Hint>
				)}

				{isReadable && (
					<ButtonGroup>
						<Button size="sm" icon="edit" onClick={() => onChangeKept(source)}>
							Change what's kept…
						</Button>
					</ButtonGroup>
				)}

				{isReadable && (
					<Hint>
						Reads it again and shows everything in it: tick more numbers, texts or lists to keep
						them, untick one to remove it.
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
