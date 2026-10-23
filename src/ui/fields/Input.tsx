import { Input as BaseInput } from "@base-ui/react/input";

import styles from "./Fields.module.css";

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
