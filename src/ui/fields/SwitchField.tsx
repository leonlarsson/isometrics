import { Switch } from "@base-ui/react/switch";

import styles from "./Fields.module.css";

interface ISwitchFieldProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}

/** An on/off switch with its label on the right. Fits in a section's header too. */
export const SwitchField = ({ label, checked, onChange }: ISwitchFieldProps) => {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: the switch inside is the labelled control
		<label className={styles.switchField}>
			<Switch.Root className={styles.switch} checked={checked} onCheckedChange={onChange}>
				<Switch.Thumb className={styles.switchThumb} />
			</Switch.Root>

			<span>{label}</span>
		</label>
	);
};
