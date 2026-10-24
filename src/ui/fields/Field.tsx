import { type ReactNode, useId } from "react";

import { Hint } from "./Hint";
import { type IInherit, InheritAction } from "./InheritAction";
import { LabelRow } from "./LabelRow";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface IFieldProps {
	label: string;
	children: (id: string) => ReactNode;
	/** A small control on the label's row, right-aligned. */
	action?: ReactNode;
	/** The value is inherited unless overridden (shows Default / From… or Reset). */
	inherit?: IInherit;
	hint?: ReactNode;
	/** The label above the control even in a wide panel, for controls that need the width. */
	stacked?: boolean;
}

/** The field anatomy for custom controls: label row, the control (given the label's id), hint. */
export const Field = ({ label, children, action, inherit, hint, stacked }: IFieldProps) => {
	const id = useId();
	return (
		<div
			className={styles.field}
			data-stacked={stacked || undefined}
			data-search-match={useSearchMatch(label)}
		>
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
