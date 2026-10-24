import {
	boundEntry,
	cssColor,
	readScale,
	switchesOn,
	type TBindingKind,
} from "#/parts/dataBinding";
import { formatEntry } from "#/scene/format";
import type { TDataBinding, TDataEntry } from "#/scene/schema";

import { NumberField, SelectField } from "./fields";

interface IDataBindingFieldsProps {
	/** How the setting reads its value: switched on and off, a number, or a colour. */
	kind: TBindingKind;
	binding: TDataBinding;
	data: readonly TDataEntry[];
	/** The binding changed. `coalesce` names the option being typed, so it's one undo step. */
	onChange: (binding: TDataBinding, coalesce?: string) => void;
	/** Numbers: how a reading shows, e.g. as a percentage. */
	formatScale?: (reading: number) => string;
	/** Numbers: the most a reading goes to. */
	max?: number;
}

/** A data value as the hints show it: numbers with their unit, text in quotes, so "null" reads as text. */
const shownValue = (entry: TDataEntry) =>
	typeof entry.value === "number"
		? formatEntry(entry)
		: entry.value.trim() === ""
			? "empty"
			: `“${entry.value}”`;

/**
 * The fields of a setting that follows a data value (ADR-0058), for any
 * setting and any kind: which value, the kind's option (on above a threshold,
 * the value at 100%), and a hint saying what the data does right now. Making
 * another setting follow data reuses this as it is.
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
	const name = entry ? entry.label || entry.key : binding.key;
	const above = binding.above ?? 0;
	const full = binding.full ?? 1;
	const reading = readScale(binding, data, { max });
	const color = entry ? cssColor(entry.value) : null;

	const now = !entry
		? `There's no data value called “${binding.key}” any more.`
		: kind === "switch"
			? `${name} is ${shownValue(entry)}, so it's ${switchesOn(entry.value, above) ? "on" : "off"} now. It's on while the value is a number above ${above}, or the text on, yes or true, day and night.`
			: kind === "scale"
				? reading === undefined
					? `${name} is ${shownValue(entry)}, which isn't a number, so it stays as set by hand.`
					: `${name} is ${shownValue(entry)}, so it's at ${formatScale(reading)} now${max !== undefined && reading >= max ? ` (${formatScale(max)} is the most)` : ""}.`
				: color
					? `${name} is ${shownValue(entry)}, so it's ${color} now.`
					: `${name} is ${shownValue(entry)}, which isn't a colour, so it keeps its own. Any CSS colour works: red, #ff0000, rgb(255, 0, 0), hsl(0, 100%, 50%).`;

	return (
		<>
			<SelectField
				label="Data value"
				value={binding.key}
				options={[
					// A value that's gone stays shown until another is picked.
					...(entry ? [] : [{ value: binding.key, label: `${binding.key} (gone)` }]),
					...data.map((item) => ({ value: item.key, label: item.label || item.key })),
				]}
				onChange={(key) => onChange({ ...binding, key })}
				hint={kind === "color" ? now : undefined}
			/>

			{kind === "switch" && (
				<NumberField
					label="On above"
					value={above}
					onChange={(value) => onChange({ ...binding, above: value }, "above")}
					inherit={{
						from: "default",
						inherited: binding.above === null,
						onReset: () => onChange({ ...binding, above: null }),
						value: "0",
					}}
					hint={now}
				/>
			)}

			{kind === "scale" && (
				<NumberField
					label="100% at"
					value={full}
					min={0.001}
					onChange={(value) => onChange({ ...binding, full: value }, "full")}
					inherit={{
						from: "default",
						inherited: binding.full === null,
						onReset: () => onChange({ ...binding, full: null }),
						value: "1",
					}}
					hint={`The value that gives 100%; twice it gives 200%. ${now}`}
				/>
			)}
		</>
	);
};
