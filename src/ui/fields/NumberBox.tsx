import { NumberField as BaseNumberField } from "@base-ui/react/number-field";

import styles from "./Fields.module.css";

/** Numbers show up to three decimals, with a dot and no thousands separators. */
export const NUMBER_FORMAT: Intl.NumberFormatOptions = {
	maximumFractionDigits: 3,
	useGrouping: false,
};
export const NUMBER_LOCALE = "en-US";

export interface INumberRangeProps {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
}

/** The number box itself. Must sit inside a BaseNumberField.Root. */
export const NumberBox = ({ ariaLabel }: { ariaLabel?: string }) => {
	return (
		<BaseNumberField.Group className={styles.numberGroup}>
			<BaseNumberField.Input className={styles.number} aria-label={ariaLabel} />
		</BaseNumberField.Group>
	);
};
