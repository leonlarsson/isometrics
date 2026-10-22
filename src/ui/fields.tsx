import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { Input as BaseInput } from "@base-ui/react/input";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";
import { Slider } from "@base-ui/react/slider";
import { Switch } from "@base-ui/react/switch";
import { type ReactNode, useId } from "react";

import { SWATCHES } from "#/scene/theme";

import { Icon } from "./Icon";

import styles from "./Fields.module.css";

/*
 * The shared building blocks for every panel (ADR-0025). Each field has the
 * same anatomy: a label row (label on the left, an optional action such as
 * "Default" on the right), then the control, then an optional hint. Number
 * labels can be dragged left and right to scrub the value.
 *
 * Controls are Base UI components (ADR-0024) styled with our tokens.
 */

/** Numbers show up to three decimals, with a dot and no thousands separators. */
const NUMBER_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 3, useGrouping: false };
const NUMBER_LOCALE = "en-US";

// ---------------------------------------------------------------- layout

interface ISectionProps {
	title: string;
	children: ReactNode;
	/** Controls on the right of the title, e.g. an IconButtonGroup or a switch. */
	actions?: ReactNode;
}

/** A titled block in a panel. Panels are a stack of sections. */
export const Section = ({ title, children, actions }: ISectionProps) => {
	return (
		<section className={styles.section}>
			<header className={styles.sectionHeader}>
				<h3>{title}</h3>

				{actions}
			</header>

			<div className={styles.sectionBody}>{children}</div>
		</section>
	);
};

/** Muted helper text under a field or at the end of a section. */
export const Hint = ({ children }: { children: ReactNode }) => {
	return <p className={styles.hint}>{children}</p>;
};

interface IGroupLabelProps {
	children: ReactNode;
	id?: string;
	/** Render as a heading (e.g. palette categories) instead of plain text. */
	as?: "span" | "h3";
}

/** A small uppercase heading for a group inside a panel (palette categories, "Join with"). */
export const GroupLabel = ({ children, id, as: Tag = "span" }: IGroupLabelProps) => {
	return (
		<Tag id={id} className={styles.groupLabel}>
			{children}
		</Tag>
	);
};

/** A keyboard key, e.g. <Kbd>Enter</Kbd>. */
export const Kbd = ({ children }: { children: ReactNode }) => {
	return <kbd className={styles.kbd}>{children}</kbd>;
};

/** The "Default" link on a field's label row; only shown while the value isn't the default. */
const ResetAction = ({ onReset }: { onReset: () => void }) => {
	return (
		<button type="button" className={styles.reset} onClick={onReset}>
			<Icon name="reset" size={13} /> Default
		</button>
	);
};

interface ILabelRowProps {
	label: string;
	htmlFor?: string;
	id?: string;
	action?: ReactNode;
	/** Drag the label to change the value. Only inside a number field's root. */
	scrub?: boolean;
}

const LabelRow = ({ label, htmlFor, id, action, scrub }: ILabelRowProps) => {
	const text = (
		<label htmlFor={htmlFor} id={id} className={styles.label}>
			{label}
		</label>
	);
	return (
		<div className={styles.labelRow}>
			{scrub ? (
				<BaseNumberField.ScrubArea className={styles.scrub}>
					{text}

					<BaseNumberField.ScrubAreaCursor className={styles.scrubCursor}>
						<Icon name="scrub" size={18} />
					</BaseNumberField.ScrubAreaCursor>
				</BaseNumberField.ScrubArea>
			) : (
				text
			)}

			{action}
		</div>
	);
};

interface IFieldProps {
	label: string;
	children: (id: string) => ReactNode;
	/** A small control on the label's row, right-aligned (e.g. a reset link). */
	action?: ReactNode;
	hint?: ReactNode;
}

/** The field anatomy for custom controls: label row, the control (given the label's id), hint. */
export const Field = ({ label, children, action, hint }: IFieldProps) => {
	const id = useId();
	return (
		<div className={styles.field}>
			<LabelRow label={label} htmlFor={id} action={action} />

			{children(id)}

			{hint && <Hint>{hint}</Hint>}
		</div>
	);
};

// ------------------------------------------------------------------ text

interface IInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	/** Accessible name when there's no visible label. */
	ariaLabel?: string;
	id?: string;
	onBlur?: () => void;
}

/** A bare text input, for rows that lay out their own labels. Prefer TextField. */
export const Input = ({ value, onChange, placeholder, ariaLabel, id, onBlur }: IInputProps) => {
	return (
		<BaseInput
			id={id}
			className={styles.input}
			aria-label={ariaLabel}
			value={value}
			placeholder={placeholder}
			onValueChange={(next) => onChange(next)}
			onBlur={onBlur}
		/>
	);
};

interface ITextFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	multiline?: boolean;
	hint?: ReactNode;
}

export const TextField = ({
	label,
	value,
	onChange,
	placeholder,
	multiline = false,
	hint,
}: ITextFieldProps) => {
	return (
		<Field label={label} hint={hint}>
			{(id) =>
				multiline ? (
					<textarea
						id={id}
						className={styles.input}
						rows={3}
						value={value}
						placeholder={placeholder}
						onChange={(e) => onChange(e.target.value)}
					/>
				) : (
					<Input id={id} value={value} placeholder={placeholder} onChange={onChange} />
				)
			}
		</Field>
	);
};

// --------------------------------------------------------------- numbers

interface INumberRangeProps {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
}

/** The number box itself. Must sit inside a BaseNumberField.Root. */
const NumberBox = ({ ariaLabel }: { ariaLabel?: string }) => {
	return (
		<BaseNumberField.Group className={styles.numberGroup}>
			<BaseNumberField.Input className={styles.number} aria-label={ariaLabel} />
		</BaseNumberField.Group>
	);
};

interface INumberFieldProps extends INumberRangeProps {
	label: string;
	suffix?: string;
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
	hint,
}: INumberFieldProps) => {
	const id = useId();
	return (
		<BaseNumberField.Root
			id={id}
			className={styles.field}
			value={value}
			min={min}
			max={max}
			step={step}
			format={NUMBER_FORMAT}
			locale={NUMBER_LOCALE}
			onValueChange={(next) => next !== null && onChange(next)}
		>
			<LabelRow label={label} htmlFor={id} scrub />

			<div className={styles.numberRow}>
				<NumberBox />

				{suffix && <span className={styles.suffix}>{suffix}</span>}
			</div>

			{hint && <Hint>{hint}</Hint>}
		</BaseNumberField.Root>
	);
};

interface ISliderFieldProps extends INumberRangeProps {
	label: string;
	min: number;
	max: number;
	step: number;
	suffix?: string;
	/** With `onReset`: whether the value is the default, which hides the reset link. */
	isDefault?: boolean;
	onReset?: () => void;
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
	isDefault = true,
	onReset,
	hint,
}: ISliderFieldProps) => {
	const id = useId();
	return (
		<BaseNumberField.Root
			id={id}
			className={styles.field}
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
				action={onReset && !isDefault && <ResetAction onReset={onReset} />}
			/>

			<div className={styles.sliderRow}>
				<Slider.Root
					className={styles.slider}
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

				<NumberBox />

				{/* Always present, so number boxes line up whether or not a row has a unit. */}
				<span className={styles.suffix}>{suffix}</span>
			</div>

			{hint && <Hint>{hint}</Hint>}
		</BaseNumberField.Root>
	);
};

interface IAxisProps {
	label: string;
	axis: string;
	value: number;
	step: number;
	id?: string;
	onChange: (value: number) => void;
}

/** One component of a vector: the axis letter scrubs, the box takes typed values. */
const Axis = ({ label, axis, value, step, id, onChange }: IAxisProps) => {
	return (
		<BaseNumberField.Root
			id={id}
			className={styles.axis}
			value={value}
			step={step}
			format={NUMBER_FORMAT}
			locale={NUMBER_LOCALE}
			onValueChange={(next) => next !== null && onChange(next)}
		>
			<BaseNumberField.ScrubArea className={styles.axisName}>
				<span aria-hidden="true">{axis}</span>

				<BaseNumberField.ScrubAreaCursor className={styles.scrubCursor}>
					<Icon name="scrub" size={18} />
				</BaseNumberField.ScrubAreaCursor>
			</BaseNumberField.ScrubArea>

			<NumberBox ariaLabel={`${label} ${axis}`} />
		</BaseNumberField.Root>
	);
};

interface IVectorFieldProps {
	label: string;
	axes: string[];
	values: number[];
	onChange: (index: number, value: number) => void;
	step?: number;
}

/** Two or three numbers on one row (X / Y / Z); each axis letter scrubs its value. */
export const VectorField = ({ label, axes, values, onChange, step = 0.5 }: IVectorFieldProps) => {
	return (
		<Field label={label}>
			{(id) => (
				<div className={styles.vector}>
					{axes.map((axis, i) => (
						<Axis
							key={axis}
							id={i === 0 ? id : undefined}
							label={label}
							axis={axis}
							value={values[i]}
							step={step}
							onChange={(v) => onChange(i, v)}
						/>
					))}
				</div>
			)}
		</Field>
	);
};

// --------------------------------------------------------------- choices

interface ISelectFieldProps<TValue extends string> {
	label: string;
	value: TValue;
	options: { value: TValue; label: string }[];
	onChange: (value: TValue) => void;
}

/** A dropdown of options, styled like the menus. */
export const SelectField = <TValue extends string>({
	label,
	value,
	options,
	onChange,
}: ISelectFieldProps<TValue>) => {
	return (
		<Field label={label}>
			{(id) => (
				<Select.Root
					items={options}
					value={value}
					onValueChange={(next) => next !== null && onChange(next as TValue)}
				>
					<Select.Trigger id={id} className={styles.selectTrigger}>
						<Select.Value className={styles.selectValue} />

						<Select.Icon className={styles.selectIcon}>
							<Icon name="chevronDown" size={14} />
						</Select.Icon>
					</Select.Trigger>

					<Select.Portal>
						<Select.Positioner
							className={styles.selectPositioner}
							sideOffset={4}
							alignItemWithTrigger={false}
						>
							<Select.Popup className={styles.selectPopup}>
								<Select.List>
									{options.map((option) => (
										<Select.Item
											key={option.value}
											value={option.value}
											className={styles.selectItem}
										>
											<Select.ItemIndicator className={styles.selectCheck}>
												<Icon name="check" size={14} />
											</Select.ItemIndicator>

											<Select.ItemText>{option.label}</Select.ItemText>
										</Select.Item>
									))}
								</Select.List>
							</Select.Popup>
						</Select.Positioner>
					</Select.Portal>
				</Select.Root>
			)}
		</Field>
	);
};

interface ISwitchFieldProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}

/** An on/off switch with its label on the right. Fits in a section's header too. */
export const SwitchField = ({ label, checked, onChange }: ISwitchFieldProps) => {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: the switch inside is the labelled control
		<label className={styles.switchField}>
			<Switch.Root className={styles.switch} checked={checked} onCheckedChange={onChange}>
				<Switch.Thumb className={styles.switchThumb} />
			</Switch.Root>

			<span>{label}</span>
		</label>
	);
};

interface ICheckboxGroupFieldProps {
	label: string;
	options: { value: string; label: string }[];
	value: string[];
	onChange: (value: string[]) => void;
}

/** A labelled list of checkboxes that picks several values. */
export const CheckboxGroupField = ({
	label,
	options,
	value,
	onChange,
}: ICheckboxGroupFieldProps) => {
	const id = useId();
	return (
		<div className={styles.field}>
			<LabelRow label={label} id={id} />

			<CheckboxGroup
				aria-labelledby={id}
				className={styles.checklist}
				value={value}
				onValueChange={onChange}
			>
				{options.map((option) => (
					// biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the labelled control
					<label key={option.value} className={styles.check}>
						<Checkbox.Root value={option.value} className={styles.checkbox}>
							<Checkbox.Indicator className={styles.checkboxIndicator}>
								<Icon name="check" size={12} />
							</Checkbox.Indicator>
						</Checkbox.Root>

						<span>{option.label}</span>
					</label>
				))}
			</CheckboxGroup>
		</div>
	);
};

// ---------------------------------------------------------------- colour

interface IColorFieldProps {
	label: string;
	value: string;
	isDefault: boolean;
	onChange: (value: string) => void;
	onReset?: () => void;
}

/** Colour picker with friendly preset swatches and an optional reset to default. */
export const ColorField = ({ label, value, isDefault, onChange, onReset }: IColorFieldProps) => {
	return (
		<Field label={label} action={onReset && !isDefault && <ResetAction onReset={onReset} />}>
			{(id) => (
				<div className={styles.color}>
					<div className={styles.swatches}>
						{SWATCHES.map((swatch) => (
							<button
								key={swatch}
								type="button"
								className={styles.swatch}
								style={{ background: swatch }}
								aria-label={`Use ${swatch}`}
								data-active={swatch.toLowerCase() === value.toLowerCase() || undefined}
								onClick={() => onChange(swatch)}
							/>
						))}
					</div>

					<div className={styles.colorRow}>
						<input
							id={id}
							type="color"
							className={styles.colorInput}
							value={value}
							onChange={(e) => onChange(e.target.value)}
						/>

						<code className={styles.hex}>{value}</code>
					</div>
				</div>
			)}
		</Field>
	);
};
