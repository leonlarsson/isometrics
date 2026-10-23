import { type ReactNode, useId } from "react";

import { Hint } from "./Hint";
import { type IInherit, InheritAction } from "./InheritAction";
import { LabelRow } from "./LabelRow";

import styles from "./Fields.module.css";

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
