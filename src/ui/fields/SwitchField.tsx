import { Switch } from "@base-ui/react/switch";
import type { ReactNode } from "react";

import { Hint } from "./Hint";
import { InheritAction, type TResettable } from "./InheritAction";
import { MixedTag } from "./MixedTag";
import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface ISwitchFieldProps {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** The value differs between the selected things (ADR-0064). */
	mixed?: boolean;
	hint?: ReactNode;
}

/** An on/off switch with its label on the right. Fits in a section's header too. */
export const SwitchField = ({
	label,
	checked,
	onChange,
	inherit,
	mixed,
	hint,
}: ISwitchFieldProps & TResettable) => {
	const match = useSearchMatch(label);
	const wrapped = Boolean(inherit || mixed || hint);
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
	const row =
		inherit || mixed ? (
			<div className={styles.switchRow}>
				{field}

				{mixed && <MixedTag />}

				{inherit && <InheritAction inherit={inherit} />}
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
