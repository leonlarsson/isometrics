import type { ReactNode } from "react";

import { Tooltip } from "../Tooltip";

import { Field } from "./Field";

import styles from "./Fields.module.css";

interface IReadOutFieldProps {
	label: string;
	/** What it reads now: one line, cut short with an ellipsis (the whole of it on hover). */
	value: string;
	hint?: ReactNode;
}

/**
 * A value that can't be set here, only read, and may change while it's shown
 * (where a driving vehicle is now): one line at a fixed height, so a change
 * never moves the fields below it.
 */
export const ReadOutField = ({ label, value, hint }: IReadOutFieldProps) => (
	<Field label={label} hint={hint}>
		{(id) => (
			<Tooltip label={value}>
				<output id={id} className={styles.readOut}>
					{value}
				</output>
			</Tooltip>
		)}
	</Field>
);
