import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import type { ReactNode } from "react";

import { Icon } from "../Icon";

import styles from "./Fields.module.css";

interface ILabelRowProps {
	label: string;
	htmlFor?: string;
	id?: string;
	action?: ReactNode;
	/** Drag the label to change the value. Only inside a number field's root. */
	scrub?: boolean;
}

export const LabelRow = ({ label, htmlFor, id, action, scrub }: ILabelRowProps) => {
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
