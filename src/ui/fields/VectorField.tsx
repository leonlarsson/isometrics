import { NumberField as BaseNumberField } from "@base-ui/react/number-field";

import { Icon } from "../Icon";

import { Field } from "./Field";
import type { TResettable } from "./InheritAction";
import { NUMBER_FORMAT, NUMBER_LOCALE, NumberBox } from "./NumberBox";

import styles from "./Fields.module.css";

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
export const VectorField = ({
	label,
	axes,
	values,
	onChange,
	step = 0.5,
	inherit,
}: IVectorFieldProps & TResettable) => {
	return (
		<Field label={label} inherit={inherit}>
			{(id) => (
				<div className={styles.vector} data-axes={axes.length}>
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
