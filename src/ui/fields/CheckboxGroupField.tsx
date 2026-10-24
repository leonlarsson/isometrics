import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { useId } from "react";

import { Icon } from "../Icon";

import { LabelRow } from "./LabelRow";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface ICheckboxGroupFieldProps {
	label: string;
	options: { value: string; label: string }[];
	value: string[];
	onChange: (value: string[]) => void;
}

/** A labelled list of checkboxes that picks several values. */
export const CheckboxGroupField = ({
	label,
	options,
	value,
	onChange,
}: ICheckboxGroupFieldProps) => {
	const id = useId();
	return (
		// Stacked: the checkboxes need the panel's width, not just the control column.
		<div className={styles.field} data-stacked="" data-search-match={useSearchMatch(label)}>
			<LabelRow label={label} id={id} />

			<CheckboxGroup
				aria-labelledby={id}
				className={styles.checklist}
				value={value}
				onValueChange={onChange}
			>
				{options.map((option) => (
					// biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the labelled control
					<label key={option.value} className={styles.check}>
						<Checkbox.Root value={option.value} className={styles.checkbox}>
							<Checkbox.Indicator className={styles.checkboxIndicator}>
								<Icon name="check" size={12} />
							</Checkbox.Indicator>
						</Checkbox.Root>

						<span>{option.label}</span>
					</label>
				))}
			</CheckboxGroup>
		</div>
	);
};
