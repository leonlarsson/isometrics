import { useEffect, useState } from "react";

import { sourceNameOf } from "#/editor/dataList";
import { dataUsesOf, type IDataUse } from "#/editor/dataUses";
import { useEditor } from "#/editor/store";
import { formatWhen } from "#/lib/when";
import { formatEntry, formatValue, toDataKey } from "#/scene/format";
import {
	DataColumnSchema,
	DataThresholdSchema,
	type TDataSource,
	type TDataTable,
	type TDataValue,
} from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTableDialog } from "./DataTableDialog";
import {
	Hint,
	NumberField,
	resetToDefault,
	Section,
	SelectField,
	SwitchField,
	TextField,
} from "./fields";
import { List, ListItem } from "./List";
import { ReadFromSourceDialog } from "./ReadFromSourceDialog";
import { HistoryChart, numericPoints } from "./Sparkline";

/** Values may be numbers or text; keep numbers numeric so formatting works. */
const parseValue = (raw: string): number | string => {
	const trimmed = raw.trim();
	if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}
	return raw;
};

/** A key as it's typed: lowercase letters, numbers and underscores. */
const asKey = (typed: string) =>
	typed
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_");

/** A key Add made up ("new_value_2"): it follows the value's name until it's given one. */
const isMadeUpKey = (key: string) => /^new_value(_\d+)?$/.test(key);

/** Things in words: "City hall, Weather and 2 more". */
const listed = (names: string[]) =>
	names.length <= 3
		? names.join(", ").replace(/, ([^,]*)$/, " and $1")
		: `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

interface IDataValuePageProps {
	value: TDataValue;
	/** The source it's read from, if it still exists. */
	source: TDataSource | null;
	onReadAgain: (source: TDataSource) => void;
}

/**
 * One data value's page in the Data window (data study, ADR-0123): its name,
 * key, value and unit, where it comes from, its past values, and everything
 * that shows or follows it, each a way to go there (closing the window).
 */
export const DataValuePage = ({ value, source, onReadAgain }: IDataValuePageProps) => {
	const scene = useEditor((s) => s.scene);
	const upsertData = useEditor((s) => s.upsertData);
	const removeData = useEditor((s) => s.removeData);
	const selectItems = useEditor((s) => s.selectItems);
	const setTab = useEditor((s) => s.setTab);
	const openDataWindow = useEditor((s) => s.openDataWindow);
	// A run of edits to its name and key, while the page is open, is one undo step.
	const [editing] = useState(() => `data-page:${value.key}`);
	const [typedKey, setTypedKey] = useState(value.key);
	const [typedValue, setTypedValue] = useState(String(value.value));
	const [showsPast, setShowsPast] = useState(false);
	const [confirmsRemove, setConfirmsRemove] = useState(false);
	const [readsFrom, setReadsFrom] = useState(false);
	const name = value.name || value.key;
	const others = scene.data.values.filter((each) => each.key !== value.key);
	const uses = dataUsesOf(scene, value.key);

	// What's typed follows changes made elsewhere: undo, reading its source again.
	useEffect(() => {
		if (asKey(typedKey) !== value.key) {
			setTypedKey(value.key);
		}
	}, [value.key]);
	useEffect(() => {
		if (parseValue(typedValue) !== value.value) {
			setTypedValue(String(value.value));
		}
	}, [value.value]);

	const nextKey = asKey(typedKey);
	const keyProblem =
		nextKey === ""
			? "A key needs a letter or a number."
			: others.some((each) => each.key === nextKey)
				? "Another value has this key: pick another."
				: null;

	const rename = (typed: string) => {
		// A made-up key becomes the name's, as long as no other value has it.
		const key = toDataKey(typed);
		if (isMadeUpKey(value.key) && typed.trim() && !others.some((each) => each.key === key)) {
			upsertData({ ...value, name: typed, key }, value.key, editing);
			setTypedKey(key);
			return;
		}
		upsertData({ ...value, name: typed }, undefined, editing);
	};

	const changeKey = (typed: string) => {
		setTypedKey(typed);
		const key = asKey(typed);
		if (key && key !== value.key && !others.some((each) => each.key === key)) {
			upsertData({ ...value, key }, value.key, editing);
		}
	};

	const go = (use: IDataUse) => {
		if (use.item) {
			selectItems([use.item]);
		}
		setTab(use.tab);
		openDataWindow(null);
	};

	const numbers = numericPoints(value.history);
	const values = numbers.map((point) => point.value);
	const pastInWords = [
		value.history.length > 0 &&
			`${value.history.length.toLocaleString()} past values, from ${formatWhen(value.history[0].at)} to ${formatWhen(value.history[value.history.length - 1].at)}`,
		numbers.length >= 2 &&
			`lowest ${formatValue(Math.min(...values), value.unit)}, highest ${formatValue(Math.max(...values), value.unit)}`,
	]
		.filter(Boolean)
		.join("; ");
	const past: TDataTable = {
		key: "past_values",
		name: `${name}: past values`,
		source: null,
		keyColumn: "",
		columns: [
			DataColumnSchema.parse({ key: "at", name: "When" }),
			DataColumnSchema.parse({ key: "value", name, unit: value.unit }),
		],
		rows: [...value.history]
			.reverse()
			.map((point) => ({ at: formatWhen(point.at), value: point.value })),
		history: [],
	};

	return (
		<>
			<Section id="data.value" icon="chart" title="Value" keywords="data value name key unit">
				<TextField label="Name" value={value.name} onChange={rename} hasNoDefault />

				<TextField
					label="Key"
					value={typedKey}
					onChange={changeKey}
					hasNoDefault
					hint={
						keyProblem ??
						"Cards and settings follow the value by its key; changing it changes it there too."
					}
				/>

				<TextField
					label="Value"
					value={typedValue}
					onChange={(raw) => {
						setTypedValue(raw);
						upsertData({ ...value, value: parseValue(raw) });
					}}
					hasNoDefault
					hint={
						<>
							Shows as <strong>{formatEntry(value)}</strong>
						</>
					}
				/>

				<TextField
					label="Unit"
					value={value.unit}
					onChange={(unit) => upsertData({ ...value, unit })}
					inherit={resetToDefault(value.unit, "", () => upsertData({ ...value, unit: "" }), "none")}
					hint="Shown right after the value: type “ min” (with a space) or “%”."
				/>

				<TextField
					label="Note"
					value={value.about}
					onChange={(about) => upsertData({ ...value, about })}
					inherit={resetToDefault(
						value.about,
						"",
						() => upsertData({ ...value, about: "" }),
						"none",
					)}
					hint="Shown with it in detail tiles and the data's tables, e.g. “Example numbers, not measured”."
				/>
			</Section>

			<Section
				id="data.value.watch"
				icon="alert"
				title="Watch line"
				keywords="threshold alert flag watch warning line"
				actions={
					<SwitchField
						label="Watch"
						checked={value.threshold !== null}
						onChange={(on) =>
							upsertData({
								...value,
								threshold: on
									? DataThresholdSchema.parse({
											line: typeof value.value === "number" ? value.value : 0,
										})
									: null,
							})
						}
						inherit={{
							...resetToDefault(
								value.threshold !== null,
								false,
								() => upsertData({ ...value, threshold: null }),
								"off",
							),
							isCompact: true,
						}}
					/>
				}
			>
				{value.threshold ? (
					<>
						<NumberField
							label="Line"
							value={value.threshold.line}
							onChange={(line) =>
								value.threshold && upsertData({ ...value, threshold: { ...value.threshold, line } })
							}
							hasNoDefault
						/>

						<SelectField
							label="Flagged when"
							value={value.threshold.flagsWhen}
							options={[
								{ value: "below", label: "Below the line" },
								{ value: "above", label: "Above the line" },
							]}
							onChange={(flagsWhen) =>
								value.threshold &&
								upsertData({ ...value, threshold: { ...value.threshold, flagsWhen } })
							}
							inherit={resetToDefault(
								value.threshold.flagsWhen,
								"below",
								() =>
									value.threshold &&
									upsertData({ ...value, threshold: { ...value.threshold, flagsWhen: "below" } }),
							)}
						/>

						<TextField
							label="Word"
							value={value.threshold.word}
							onChange={(word) =>
								value.threshold && upsertData({ ...value, threshold: { ...value.threshold, word } })
							}
							inherit={resetToDefault(
								value.threshold.word,
								"Watch",
								() =>
									value.threshold &&
									upsertData({ ...value, threshold: { ...value.threshold, word: "Watch" } }),
							)}
							hint={`Cards and tiles show “⚠ ${value.threshold.word || "Watch"}” while it's ${value.threshold.flagsWhen} ${formatEntry({ ...value, value: value.threshold.line })}: a word and a symbol, never colour alone.`}
						/>
					</>
				) : (
					<Hint>
						Flag it on cards and tiles when it crosses a line you set, with a word like “⚠ Watch”.
					</Hint>
				)}
			</Section>

			<Section
				id="data.value.source"
				icon="file"
				title="Where it comes from"
				keywords="source spreadsheet file read typed"
			>
				{value.source ? (
					<>
						<Hint>
							{source
								? `It comes from ${sourceNameOf(source)}. Typing a value above changes it only until it's read again.`
								: "Its source was removed, so it stays as last read."}
						</Hint>

						<ButtonGroup>
							{source && (
								<Button
									size="sm"
									icon="info"
									onClick={() => openDataWindow({ kind: "source", id: source.id })}
								>
									See the source
								</Button>
							)}

							{source?.kind === "file" && (
								<Button size="sm" icon="upload" onClick={() => onReadAgain(source)}>
									Read it again…
								</Button>
							)}

							<Button size="sm" icon="download" onClick={() => setReadsFrom(true)}>
								Read it from somewhere else…
							</Button>

							<Button size="sm" onClick={() => upsertData({ ...value, source: null })}>
								Type it by hand instead
							</Button>
						</ButtonGroup>
					</>
				) : (
					<>
						<Hint>
							Typed by hand: it shows what's typed above. Read it from a source to have it follow a
							number there (a link, an API or a spreadsheet); it keeps its name and everything that
							shows it.
						</Hint>

						<ButtonGroup>
							<Button size="sm" icon="download" onClick={() => setReadsFrom(true)}>
								Read it from a source…
							</Button>
						</ButtonGroup>
					</>
				)}
			</Section>

			<Section
				id="data.value.history"
				icon="clock"
				title="Past values"
				keywords="history trend over time sparkline"
			>
				{numbers.length >= 2 && (
					<HistoryChart points={value.history} label={`${name} over time`} unit={value.unit} />
				)}

				{value.history.length > 0 ? (
					<>
						<Hint>{pastInWords}</Hint>

						<ButtonGroup>
							<Button size="sm" onClick={() => setShowsPast(true)}>
								Show them all
							</Button>

							<Button size="sm" onClick={() => upsertData({ ...value, history: [] })}>
								Clear past values
							</Button>
						</ButtonGroup>
					</>
				) : (
					<Hint>
						None kept. A value read from a spreadsheet with dates keeps its past values here, drawn
						as a line.
					</Hint>
				)}
			</Section>

			<Section
				id="data.value.uses"
				icon="layers"
				title="Used by"
				keywords="used follows cards bindings"
			>
				{uses.length > 0 ? (
					<List>
						{uses.map((use) => (
							<ListItem
								key={`${use.item?.id ?? use.thing}:${use.setting}`}
								label={use.thing}
								meta={use.setting}
								stacked
								onClick={() => go(use)}
							/>
						))}
					</List>
				) : (
					<Hint>Nothing shows or follows it yet: Show it in the world, above.</Hint>
				)}

				<ButtonGroup>
					<Button
						size="sm"
						variant="danger"
						icon="trash"
						onClick={() => (uses.length > 0 ? setConfirmsRemove(true) : removeData(value.key))}
					>
						{uses.length > 0 ? `Remove value (unbinds ${uses.length})` : "Remove value"}
					</Button>
				</ButtonGroup>
			</Section>

			<ConfirmDialog
				open={confirmsRemove}
				onOpenChange={setConfirmsRemove}
				title={`Remove ${name}?`}
				description={`${listed([...new Set(uses.map((use) => use.thing))])} will stop showing or following it. Undo brings it back.`}
				confirmLabel="Remove"
				danger
				onConfirm={() => removeData(value.key)}
			/>

			{readsFrom && <ReadFromSourceDialog value={value} onClose={() => setReadsFrom(false)} />}

			{showsPast && (
				<DataTableDialog
					table={past}
					origin="newest first"
					onClose={() => setShowsPast(false)}
					offersPlacing={false}
				/>
			)}
		</>
	);
};
