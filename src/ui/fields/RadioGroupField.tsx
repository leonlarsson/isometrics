import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { type ReactNode, useId } from "react";

import { Hint } from "./Hint";
import { InheritAction, type TResettable } from "./InheritAction";
import { LabelRow } from "./LabelRow";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface IRadioGroupFieldProps<TValue extends string> {
	label: string;
	/** `meta` is a muted note after the option's label, e.g. what it means. */
	options: { value: TValue; label: string; meta?: string }[];
	value: TValue;
	onChange: (value: TValue) => void;
	hint?: ReactNode;
}

/** A labelled list of radio buttons that picks one value, each option visible at once. */
export const RadioGroupField = <TValue extends string>({
	label,
	options,
	value,
	onChange,
	hint,
	inherit,
}: IRadioGroupFieldProps<TValue> & TResettable) => {
	const id = useId();
	return (
		<div className={styles.field} data-search-match={useSearchMatch(label)}>
			<LabelRow label={label} id={id} action={inherit && <InheritAction inherit={inherit} />} />

			<RadioGroup
				aria-labelledby={id}
				className={styles.checklist}
				value={value}
				onValueChange={(next) => onChange(next as TValue)}
			>
				{options.map((option) => (
					// biome-ignore lint/a11y/noLabelWithoutControl: the radio inside is the labelled control
					<label key={option.value} className={styles.check}>
						<Radio.Root value={option.value} className={styles.radio}>
							<Radio.Indicator className={styles.radioIndicator} />
						</Radio.Root>

						<span className={styles.radioLabel}>{option.label}</span>

						{option.meta && <span className={styles.radioMeta}>{option.meta}</span>}
					</label>
				))}
			</RadioGroup>

			{hint && <Hint>{hint}</Hint>}
		</div>
	);
};
