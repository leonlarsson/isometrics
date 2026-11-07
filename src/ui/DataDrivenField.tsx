import { isValidElement, type ReactNode } from "react";

import { useUsesData } from "#/editor/worldData";
import type { TBindingKind } from "#/parts/dataBinding";
import { DataBindingSchema, type TDataBinding, type TDataValue } from "#/scene/schema";

import { DataBindingFields } from "./DataBindingFields";
import { Hint, resetToDefault, SelectField } from "./fields";

interface IDataDrivenFieldProps {
	/** How the setting reads a data value: switched on and off, a number, or a colour. */
	kind: TBindingKind;
	/** Its binding while it follows data. */
	binding: TDataBinding | undefined;
	data: readonly TDataValue[];
	/**
	 * Start following data (a binding), stop (null) or change the binding.
	 * `coalesce` names the option being typed, so it's one undo step.
	 */
	onBindingChange: (binding: TDataBinding | null, coalesce?: string) => void;
	/** Numbers: how a reading shows, e.g. as a percentage. */
	formatScale?: (reading: number) => string;
	/** Numbers: the most a reading goes to. */
	max?: number;
	/** Sizes and amounts (`range`): the setting's own range and step. */
	range?: { min: number; max: number; step: number; format?: (setting: number) => string };
	/** The field that sets it by hand. */
	children: ReactNode;
	/** Several things are selected and follow data differently (ADR-0064): Source says Mixed. */
	mixed?: boolean;
	/**
	 * Sizes and amounts: a value's lowest and highest number, for the range a binding starts with
	 * (ADR-0123); a row's column over the whole table. Without it, from the value's own past.
	 */
	dataRangeOf?: (key: string) => { min: number; max: number } | null;
	/** Sizes and amounts: what the setting starts at, low and high (else its own smallest and largest). */
	startsAt?: { low: number; high: number };
}

/** A value's lowest and highest number, over its past and now (the fallback of `dataRangeOf`). */
const ownRangeOf = (entry: TDataValue | undefined) => {
	const numbers = entry
		? [...entry.history.map((point) => point.value), entry.value].filter(
				(each): each is number => typeof each === "number",
			)
		: [];
	if (numbers.length === 0) {
		return null;
	}
	const min = Math.min(...numbers);
	const max = Math.max(...numbers);
	return min < max ? { min, max } : max > 0 ? { min: 0, max } : null;
};

type TSource = "hand" | "data";

/** A sentence after a colon: its first letter small, unless it starts a name or a short form ("How" → "how", "SI" stays). */
const afterColon = (text: string) =>
	/^[A-Z][a-z]/.test(text) ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;

/**
 * The setting's own name and what it does, from the field that sets it by hand
 * (its `label` and `hint`), so they still show while it follows data.
 */
const settingOf = (field: ReactNode) => {
	if (!isValidElement<{ label?: unknown; hint?: unknown }>(field)) {
		return {};
	}
	const { label, hint } = field.props;
	return {
		name: typeof label === "string" && label !== "" ? label : undefined,
		hint: typeof hint === "string" && hint !== "" ? hint : undefined,
	};
};

/**
 * A setting that can be set by hand or follow a data value (ADR-0058,
 * ADR-0060): a Source select (By hand / From data), then the hand field or the
 * shared DataBindingFields. Without data values From data is greyed out
 * ("no values yet"); a FollowDataNote at the top of the tab says why. Use it
 * for any setting that can follow data.
 */
export const DataDrivenField = ({
	kind,
	binding,
	data,
	onBindingChange,
	formatScale,
	max,
	range,
	children,
	mixed,
	dataRangeOf,
	startsAt,
}: IDataDrivenFieldProps) => {
	const hasData = data.length > 0;
	const setting = settingOf(children);
	/**
	 * A size or amount following `key` starts from the data's lowest to its highest, so it moves
	 * at once (a fixed 0 to 100 left numbers like 1,410 always at the top); others are as they are.
	 */
	const withRange = (next: TDataBinding): TDataBinding => {
		if (kind !== "range") {
			return next;
		}
		const found =
			dataRangeOf?.(next.key) ?? ownRangeOf(data.find((entry) => entry.key === next.key));
		return found ? { ...next, valueAtLowSetting: found.min, valueAtHighSetting: found.max } : next;
	};
	// From data starts on a value it can use: a number, for sizes and amounts.
	const firstKey =
		(kind === "range" ? data.find((entry) => typeof entry.value === "number") : undefined)?.key ??
		data[0]?.key ??
		"";
	// With data off (ADR-0115), set by hand only: no Source, no From data.
	if (!useUsesData()) {
		return <>{children}</>;
	}
	return (
		<>
			<SelectField<TSource>
				label="Source"
				value={binding ? "data" : "hand"}
				mixed={mixed}
				options={[
					{ value: "hand", label: "By hand" },
					{
						value: "data",
						label: hasData ? "From data" : "From data (no values yet)",
						disabled: !hasData,
					},
				]}
				onChange={(source) =>
					onBindingChange(
						source === "data"
							? withRange(
									DataBindingSchema.parse({
										key: firstKey,
										lowSetting: startsAt?.low ?? null,
										highSetting: startsAt?.high ?? null,
									}),
								)
							: null,
					)
				}
				inherit={resetToDefault(
					binding ? "data" : "hand",
					"hand",
					() => onBindingChange(null),
					"by hand",
				)}
			/>

			{binding ? (
				<DataBindingFields
					kind={kind}
					binding={binding}
					data={data}
					// Another value picked: its range comes with it.
					onChange={(next, coalesce) =>
						onBindingChange(next.key !== binding.key ? withRange(next) : next, coalesce)
					}
					formatScale={formatScale}
					max={max}
					range={range}
					settingName={setting.name}
				/>
			) : (
				children
			)}

			{/* What the data sets, as the field set by hand says it: which lever, not only how far. */}
			{binding && setting.name && setting.hint && (
				<Hint>{`${setting.name}: ${afterColon(setting.hint)}`}</Hint>
			)}
		</>
	);
};
