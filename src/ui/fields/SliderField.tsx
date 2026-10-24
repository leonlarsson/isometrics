import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { Slider } from "@base-ui/react/slider";
import { type ReactNode, useId } from "react";

import { Hint } from "./Hint";
import { type IInherit, InheritAction } from "./InheritAction";
import { LabelRow } from "./LabelRow";
import { type INumberRangeProps, NUMBER_FORMAT, NUMBER_LOCALE, NumberBox } from "./NumberBox";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface ISliderFieldProps extends INumberRangeProps {
	label: string;
	min: number;
	max: number;
	step: number;
	suffix?: string;
	inherit?: IInherit;
	hint?: ReactNode;
}

/** A slider with a number box; drag the label to scrub, or type an exact value. */
export const SliderField = ({
	label,
	value,
	onChange,
	min,
	max,
	step,
	suffix,
	inherit,
	hint,
}: ISliderFieldProps) => {
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

			<div className={styles.sliderRow}>
				<Slider.Root
					className={styles.slider}
					// The thumb stops at the track's ends instead of overhanging them by half its width.
					thumbAlignment="edge"
					value={value}
					min={min}
					max={max}
					step={step}
					onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
				>
					<Slider.Control className={styles.sliderControl}>
						<Slider.Track className={styles.sliderTrack}>
							<Slider.Indicator className={styles.sliderIndicator} />

							<Slider.Thumb className={styles.sliderThumb} aria-label={label} />
						</Slider.Track>
					</Slider.Control>
				</Slider.Root>

				{/* The unit sits inside the box, so every row's box ends at the panel's edge. */}
				<span className={styles.sliderNumber} data-unit={suffix ? "" : undefined}>
					<NumberBox />

					{suffix && <span className={styles.unit}>{suffix}</span>}
				</span>
			</div>

			{hint && <Hint>{hint}</Hint>}
		</BaseNumberField.Root>
	);
};
