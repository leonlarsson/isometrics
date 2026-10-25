import { Switch } from "@base-ui/react/switch";

import { type IInherit, InheritAction } from "./InheritAction";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface ISwitchFieldProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** Default / Reset at the row's end (ADR-0027). */
	inherit?: IInherit;
}

/** An on/off switch with its label on the right. Fits in a section's header too. */
export const SwitchField = ({ label, checked, onChange, inherit }: ISwitchFieldProps) => {
	const match = useSearchMatch(label);
	const field = (
		// biome-ignore lint/a11y/noLabelWithoutControl: the switch inside is the labelled control
		<label className={styles.switchField} data-search-match={inherit ? undefined : match}>
			<Switch.Root className={styles.switch} checked={checked} onCheckedChange={onChange}>
				<Switch.Thumb className={styles.switchThumb} />
			</Switch.Root>

			<span>{label}</span>
		</label>
	);
	if (!inherit) {
		return field;
	}
	// Default / Reset next to the label, not inside it, so pressing Reset doesn't flip the switch.
	return (
		<div className={styles.switchRow} data-search-match={match}>
			{field}

			<InheritAction inherit={inherit} />
		</div>
	);
};
