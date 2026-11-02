import { useState } from "react";

import { allowLink, forgetLink, isLinkAllowed } from "#/editor/linkTrust";
import { LinkError, nameOfLink, readLink, type TLinkContent } from "#/editor/readLink";
import { newId, useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { formatValue } from "#/scene/format";
import {
	dataFromJson,
	describeJson,
	guessKeyField,
	type IJsonList,
	nameOfField,
	readJsonPath,
	type TJsonPick,
} from "#/scene/jsonSource";
import { DataSourceSchema, type TDataSource } from "#/scene/schema";

import { Button } from "./Button";
import { DataTableView } from "./DataTableView";
import { Dialog } from "./Dialog";
import {
	CheckboxGroupField,
	FieldGroup,
	Hint,
	resetToDefault,
	SelectField,
	TextField,
} from "./fields";
import type { ISpreadsheetReading } from "./ReadSpreadsheetDialog";

/** How often a link is read again while the world is open. */
export const REFRESH_OPTIONS = [
	{ value: "", label: "Only when asked (and when the world opens)" },
	{ value: "60", label: "Every minute" },
	{ value: "300", label: "Every 5 minutes" },
	{ value: "3600", label: "Every hour" },
];

/** How many of a long list's rows a table keeps. */
const ROW_LIMITS = [
	{ value: "", label: "All of them" },
	{ value: "20", label: "The first 20" },
	{ value: "100", label: "The first 100" },
	{ value: "500", label: "The first 500" },
	{ value: "1000", label: "The first 1,000" },
];

/** A list of entries bigger than this keeps only its first 100 rows unless told otherwise. */
const BIG_LIST = 500;

/** The most numbers offered as values: a response can hold many. */
const MOST_NUMBERS = 40;

type TListUse = "nothing" | "table" | "history";

/** What's chosen for one list of entries in the response. */
interface IListChoice {
	use: TListUse;
	name: string;
	fields: string[];
	keyField: string;
	rowLimit: string;
	dateField: string;
	valueFields: string[];
}

/** How a list starts: a table of its first fields, or values over time when it has dates and numbers. */
const startingChoice = (json: unknown, list: IJsonList): IListChoice => {
	const entries = readJsonPath(json, list.path);
	const dates = list.fields.filter((field) => field.kind === "date");
	const numbers = list.fields.filter((field) => field.kind === "number");
	const isOverTime = dates.length > 0 && numbers.length > 0 && list.fields.length <= 4;
	return {
		use: isOverTime ? "history" : "table",
		name: nameOfField(list.path) || "Table",
		fields: list.fields.slice(0, 8).map((field) => field.path),
		keyField: guessKeyField(Array.isArray(entries) ? entries : [], list.fields),
		rowLimit: list.length > BIG_LIST ? "100" : "",
		dateField: dates[0]?.path ?? "",
		valueFields: numbers.map((field) => field.path),
	};
};

/** The picks a reading makes of the response, from what's chosen. */
const picksOf = (
	values: readonly string[],
	lists: readonly IJsonList[],
	choices: Record<string, IListChoice>,
): TJsonPick[] => [
	...values.map((path): TJsonPick => ({ kind: "value", path, name: nameOfField(path) })),
	...lists.flatMap((list): TJsonPick[] => {
		const choice = choices[list.path];
		if (!choice || choice.use === "nothing") {
			return [];
		}
		if (choice.use === "history") {
			return choice.valueFields.map((field) => ({
				kind: "history",
				path: list.path,
				field,
				dateField: choice.dateField,
				name: nameOfField(field),
			}));
		}
		return [
			{
				kind: "table",
				path: list.path,
				name: choice.name,
				fields: choice.fields,
				keyField: choice.fields.includes(choice.keyField) ? choice.keyField : "",
				maxRowCount: choice.rowLimit ? Number(choice.rowLimit) : null,
			},
		];
	}),
];

/** The choices for one list of entries: keep it as a table or as values over time, and how. */
const ListChoice = ({
	json,
	list,
	choice,
	onChange,
}: {
	json: unknown;
	list: IJsonList;
	choice: IListChoice;
	onChange: (choice: IListChoice) => void;
}) => {
	const dates = list.fields.filter((field) => field.kind === "date");
	const numbers = list.fields.filter((field) => field.kind === "number");
	const fieldOptions = list.fields.map((field) => ({
		value: field.path,
		label: `${nameOfField(field.path)} (${field.path})`,
	}));
	const preview =
		choice.use === "table"
			? dataFromJson(json, "preview", picksOf([], [list], { [list.path]: choice })).tables[0]
			: undefined;
	return (
		<FieldGroup
			title={`${list.path ? `The list at “${list.path}”` : "The list"}: ${list.length.toLocaleString()} entries`}
		>
			<SelectField<TListUse>
				label="Keep it as"
				value={choice.use}
				options={[
					{ value: "nothing", label: "Nothing" },
					{ value: "table", label: "A table: a row for each entry" },
					{
						value: "history",
						label:
							dates.length > 0 && numbers.length > 0
								? "Values over time: a date and numbers in each entry"
								: "Values over time (no field of dates and numbers)",
						disabled: dates.length === 0 || numbers.length === 0,
					},
				]}
				onChange={(use) => onChange({ ...choice, use })}
				hasNoDefault
			/>

			{choice.use === "table" && (
				<>
					<TextField
						label="Table name"
						value={choice.name}
						onChange={(name) => onChange({ ...choice, name })}
						hasNoDefault
					/>

					<CheckboxGroupField
						label="Columns"
						options={fieldOptions}
						value={choice.fields}
						onChange={(fields) => onChange({ ...choice, fields })}
						hasNoDefault
					/>

					<SelectField
						label="Rows named by"
						value={choice.keyField}
						options={[
							{ value: "", label: "Their order" },
							...fieldOptions.filter((option) => choice.fields.includes(option.value)),
						]}
						onChange={(keyField) => onChange({ ...choice, keyField })}
						hasNoDefault
						hint="Things on the map follow a row by this: a name or an id, different in every row."
					/>

					<SelectField
						label="Keep"
						value={choice.rowLimit}
						options={ROW_LIMITS}
						onChange={(rowLimit) => onChange({ ...choice, rowLimit })}
						hasNoDefault
						hint={
							list.length > BIG_LIST
								? `${list.length.toLocaleString()} rows make a big world to save: keep the first ones.`
								: undefined
						}
					/>

					{preview && (
						<DataTableView
							columns={preview.columns}
							rows={preview.rows}
							keyColumn={preview.keyColumn}
							mostRows={5}
						/>
					)}
				</>
			)}

			{choice.use === "history" && (
				<>
					<SelectField
						label="Dates in"
						value={choice.dateField}
						options={dates.map((field) => ({ value: field.path, label: nameOfField(field.path) }))}
						onChange={(dateField) => onChange({ ...choice, dateField })}
						hasNoDefault
					/>

					<CheckboxGroupField
						label="Values"
						options={numbers.map((field) => ({
							value: field.path,
							label: nameOfField(field.path),
						}))}
						value={choice.valueFields}
						onChange={(valueFields) => onChange({ ...choice, valueFields })}
						hasNoDefault
					/>

					<Hint>
						Each becomes a value: the entries are its past values, the latest its value now.
					</Hint>
				</>
			)}
		</FieldGroup>
	);
};

/**
 * Read a link or API… (ADR-0113): a URL read in the browser; a CSV or a
 * published sheet goes on to the spreadsheet dialog, JSON is picked from here:
 * numbers as values, lists as tables or values over time, with a preview.
 */
export const ReadLinkDialog = ({
	onClose,
	onSpreadsheet,
}: {
	onClose: () => void;
	/** The link is a spreadsheet: read it in the spreadsheet dialog, as this source. */
	onSpreadsheet: (reading: ISpreadsheetReading) => void;
}) => {
	const putReadData = useEditor((s) => s.putReadData);
	const [url, setUrl] = useState("");
	const [name, setName] = useState("");
	const [refresh, setRefresh] = useState("");
	const [content, setContent] = useState<Extract<TLinkContent, { kind: "json" }> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [reading, setReading] = useState(false);
	const [values, setValues] = useState<string[]>([]);
	const [choices, setChoices] = useState<Record<string, IListChoice>>({});
	const contents = content ? describeJson(content.json) : null;
	const numbers = contents?.numbers.slice(0, MOST_NUMBERS) ?? [];
	const lists = contents?.lists.slice(0, 6) ?? [];
	const picks = contents ? picksOf(values, lists, choices) : [];

	const sourceFor = (kind: TDataSource["kind"]): TDataSource =>
		DataSourceSchema.parse({
			id: newId("source"),
			name: name.trim() || nameOfLink(url),
			kind,
			url: url.trim(),
			refreshSeconds: refresh ? Number(refresh) : null,
			lastReadAt: new Date().toISOString(),
		});

	const read = async () => {
		setReading(true);
		setError(null);
		// Typed here and read: this browser's yes to the address, given before it's read, so it's
		// read again on its own (ADR-0119). Taken back if reading it fails.
		const wasAllowed = isLinkAllowed(url.trim());
		allowLink(url.trim());
		try {
			const got = await readLink(url);
			if (got.kind === "csv") {
				onSpreadsheet({
					fileName: name.trim() || nameOfLink(url),
					sheets: [got.sheet],
					source: sourceFor("link"),
					isAgain: false,
				});
				return;
			}
			const found = describeJson(got.json);
			setContent(got);
			setValues(found.lists.length === 0 ? found.numbers.slice(0, 3).map((n) => n.path) : []);
			setChoices(
				Object.fromEntries(
					found.lists.slice(0, 6).map((list, index) => [
						list.path,
						// The first list is kept; others start as nothing.
						index === 0
							? startingChoice(got.json, list)
							: { ...startingChoice(got.json, list), use: "nothing" as const },
					]),
				),
			);
		} catch (caught) {
			if (!wasAllowed) {
				forgetLink(url.trim());
			}
			setContent(null);
			setError(caught instanceof LinkError ? caught.message : "It couldn't be read.");
		} finally {
			setReading(false);
		}
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => !open && onClose()}
			title="Read a link or API"
			description="A CSV file, a published Google Sheet, or an API that answers in JSON, read by this browser. Keys and secrets can't be kept in a world yet."
			closeLabel="Cancel"
			wide
			confirm={{
				label: "Add to the world",
				disabled: !content || picks.length === 0,
				onConfirm: () => {
					if (!content) {
						return;
					}
					const source = sourceFor("api");
					const got = dataFromJson(content.json, source.id, picks);
					putReadData(source, got);
					notify(
						`Added ${[
							got.values.length > 0 &&
								`${got.values.length} value${got.values.length === 1 ? "" : "s"}`,
							got.tables.length > 0 &&
								`${got.tables.length} table${got.tables.length === 1 ? "" : "s"}`,
						]
							.filter(Boolean)
							.join(" and ")} from ${source.name}`,
						source.refreshSeconds
							? "It's read again while the world is open; what arrives shows at once and is kept with Keep these values."
							: "Read it again from Sources whenever you like.",
					);
				},
			}}
		>
			<TextField
				label="Address"
				value={url}
				placeholder="https://api.example.com/stats"
				onChange={setUrl}
				hasNoDefault
			/>

			<Button icon="download" onClick={read} disabled={reading || url.trim() === ""}>
				{reading ? "Reading…" : content ? "Read it again" : "Read"}
			</Button>

			{error && (
				<Hint>
					<strong>Couldn't read it.</strong> {error}
				</Hint>
			)}

			{content && contents && (
				<>
					<TextField
						label="Source name"
						value={name}
						placeholder={nameOfLink(url)}
						onChange={setName}
						inherit={resetToDefault(name, "", () => setName(""), "its address")}
					/>

					<SelectField
						label="Read it again"
						value={refresh}
						options={REFRESH_OPTIONS}
						onChange={setRefresh}
						inherit={resetToDefault(refresh, "", () => setRefresh(""), "only when asked")}
						hint="While the world is open, by this browser. What arrives shows at once, and isn't saved until you keep it."
					/>

					{numbers.length > 0 ? (
						<CheckboxGroupField
							label="Values"
							options={numbers.map((number) => ({
								value: number.path,
								label: `${nameOfField(number.path)}: ${formatValue(number.value)} (${number.path})`,
							}))}
							value={values}
							onChange={setValues}
							hasNoDefault
						/>
					) : (
						<Hint>No single numbers in it outside lists.</Hint>
					)}

					{lists.map((list) => (
						<ListChoice
							key={list.path}
							json={content.json}
							list={list}
							choice={choices[list.path] ?? startingChoice(content.json, list)}
							onChange={(choice) => setChoices({ ...choices, [list.path]: choice })}
						/>
					))}

					{picks.length === 0 && <Hint>Pick a value or keep a list to add something.</Hint>}
				</>
			)}
		</Dialog>
	);
};
