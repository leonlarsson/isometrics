import { boundEntry, settingRangeOf } from "#/parts/dataBinding";
import { formatEntry, formatValue } from "#/scene/format";
import type { TDataBinding, TDataValue } from "#/scene/schema";

import { Button } from "./Button";
import { dataChoiceLabel } from "./DataBindingFields";
import { FieldGroup, Hint } from "./fields";

/** How a size binding reads, in words: "Row: Steam players now, log scale: 1,000 → 100,000 gives 6% to 100%". */
export const rangeBindingWords = (
	binding: TDataBinding,
	data: readonly TDataValue[],
	range: { min: number; max: number },
	showSetting: (value: number) => string,
) => {
	const entry = boundEntry(binding, data);
	const name = entry ? dataChoiceLabel(entry) : binding.key;
	const { lowValue, highValue, low, high } = settingRangeOf(binding, range);
	return `${name}${binding.usesLogScale ? ", log scale" : ""}: ${formatValue(lowValue)} → ${formatValue(highValue)} gives ${showSetting(low)} to ${showSetting(high)}`;
};

/**
 * A setting that follows data, shown where it's otherwise set by hand (ADR-0109): its name,
 * **From data**, which value and how, what it is now, and a way to where it's set (the object's
 * Data tab). It stands in for the hand field, so nobody sets by hand what data overrides.
 */
export const FollowsDataField = ({
	label,
	binding,
	data,
	range,
	shownNow,
	showSetting,
	onOpenData,
}: {
	label: string;
	binding: TDataBinding;
	data: readonly TDataValue[];
	range: { min: number; max: number };
	/** What it is now, as data sets it. */
	shownNow: string;
	showSetting: (value: number) => string;
	/** Go to where it's set; none where there's nowhere to go (the parts catalogue). */
	onOpenData?: () => void;
}) => {
	const entry = boundEntry(binding, data);
	return (
		<FieldGroup title={`${label}: From data`}>
			<Hint>
				{`${shownNow} now, from ${entry ? formatEntry(entry) : "no data"}. ${rangeBindingWords(binding, data, range, showSetting)}.`}
			</Hint>

			{onOpenData && (
				<Button size="sm" icon="chart" onClick={onOpenData}>
					Change it in the Data tab
				</Button>
			)}
		</FieldGroup>
	);
};
