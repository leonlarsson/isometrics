import { Switch } from "@base-ui/react/switch";
import type { ReactNode } from "react";

import { Hint } from "./Hint";
import { type IInherit, InheritAction } from "./InheritAction";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface ISwitchFieldProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** Default / Reset at the row's end (ADR-0027). */
	inherit?: IInherit;
	hint?: ReactNode;
}

/** An on/off switch with its label on the right. Fits in a section's header too. */
export const SwitchField = ({ label, checked, onChange, inherit, hint }: ISwitchFieldProps) => {
	const match = useSearchMatch(label);
	const wrapped = Boolean(inherit || hint);
	const field = (
		// biome-ignore lint/a11y/noLabelWithoutControl: the switch inside is the labelled control
		<label className={styles.switchField} data-search-match={wrapped ? undefined : match}>
			<Switch.Root className={styles.switch} checked={checked} onCheckedChange={onChange}>
				<Switch.Thumb className={styles.switchThumb} />
			</Switch.Root>

			<span>{label}</span>
		</label>
	);
	if (!wrapped) {
		return field;
	}
	// Default / Reset next to the label, not inside it, so pressing Reset doesn't flip the switch.
	const row = inherit ? (
		<div className={styles.switchRow}>
			{field}

			<InheritAction inherit={inherit} />
		</div>
	) : (
		field
	);
	if (!hint) {
		return <div data-search-match={match}>{row}</div>;
	}
	return (
		<div className={styles.switchWithHint} data-search-match={match}>
			{row}

			<Hint>{hint}</Hint>
		</div>
	);
};
