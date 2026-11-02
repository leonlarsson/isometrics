import { useState } from "react";

import { sourceKindOf, sourceNameOf } from "#/editor/dataList";
import { pickFile } from "#/editor/fileActions";
import { allowLink, forgetLink, isLinkAllowed } from "#/editor/linkTrust";
import { LinkError, nameOfLink, readLink } from "#/editor/readLink";
import { readSpreadsheet, SPREADSHEET_TYPES } from "#/editor/readSpreadsheet";
import { newId, useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { webAddress } from "#/lib/webAddress";
import { fieldChoicesInJson, fieldChoicesInSheets, type IFieldChoice } from "#/scene/fieldChoices";
import { formatEntry, formatValue } from "#/scene/format";
import {
	DataSourceRefSchema,
	DataSourceSchema,
	type TDataSource,
	type TDataValue,
} from "#/scene/schema";
import { readSheet } from "#/scene/sheets";

import { ActionCards } from "./ActionCards";
import { Button, ButtonGroup } from "./Button";
import { Dialog } from "./Dialog";
import { GroupLabel, Hint, resetToDefault, SelectField, TextField } from "./fields";
import { List, ListItem } from "./List";
import { REFRESH_OPTIONS } from "./ReadLinkDialog";

/** What was read, ready to pick a field from: the source it's from (new or already in the world), and its fields. */
interface IReadSource {
	source: TDataSource;
	isNew: boolean;
	choices: IFieldChoice[];
}

/** A field's number now and how many past values come with it. */
const holds = (choice: IFieldChoice) =>
	`${formatValue(choice.value)}${choice.history.length > 0 ? ` · ${choice.history.length.toLocaleString()} past values` : ""}`;

/**
 * Read it from a source… (ADR-0123): a value already in the world (typed by
 * hand, or read from somewhere) follows a field of a source from now on. Pick
 * where (a source in the world, a new link or API, a spreadsheet file), then
 * which of the numbers found there; the value keeps its name, key, note and
 * everything that shows it. Reading a link here is this browser's yes to it,
 * as in Read a link or API… (ADR-0119).
 */
export const ReadFromSourceDialog = ({
	value,
	onClose,
}: {
	value: TDataValue;
	onClose: () => void;
}) => {
	const sources = useEditor((s) => s.scene.data.sources);
	const commit = useEditor((s) => s.commit);
	const name = value.name || value.key;
	const [typesLink, setTypesLink] = useState(false);
	const [url, setUrl] = useState("");
	const [refresh, setRefresh] = useState("");
	const [reading, setReading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [read, setRead] = useState<IReadSource | null>(null);
	const [chosenId, setChosenId] = useState<string | null>(null);
	const chosen = read?.choices.find((choice) => choice.id === chosenId) ?? null;
	// Sources a value can be read from again: links and APIs with an address, and spreadsheet files.
	const readable = sources.filter(
		(source) =>
			source.kind === "file" || ((source.kind === "link" || source.kind === "api") && source.url),
	);

	/** Read a link (one in the world, or a new address), allowing it first; taken back if it fails. */
	const readAddress = async (address: string, existing: TDataSource | null) => {
		setReading(true);
		setError(null);
		const wasAllowed = isLinkAllowed(address);
		allowLink(address);
		try {
			const got = await readLink(address);
			const choices =
				got.kind === "json"
					? fieldChoicesInJson(got.json)
					: fieldChoicesInSheets([
							{
								name: null,
								sheet: readSheet(got.sheet.rows, { decimalComma: got.sheet.decimalComma }),
							},
						]);
			setRead({
				source:
					existing ??
					DataSourceSchema.parse({
						id: newId("source"),
						name: nameOfLink(address),
						kind: got.kind === "json" ? "api" : "link",
						url: address,
					}),
				isNew: existing === null,
				choices,
			});
			setChosenId(null);
		} catch (caught) {
			if (!wasAllowed) {
				forgetLink(address);
			}
			setError(caught instanceof LinkError ? caught.message : "It couldn't be read.");
		} finally {
			setReading(false);
		}
	};

	/** Pick a spreadsheet (for a file source in the world, the new copy of its file) and list its columns. */
	const readFile = async (existing: TDataSource | null) => {
		const file = await pickFile(SPREADSHEET_TYPES);
		if (!file) {
			return;
		}
		setError(null);
		try {
			const sheets = await readSpreadsheet(file);
			setRead({
				source: existing
					? { ...existing, fileName: file.name }
					: DataSourceSchema.parse({
							id: newId("source"),
							name: file.name,
							kind: "file",
							fileName: file.name,
						}),
				isNew: existing === null,
				choices: fieldChoicesInSheets(
					sheets.map((sheet) => ({
						name: sheet.name,
						sheet: readSheet(sheet.rows, { decimalComma: sheet.decimalComma }),
					})),
				),
			});
			setChosenId(null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "It isn't a spreadsheet this can read.");
		}
	};

	const readFrom = (source: TDataSource) =>
		source.kind === "file" ? void readFile(source) : void readAddress(source.url ?? "", source);

	const confirm = () => {
		if (!read || !chosen) {
			return;
		}
		const source: TDataSource = {
			...read.source,
			lastReadAt: new Date().toISOString(),
			...(read.isNew && read.source.url
				? { refreshSeconds: refresh ? Number(refresh) : null }
				: {}),
		};
		commit((scene) => {
			const index = scene.data.sources.findIndex((each) => each.id === source.id);
			if (index === -1) {
				scene.data.sources.push(source);
			} else {
				scene.data.sources[index] = source;
			}
			const found = scene.data.values.find((each) => each.key === value.key);
			if (found) {
				found.source = DataSourceRefSchema.parse({ sourceId: source.id, ...chosen.ref });
				found.value = chosen.value;
				// Past values come from the source when it has them; otherwise the ones it kept stay.
				if (chosen.history.length > 0) {
					found.history = chosen.history;
				}
			}
		});
		notify(
			`${name} now reads ${chosen.label}`,
			`From ${sourceNameOf(source)}. It's ${formatValue(chosen.value)} now.`,
		);
		onClose();
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => !open && onClose()}
			title={`Read ${name} from a source`}
			description={`It keeps its name, its key and everything that shows it; only where its number comes from changes. Now: ${formatEntry(value)}.`}
			closeLabel="Cancel"
			wide
			confirm={{ label: "Read it from here", disabled: !chosen, onConfirm: confirm }}
		>
			{read ? (
				<>
					<GroupLabel>{`2. Which number, from ${sourceNameOf(read.source)}?`}</GroupLabel>

					{read.choices.length > 0 ? (
						<List>
							{read.choices.map((choice) => (
								<ListItem
									key={choice.id}
									label={choice.label}
									meta={holds(choice)}
									stacked
									current={choice.id === chosenId}
									onClick={() => setChosenId(choice.id)}
								/>
							))}
						</List>
					) : (
						<Hint>
							No numbers were found in it. Pick another source, or read it as a table with Add data.
						</Hint>
					)}

					{read.isNew && read.source.url && (
						<SelectField
							label="Read it again"
							value={refresh}
							options={REFRESH_OPTIONS}
							onChange={setRefresh}
							inherit={resetToDefault(refresh, "", () => setRefresh(""), "only when asked")}
							hint="While the world is open, by this browser. What arrives shows at once, and isn't saved until you keep it."
						/>
					)}

					<ButtonGroup>
						<Button size="sm" icon="chevronLeft" onClick={() => setRead(null)}>
							Pick another source
						</Button>
					</ButtonGroup>
				</>
			) : (
				<>
					<GroupLabel>1. Where is it?</GroupLabel>

					{readable.length > 0 && (
						<List>
							{readable.map((source) => (
								<ListItem
									key={source.id}
									label={sourceNameOf(source)}
									meta={
										source.kind === "file"
											? `${sourceKindOf(source)}: pick ${source.fileName ?? "the file"} again`
											: source.url
									}
									stacked
									onClick={() => readFrom(source)}
								/>
							))}
						</List>
					)}

					<ActionCards
						cards={[
							{
								title: "A new link or API…",
								about: "An address that gives JSON or CSV. Reading it allows it in this browser.",
								onChoose: () => setTypesLink(true),
							},
							{
								title: "A spreadsheet file…",
								about: "CSV or Excel from your computer: pick a column.",
								onChoose: () => void readFile(null),
							},
						]}
					/>

					{typesLink && (
						<>
							<TextField
								label="Address"
								value={url}
								placeholder="https://api.example.com/stats"
								onChange={setUrl}
								hasNoDefault
							/>

							<ButtonGroup>
								<Button
									size="sm"
									icon="download"
									disabled={reading || webAddress(url.trim()) === null}
									onClick={() => void readAddress(url.trim(), null)}
								>
									{reading ? "Reading…" : "Read"}
								</Button>
							</ButtonGroup>
						</>
					)}

					{reading && !typesLink && <Hint>Reading…</Hint>}
				</>
			)}

			{error && (
				<Hint>
					<strong>Couldn't read it.</strong> {error}
				</Hint>
			)}
		</Dialog>
	);
};
