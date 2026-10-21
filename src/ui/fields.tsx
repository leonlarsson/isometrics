import { type ReactNode, useId, useState } from "react";

import { SWATCHES } from "#/scene/theme";

import { Icon } from "./Icon";

import styles from "./Fields.module.css";

export const Section = ({
	title,
	children,
	actions,
}: {
	title: string;
	children: ReactNode;
	actions?: ReactNode;
}) => {
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

export const Field = ({
	label,
	children,
	inline = false,
	action,
}: {
	label: string;
	children: (id: string) => ReactNode;
	inline?: boolean;
	/** A small control on the label's row, right-aligned (e.g. a reset link). */
	action?: ReactNode;
}) => {
	const id = useId();
	const labelElement = (
		<label htmlFor={id} className={styles.label}>
			{label}
		</label>
	);
	return (
		<div className={inline ? styles.fieldInline : styles.field}>
			{action ? (
				<div className={styles.labelRow}>
					{labelElement}

					{action}
				</div>
			) : (
				labelElement
			)}

			{children(id)}
		</div>
	);
};

export const TextInput = ({
	label,
	value,
	onChange,
	placeholder,
	multiline = false,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	multiline?: boolean;
}) => {
	return (
		<Field label={label}>
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
					<input
						id={id}
						className={styles.input}
						value={value}
						placeholder={placeholder}
						onChange={(e) => onChange(e.target.value)}
					/>
				)
			}
		</Field>
	);
};

/**
 * Number input that tolerates half-typed values ("-", "1.") by keeping a local
 * draft and only reporting parseable numbers.
 */
export const NumberInput = ({
	value,
	onChange,
	min,
	max,
	step = 0.1,
	id,
	ariaLabel,
}: {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	id?: string;
	ariaLabel?: string;
}) => {
	const [draft, setDraft] = useState<string | null>(null);
	return (
		<input
			id={id}
			aria-label={ariaLabel}
			className={styles.number}
			type="number"
			inputMode="decimal"
			min={min}
			max={max}
			step={step}
			value={draft ?? String(Number(value.toFixed(3)))}
			onChange={(e) => {
				setDraft(e.target.value);
				const parsed = Number.parseFloat(e.target.value);
				if (!Number.isNaN(parsed)) {
					onChange(parsed);
				}
			}}
			onBlur={() => setDraft(null)}
		/>
	);
};

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
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	min: number;
	max: number;
	step: number;
	suffix?: string;
	/** With `onReset`: whether the value is the default, which hides the reset link. */
	isDefault?: boolean;
	onReset?: () => void;
}) => {
	return (
		<Field
			label={label}
			action={
				onReset &&
				!isDefault && (
					<button type="button" className={styles.linkButton} onClick={onReset}>
						<Icon name="reset" size={14} /> Default
					</button>
				)
			}
		>
			{(id) => (
				<div className={styles.sliderRow}>
					<input
						id={id}
						className={styles.slider}
						type="range"
						min={min}
						max={max}
						step={step}
						value={value}
						onChange={(e) => onChange(Number(e.target.value))}
					/>

					<NumberInput
						value={value}
						onChange={onChange}
						min={min}
						max={max}
						step={step}
						ariaLabel={label}
					/>

					{suffix && <span className={styles.suffix}>{suffix}</span>}
				</div>
			)}
		</Field>
	);
};

export const VectorField = ({
	label,
	axes,
	values,
	onChange,
	step = 0.5,
}: {
	label: string;
	axes: string[];
	values: number[];
	onChange: (index: number, value: number) => void;
	step?: number;
}) => {
	return (
		<Field label={label}>
			{(id) => (
				<div className={styles.vector}>
					{axes.map((axis, i) => (
						<span key={axis} className={styles.axis}>
							<span className={styles.axisName}>{axis}</span>

							<NumberInput
								id={i === 0 ? id : undefined}
								ariaLabel={`${label} ${axis}`}
								value={values[i]}
								step={step}
								onChange={(v) => onChange(i, v)}
							/>
						</span>
					))}
				</div>
			)}
		</Field>
	);
};

export const Toggle = ({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) => {
	return (
		<label className={styles.toggle}>
			<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />

			<span className={styles.toggleTrack} aria-hidden="true" />

			<span>{label}</span>
		</label>
	);
};

export const Select = <TValue extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: TValue;
	options: { value: TValue; label: string }[];
	onChange: (value: TValue) => void;
}) => {
	return (
		<Field label={label}>
			{(id) => (
				<select
					id={id}
					className={styles.input}
					value={value}
					onChange={(e) => onChange(e.target.value as TValue)}
				>
					{options.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			)}
		</Field>
	);
};

/** Colour picker with friendly preset swatches and an optional reset to default. */
export const ColorField = ({
	label,
	value,
	isDefault,
	onChange,
	onReset,
}: {
	label: string;
	value: string;
	isDefault: boolean;
	onChange: (value: string) => void;
	onReset?: () => void;
}) => {
	return (
		<Field
			label={label}
			action={
				onReset &&
				!isDefault && (
					<button type="button" className={styles.linkButton} onClick={onReset}>
						<Icon name="reset" size={14} /> Default
					</button>
				)
			}
		>
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
