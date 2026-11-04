import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { Fragment, type ReactNode, useId } from "react";

import { Hint } from "./Hint";
import { InheritAction, type TResettable } from "./InheritAction";
import { LabelRow } from "./LabelRow";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface IRadioOption<TValue extends string> {
	value: TValue;
	label: string;
	/** A short muted note after the label on the same line (cut off when it doesn't fit), e.g. a size. */
	meta?: string;
	/**
	 * A sentence or two under the label, in muted text that wraps, never cut off, like a menu
	 * item's: for what choosing it does.
	 */
	description?: string;
	/** Shown under the option, in line with its text, while it's chosen: a setting only it has. */
	details?: ReactNode;
}

interface IRadioGroupFieldProps<TValue extends string> {
	label: string;
	options: IRadioOption<TValue>[];
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
					<Fragment key={option.value}>
						{/* biome-ignore lint/a11y/noLabelWithoutControl: the radio inside is the labelled control */}
						<label className={styles.check} data-described={option.description ? "" : undefined}>
							<Radio.Root value={option.value} className={styles.radio}>
								<Radio.Indicator className={styles.radioIndicator} />
							</Radio.Root>

							{option.description ? (
								<span className={styles.radioText}>
									<span className={styles.radioLabel}>{option.label}</span>

									<span className={styles.radioDescription}>{option.description}</span>
								</span>
							) : (
								<>
									<span className={styles.radioLabel}>{option.label}</span>

									{option.meta && <span className={styles.radioMeta}>{option.meta}</span>}
								</>
							)}
						</label>

						{/* Outside the label: clicking a control in it mustn't pick the option again. */}
						{option.details && value === option.value && (
							<div className={styles.radioDetails}>{option.details}</div>
						)}
					</Fragment>
				))}
			</RadioGroup>

			{hint && <Hint>{hint}</Hint>}
		</div>
	);
};
