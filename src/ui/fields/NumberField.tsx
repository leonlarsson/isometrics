import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { type ReactNode, useId } from "react";

import { Hint } from "./Hint";
import { type IInherit, InheritAction } from "./InheritAction";
import { LabelRow } from "./LabelRow";
import { type INumberRangeProps, NUMBER_FORMAT, NUMBER_LOCALE, NumberBox } from "./NumberBox";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface INumberFieldProps extends INumberRangeProps {
	label: string;
	suffix?: string;
	inherit?: IInherit;
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
	hint,
}: INumberFieldProps) => {
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
			/>

			<div className={styles.numberRow}>
				<NumberBox />

				{suffix && <span className={styles.suffix}>{suffix}</span>}
			</div>

			{hint && <Hint>{hint}</Hint>}
		</BaseNumberField.Root>
	);
};
