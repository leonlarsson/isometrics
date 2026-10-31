import type { ReactNode } from "react";

import { Field } from "./Field";
import type { TResettable } from "./InheritAction";
import { Input } from "./Input";

import styles from "./Fields.module.css";

interface ITextFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	multiline?: boolean;
	/** Multiline: how many lines it shows before it scrolls (3). */
	rows?: number;
	hint?: ReactNode;
	/** The value differs between the selected things (ADR-0064). */
	mixed?: boolean;
}

export const TextField = ({
	label,
	value,
	onChange,
	placeholder,
	multiline = false,
	rows = 3,
	hint,
	mixed,
	inherit,
}: ITextFieldProps & TResettable) => {
	return (
		<Field label={label} hint={hint} mixed={mixed} stacked={multiline} inherit={inherit}>
			{(id) =>
				multiline ? (
					<textarea
						id={id}
						className={styles.input}
						rows={rows}
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
