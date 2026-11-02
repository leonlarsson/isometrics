import { useEffect, useRef, useState } from "react";

import { sourceNameOf } from "#/editor/dataList";
import { dataUsesOf, type IDataUse } from "#/editor/dataUses";
import { useEditor } from "#/editor/store";
import { formatWhen } from "#/lib/when";
import {
	formatEntry,
	formatValue,
	parseValue,
	toDataKey,
	YES_NO_WORDS,
	yesNoOf,
} from "#/scene/format";
import { recordPoint, todayAsDate } from "#/scene/pastValues";
import {
	DataThresholdSchema,
	type TDataSource,
	type TDataValue,
	type TNumberStyle,
	type TYesNoStyle,
} from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
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
import { PastValuesDialog } from "./PastValuesDialog";
import { ReadFromSourceDialog } from "./ReadFromSourceDialog";
import { HistoryChart, numericPoints } from "./Sparkline";
import { Tooltip } from "./Tooltip";

/** How a number can be written (`numberStyle`), each shown with the value's own number. */
const NUMBER_STYLES: { value: TNumberStyle; label: string }[] = [
	{ value: "full", label: "In full" },
	{ value: "grouped", label: "With separators" },
	{ value: "short", label: "Short" },
];

/** The ways a yes or no can be written (`yesNoStyle`). */
const YES_NO_STYLES: TYesNoStyle[] = ["yesNo", "trueFalse", "onOff", "checks"];

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
	const [editing, setEditing] = useState(() => `data-page:${value.key}`);
	// The key this page just renamed it to: renamed here, it's the same value, still being edited
	// (the page isn't rebuilt, so the field being typed in keeps its place).
	const renamedTo = useRef<string | null>(null);
	const [typedKey, setTypedKey] = useState(value.key);
	const [typedValue, setTypedValue] = useState(String(value.value));
	const [editsPast, setEditsPast] = useState(false);
	// Today's number, recorded: today's entry holds what it shows now.
	const today = todayAsDate();
	const isRecordedToday = value.history.some(
		(point) => point.at === today && point.value === value.value,
	);
	const [confirmsRemove, setConfirmsRemove] = useState(false);
	const [readsFrom, setReadsFrom] = useState(false);
	const name = value.name || value.key;
	const yesNo = yesNoOf(value.value);
	// Unset, the style in effect: separators, short from 100,000.
	const numberStyleShown: TNumberStyle =
		value.numberStyle ??
		(typeof value.value === "number" && Math.abs(value.value) >= 100_000 ? "short" : "grouped");
	const others = scene.data.values.filter((each) => each.key !== value.key);
	const uses = dataUsesOf(scene, value.key);

	// Another value opened here, or this one renamed elsewhere (undo): start afresh with it.
	useEffect(() => {
		if (renamedTo.current === value.key) {
			renamedTo.current = null;
			return;
		}
		if (asKey(typedKey) !== value.key) {
			setTypedKey(value.key);
			setTypedValue(String(value.value));
			setEditing(`data-page:${value.key}`);
			setEditsPast(false);
			setConfirmsRemove(false);
			setReadsFrom(false);
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
		// A key that follows the name (made up by Add, or still the name's) becomes the new name's,
		// as long as no other value has it; one typed by hand stays.
		const key = toDataKey(typed);
		const followsName = isMadeUpKey(value.key) || value.key === toDataKey(value.name);
		if (followsName && typed.trim() && !others.some((each) => each.key === key)) {
			renamedTo.current = key;
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
			renamedTo.current = key;
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

				{/* How it's written, for what it holds: a number, or a yes or no (other text is as typed). */}
				{typeof value.value === "number" && (
					<SelectField
						label="Numbers written as"
						value={numberStyleShown}
						options={NUMBER_STYLES.map((style) => ({
							value: style.value,
							label: `${style.label}: ${formatValue(value.value, value.unit, style.value)}`,
						}))}
						onChange={(numberStyle) => upsertData({ ...value, numberStyle })}
						inherit={{
							from: "default",
							inherited: value.numberStyle === null,
							onReset: () => upsertData({ ...value, numberStyle: null }),
							value: "separators, short from 100,000",
						}}
						hint="How cards, tiles and lists write it."
					/>
				)}

				{yesNo && (
					<SelectField
						label="Yes/no written as"
						value={value.yesNoStyle ?? "yesNo"}
						options={YES_NO_STYLES.map((style) => ({
							value: style,
							label: `${YES_NO_WORDS[style].yes} / ${YES_NO_WORDS[style].no}`,
						}))}
						onChange={(yesNoStyle) => upsertData({ ...value, yesNoStyle })}
						inherit={{
							from: "default",
							inherited: value.yesNoStyle === null,
							onReset: () => upsertData({ ...value, yesNoStyle: null }),
							value: "yes / no",
						}}
						hint={`How cards, tiles and lists write it: “${formatEntry(value)}” now. Things that follow it still read it as on or off.`}
					/>
				)}

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
							number, a text or a yes/no there (a link, an API or a spreadsheet); it keeps its name
							and everything that shows it.
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
					<HistoryChart
						points={value.history}
						label={`${name} over time`}
						unit={value.unit}
						numberStyle={value.numberStyle}
					/>
				)}

				<Hint>
					{value.history.length > 0
						? pastInWords
						: "None yet. Record today's number to start one, or read it from a spreadsheet or link with a date in each row."}
				</Hint>

				<ButtonGroup>
					<Tooltip
						label={
							isRecordedToday
								? `Today's entry already holds ${formatEntry(value)}.`
								: `Writes ${formatEntry(value)} into its past values, dated today (${today}).`
						}
					>
						<Button
							size="sm"
							icon="plus"
							disabled={isRecordedToday}
							onClick={() =>
								upsertData({
									...value,
									history: recordPoint(value.history, { at: today, value: value.value }),
								})
							}
						>
							Record today's number
						</Button>
					</Tooltip>

					<Button size="sm" icon="edit" onClick={() => setEditsPast(true)}>
						Edit past values…
					</Button>

					{value.history.length > 0 && (
						<Button size="sm" onClick={() => upsertData({ ...value, history: [] })}>
							Clear past values
						</Button>
					)}
				</ButtonGroup>
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

			{editsPast && <PastValuesDialog value={value} onClose={() => setEditsPast(false)} />}
		</>
	);
};
