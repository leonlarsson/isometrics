import type { ReactNode } from "react";

import { Field } from "./Field";
import { Input } from "./Input";

import styles from "./Fields.module.css";

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
		<Field label={label} hint={hint} stacked={multiline}>
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
