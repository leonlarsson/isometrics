import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { Slider } from "@base-ui/react/slider";
import { type CSSProperties, type ReactNode, useId } from "react";

import { ClockInput } from "./ClockInput";
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
	/** The value is a time of day in hours (0–24): the box shows and takes it as "19:30". */
	clock?: boolean;
	/**
	 * The slider's own range, when it's narrower than what the box takes (`min`–`max`): the
	 * slider covers the usual values, and any other can still be typed or scrubbed.
	 */
	sliderMin?: number;
	sliderMax?: number;
	inherit?: IInherit;
	/** The value differs between the selected things (ADR-0064). */
	mixed?: boolean;
	/** Shown greyed out and can't be changed; say why in its hint. */
	disabled?: boolean;
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
	clock,
	sliderMin = min,
	sliderMax = max,
	inherit,
	mixed,
	disabled = false,
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
			disabled={disabled}
			onValueChange={(next) => next !== null && onChange(next)}
		>
			<LabelRow
				label={label}
				htmlFor={id}
				scrub
				action={inherit && <InheritAction inherit={inherit} />}
				mixed={mixed}
			/>

			<div
				className={styles.sliderRow}
				data-disabled={disabled || undefined}
				// Room for the unit, however many characters it has ("°", "mm", "°/s").
				style={suffix ? ({ "--unit-chars": suffix.length } as CSSProperties) : undefined}
			>
				<Slider.Root
					className={styles.slider}
					// The thumb stops at the track's ends instead of overhanging them by half its width.
					thumbAlignment="edge"
					disabled={disabled}
					value={Math.min(Math.max(value, sliderMin), sliderMax)}
					min={sliderMin}
					max={sliderMax}
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
					{clock ? (
						<ClockInput hours={value} onChange={onChange} ariaLabel={label} />
					) : (
						<NumberBox />
					)}

					{suffix && <span className={styles.unit}>{suffix}</span>}
				</span>
			</div>

			{hint && <Hint>{hint}</Hint>}
		</BaseNumberField.Root>
	);
};
