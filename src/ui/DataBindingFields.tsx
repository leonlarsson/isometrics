import {
	boundEntry,
	colorOnScale,
	colorScaleOf,
	colorScalePosition,
	cssColor,
	dataNumber,
	readPeriods,
	readScale,
	readSetting,
	settingRangeOf,
	switchesOn,
	type TBindingKind,
} from "#/parts/dataBinding";
import { formatEntry } from "#/scene/format";
import { columnOfKey } from "#/scene/rowData";
import type { TDataBinding, TDataValue } from "#/scene/schema";

import {
	ColorField,
	formatClock,
	NumberField,
	resetToDefault,
	SelectField,
	SwitchField,
} from "./fields";

interface IDataBindingFieldsProps {
	/** How the setting reads its value: switched on and off, a number, or a colour. */
	kind: TBindingKind;
	binding: TDataBinding;
	data: readonly TDataValue[];
	/** The binding changed. `coalesce` names the option being typed, so it's one undo step. */
	onChange: (binding: TDataBinding, coalesce?: string) => void;
	/** Numbers: how a reading shows, e.g. as a percentage. */
	formatScale?: (reading: number) => string;
	/** Numbers: the most a reading goes to. */
	max?: number;
	/** Sizes and amounts (`range`): the setting's own range and step, and how a setting shows. */
	range?: { min: number; max: number; step: number; format?: (setting: number) => string };
}

/** A data value as the hints show it: numbers with their unit, text in quotes, so "null" reads as text. */
const shownValue = (entry: TDataValue) =>
	typeof entry.value === "number"
		? formatEntry(entry)
		: entry.value.trim() === ""
			? "empty"
			: `“${entry.value}”`;

/** How a value is offered in pickers: by name, a column of the thing's row as “Row: …”. */
export const dataChoiceLabel = (item: Pick<TDataValue, "key" | "name">) =>
	columnOfKey(item.key) !== null
		? `Row: ${item.name || columnOfKey(item.key)}`
		: item.name || item.key;

/**
 * The fields of a setting that follows a data value (ADR-0058), for any
 * setting and any kind: which value, the kind's option (on above a threshold,
 * the value at 100%), and a hint saying what the data does right now. Colours
 * also have a colour scale for numbers. Making another setting follow data
 * reuses this as it is (usually through DataDrivenField).
 */
export const DataBindingFields = ({
	kind,
	binding,
	data,
	onChange,
	formatScale = (reading) => String(Math.round(reading * 100) / 100),
	max,
	range = { min: 0, max: 1, step: 0.01 },
}: IDataBindingFieldsProps) => {
	const entry = boundEntry(binding, data);
	const name = entry ? entry.name || entry.key : binding.key;
	const above = binding.switchesOnAbove ?? 0;
	const full = binding.valueAtFull ?? 1;
	const reading = readScale(binding, data, { max });
	const color = entry ? cssColor(entry.value) : null;
	const scale = colorScaleOf(binding);
	const number = dataNumber(entry?.value);
	const periods = readPeriods(binding, data);
	const setting = readSetting(binding, data, range);
	const settings = settingRangeOf(binding, range);
	const showSetting =
		range.format ?? ((value: number) => String(Math.round(value / range.step) * range.step));

	const column = columnOfKey(binding.key);
	const now = !entry
		? column !== null
			? `Its row has no value in ${column} (no data), so it stays as set by hand.`
			: `There's no data value called “${binding.key}” any more.`
		: kind === "switch"
			? `${name} is ${shownValue(entry)}, so it's ${switchesOn(entry.value, above) ? "on" : "off"} now. It's on while the value is a number above ${above}, or the text on, yes or true, day and night.`
			: kind === "periods"
				? periods
					? `${name} is ${shownValue(entry)}, so it's on ${periods.map(({ from, until }) => `${formatClock(from)}–${formatClock(until)}`).join(" and ")}.`
					: `${name} is ${shownValue(entry)}, which isn't times of day like 09:00-17:30, so it keeps the periods set by hand.`
				: kind === "range"
					? setting === undefined
						? `${name} is ${shownValue(entry)}, which isn't a number, so it stays as set by hand.`
						: `${name} is ${shownValue(entry)}, so it's ${showSetting(setting)} now.`
					: kind === "scale"
						? reading === undefined
							? `${name} is ${shownValue(entry)}, which isn't a number, so it stays as set by hand.`
							: `${name} is ${shownValue(entry)}, so it's at ${formatScale(reading)} now${max !== undefined && reading >= max ? ` (${formatScale(max)} is the most)` : ""}.`
						: color
							? `${name} is ${shownValue(entry)}, a colour, so it's ${color} now.`
							: Number.isFinite(number)
								? `${name} is ${shownValue(entry)}, so it's ${colorOnScale(binding, number)} now, ${Math.round(colorScalePosition(binding, number) * 100)}% of the way from the low colour to the high colour.`
								: `${name} is ${shownValue(entry)}, which is neither a colour nor a number, so it keeps its own colour.`;

	return (
		<>
			<SelectField
				label="Data value"
				value={binding.key}
				options={[
					// A value that's gone stays shown until another is picked.
					...(entry
						? []
						: [
								{
									value: binding.key,
									label: column !== null ? `Row: ${column} (no data)` : `${binding.key} (gone)`,
								},
							]),
					...data.map((item) => ({ value: item.key, label: dataChoiceLabel(item) })),
				]}
				onChange={(key) => onChange({ ...binding, key })}
				// Which value it follows: there's no default one.
				hasNoDefault
				hint={
					kind === "color"
						? `A value holding a colour (red, #ff0000, rgb(), hsl()) is used as it is; a number mixes the low and high colours below. ${now}`
						: kind === "periods"
							? `A value holding times of day, like opening hours: "09:00-17:30", or several, "7-9, 16:30-19". ${now}`
							: undefined
				}
			/>

			{kind === "switch" && (
				<NumberField
					label="On above"
					value={above}
					onChange={(value) => onChange({ ...binding, switchesOnAbove: value }, "switchesOnAbove")}
					inherit={{
						from: "default",
						inherited: binding.switchesOnAbove === null,
						onReset: () => onChange({ ...binding, switchesOnAbove: null }),
						value: "0",
					}}
					hint={now}
				/>
			)}

			{kind === "color" && (
				<>
					<NumberField
						label="Low value"
						value={scale.low}
						onChange={(value) =>
							onChange({ ...binding, valueAtLowColor: value }, "valueAtLowColor")
						}
						inherit={{
							from: "default",
							inherited: binding.valueAtLowColor === null,
							onReset: () => onChange({ ...binding, valueAtLowColor: null }),
							value: "0",
						}}
					/>

					<ColorField
						label="Low colour"
						value={scale.lowColor}
						onChange={(value) => onChange({ ...binding, lowColor: value }, "lowColor")}
						inherit={{
							from: "default",
							inherited: binding.lowColor === null,
							onReset: () => onChange({ ...binding, lowColor: null }),
						}}
					/>

					<NumberField
						label="High value"
						value={scale.high}
						onChange={(value) =>
							onChange({ ...binding, valueAtHighColor: value }, "valueAtHighColor")
						}
						inherit={{
							from: "default",
							inherited: binding.valueAtHighColor === null,
							onReset: () => onChange({ ...binding, valueAtHighColor: null }),
							value: "100",
						}}
					/>

					<ColorField
						label="High colour"
						value={scale.highColor}
						onChange={(value) => onChange({ ...binding, highColor: value }, "highColor")}
						inherit={{
							from: "default",
							inherited: binding.highColor === null,
							onReset: () => onChange({ ...binding, highColor: null }),
						}}
					/>
				</>
			)}

			{kind === "range" && (
				<>
					<SwitchField
						label="Log scale"
						checked={binding.usesLogScale}
						onChange={(on) => onChange({ ...binding, usesLogScale: on })}
						inherit={resetToDefault(
							binding.usesLogScale,
							false,
							() => onChange({ ...binding, usesLogScale: false }),
							"straight",
						)}
						hint="On a log scale each tenfold is the same step (10, 100, 1,000…): for numbers far apart, like visitors or populations."
					/>

					<NumberField
						label="Low value"
						value={settings.lowValue}
						onChange={(value) =>
							onChange({ ...binding, valueAtLowSetting: value }, "valueAtLowSetting")
						}
						inherit={{
							from: "default",
							inherited: binding.valueAtLowSetting === null,
							onReset: () => onChange({ ...binding, valueAtLowSetting: null }),
							value: binding.usesLogScale ? "1" : "0",
						}}
					/>

					<NumberField
						label="Smallest"
						value={settings.low}
						min={range.min}
						max={range.max}
						step={range.step}
						onChange={(value) => onChange({ ...binding, lowSetting: value }, "lowSetting")}
						inherit={{
							from: "default",
							inherited: binding.lowSetting === null,
							onReset: () => onChange({ ...binding, lowSetting: null }),
							value: showSetting(range.min),
						}}
						hint="What it is at the low value and below."
					/>

					<NumberField
						label="High value"
						value={settings.highValue}
						onChange={(value) =>
							onChange({ ...binding, valueAtHighSetting: value }, "valueAtHighSetting")
						}
						inherit={{
							from: "default",
							inherited: binding.valueAtHighSetting === null,
							onReset: () => onChange({ ...binding, valueAtHighSetting: null }),
							value: "100",
						}}
					/>

					<NumberField
						label="Largest"
						value={settings.high}
						min={range.min}
						max={range.max}
						step={range.step}
						onChange={(value) => onChange({ ...binding, highSetting: value }, "highSetting")}
						inherit={{
							from: "default",
							inherited: binding.highSetting === null,
							onReset: () => onChange({ ...binding, highSetting: null }),
							value: showSetting(range.max),
						}}
						hint={`What it is at the high value and above; values in between are placed between the two. ${now}`}
					/>
				</>
			)}

			{kind === "scale" && (
				<NumberField
					label="100% at"
					value={full}
					min={0.001}
					onChange={(value) => onChange({ ...binding, valueAtFull: value }, "valueAtFull")}
					inherit={{
						from: "default",
						inherited: binding.valueAtFull === null,
						onReset: () => onChange({ ...binding, valueAtFull: null }),
						value: "1",
					}}
					hint={`The value that gives 100%; twice it gives 200%. ${now}`}
				/>
			)}
		</>
	);
};
