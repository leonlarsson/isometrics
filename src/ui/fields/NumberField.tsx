import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { type ReactNode, useId } from "react";

import { Hint } from "./Hint";
import { InheritAction, type TResettable } from "./InheritAction";
import { LabelRow } from "./LabelRow";
import { type INumberRangeProps, NUMBER_FORMAT, NUMBER_LOCALE, NumberBox } from "./NumberBox";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface INumberFieldProps extends INumberRangeProps {
	label: string;
	suffix?: string;
	/** The value differs between the selected things (ADR-0064). */
	mixed?: boolean;
	hint?: ReactNode;
}

/** A number with a scrubbable label. */
export const NumberField = ({
	label,
	value,
	onChange,
	min,
	max,
	step = 0.1,
	suffix,
	inherit,
	mixed,
	hint,
}: INumberFieldProps & TResettable) => {
	const id = useId();
	return (
		<BaseNumberField.Root
			id={id}
			className={styles.field}
			data-search-match={useSearchMatch(label)}
			value={value}
			min={min}
			max={max}
			step={step}
			format={NUMBER_FORMAT}
			locale={NUMBER_LOCALE}
			onValueChange={(next) => next !== null && onChange(next)}
		>
			<LabelRow
				label={label}
				htmlFor={id}
				scrub
				action={inherit && <InheritAction inherit={inherit} />}
				mixed={mixed}
			/>

			<div className={styles.numberRow}>
				<NumberBox />

				{suffix && <span className={styles.suffix}>{suffix}</span>}
			</div>

			{hint && <Hint>{hint}</Hint>}
		</BaseNumberField.Root>
	);
};
