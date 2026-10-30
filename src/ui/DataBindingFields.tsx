import {
	boundEntry,
	colorOnScale,
	colorScaleOf,
	colorScalePosition,
	cssColor,
	dataNumber,
	readPeriods,
	readScale,
	switchesOn,
	type TBindingKind,
} from "#/parts/dataBinding";
import { formatEntry } from "#/scene/format";
import type { TDataBinding, TDataValue } from "#/scene/schema";

import { ColorField, formatClock, NumberField, SelectField } from "./fields";

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
}

/** A data value as the hints show it: numbers with their unit, text in quotes, so "null" reads as text. */
const shownValue = (entry: TDataValue) =>
	typeof entry.value === "number"
		? formatEntry(entry)
		: entry.value.trim() === ""
			? "empty"
			: `“${entry.value}”`;

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

	const now = !entry
		? `There's no data value called “${binding.key}” any more.`
		: kind === "switch"
			? `${name} is ${shownValue(entry)}, so it's ${switchesOn(entry.value, above) ? "on" : "off"} now. It's on while the value is a number above ${above}, or the text on, yes or true, day and night.`
			: kind === "periods"
				? periods
					? `${name} is ${shownValue(entry)}, so it's on ${periods.map(({ from, until }) => `${formatClock(from)}–${formatClock(until)}`).join(" and ")}.`
					: `${name} is ${shownValue(entry)}, which isn't times of day like 09:00-17:30, so it keeps the periods set by hand.`
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
					...(entry ? [] : [{ value: binding.key, label: `${binding.key} (gone)` }]),
					...data.map((item) => ({ value: item.key, label: item.name || item.key })),
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
