import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { Input as BaseInput } from "@base-ui/react/input";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { Select } from "@base-ui/react/select";
import { Slider } from "@base-ui/react/slider";
import { Switch } from "@base-ui/react/switch";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { type ReactNode, type RefObject, useId, useRef } from "react";

import { SWATCHES } from "#/scene/theme";

import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

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

/**
 * A value that comes from somewhere else (a default, the scene, the road…)
 * unless this field overrides it (ADR-0027). The field always shows the value
 * in effect; its label row says where an inherited value comes from, or offers
 * Reset once the value is overridden. Changing the control is the override.
 */
export interface IInherit {
	/** Where the value comes from when not overridden: "default", "scene", "road"… */
	from: string;
	/** True while the field shows the inherited value (nothing overridden). */
	inherited: boolean;
	/** Drop the override and go back to the inherited value. */
	onReset: () => void;
	/** The inherited value in words, for Reset's tooltip, e.g. "smoothly" or "2.4". */
	value?: string;
}

/** The label row's right side: "Default" / "From scene" while inherited, Reset once overridden. */
const InheritAction = ({ inherit }: { inherit: IInherit }) => {
	const { from, inherited, onReset, value } = inherit;
	if (inherited) {
		return (
			<span className={styles.inheritTag}>{from === "default" ? "Default" : `From ${from}`}</span>
		);
	}
	const target = from === "default" ? "the default" : `the ${from}’s setting`;
	return (
		<Tooltip label={`Back to ${target}${value ? ` (${value})` : ""}`}>
			<button type="button" className={styles.reset} onClick={onReset}>
				<Icon name="reset" size={13} /> Reset
			</button>
		</Tooltip>
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
	/** A small control on the label's row, right-aligned. */
	action?: ReactNode;
	/** The value is inherited unless overridden (shows Default / From… or Reset). */
	inherit?: IInherit;
	hint?: ReactNode;
}

/** The field anatomy for custom controls: label row, the control (given the label's id), hint. */
export const Field = ({ label, children, action, inherit, hint }: IFieldProps) => {
	const id = useId();
	return (
		<div className={styles.field}>
			<LabelRow
				label={label}
				htmlFor={id}
				action={inherit ? <InheritAction inherit={inherit} /> : action}
			/>

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

interface ISearchFieldProps {
	value: string;
	onChange: (value: string) => void;
	/** Accessible name, e.g. "Search parts". */
	label: string;
	placeholder?: string;
	/** Enter: act on the first result. */
	onSubmit?: () => void;
	/** Lets a parent focus the field, e.g. from a "/" shortcut. */
	inputRef?: RefObject<HTMLInputElement | null>;
	/** A key hint shown at the right while empty, e.g. "/". */
	shortcut?: string;
}

/**
 * A search box: a search icon, the text, and a clear button once there's
 * text. Enter calls `onSubmit`; Escape clears the text, or leaves the field
 * when it's already empty.
 */
export const SearchField = ({
	value,
	onChange,
	label,
	placeholder = "Search…",
	onSubmit,
	inputRef,
	shortcut,
}: ISearchFieldProps) => {
	const ownRef = useRef<HTMLInputElement>(null);
	const ref = inputRef ?? ownRef;

	useHotkeys(
		[
			{
				hotkey: "Enter",
				callback: () => onSubmit?.(),
				options: { meta: { name: "Use the first result" } },
			},
			{
				hotkey: "Escape",
				callback: () => {
					if (value) {
						onChange("");
					} else {
						ref.current?.blur();
					}
				},
				options: { meta: { name: "Clear search" } },
			},
		],
		{ target: ref },
	);

	return (
		<div className={styles.search}>
			<span className={styles.searchIcon}>
				<Icon name="search" size={15} />
			</span>

			<BaseInput
				ref={ref}
				type="search"
				className={styles.input}
				aria-label={label}
				value={value}
				placeholder={placeholder}
				onValueChange={(next) => onChange(next)}
			/>

			{value ? (
				<button
					type="button"
					className={styles.searchClear}
					aria-label="Clear search"
					onClick={() => {
						onChange("");
						ref.current?.focus();
					}}
				>
					<Icon name="close" size={13} />
				</button>
			) : (
				shortcut && <Kbd>{shortcut}</Kbd>
			)}
		</div>
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
	inherit?: IInherit;
	hint?: ReactNode;
}

/** A dropdown of options, styled like the menus. */
export const SelectField = <TValue extends string>({
	label,
	value,
	options,
	onChange,
	inherit,
	hint,
}: ISelectFieldProps<TValue>) => {
	return (
		<Field label={label} inherit={inherit} hint={hint}>
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
	onChange: (value: string) => void;
	/** Colours usually default to the part's or theme's colour until changed. */
	inherit?: IInherit;
}

/** Colour picker with friendly preset swatches and an optional reset to default. */
export const ColorField = ({ label, value, onChange, inherit }: IColorFieldProps) => {
	return (
		<Field label={label} inherit={inherit}>
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
