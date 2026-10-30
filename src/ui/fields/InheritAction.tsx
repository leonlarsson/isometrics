import { Icon } from "../Icon";
import { Tooltip } from "../Tooltip";

import styles from "./Fields.module.css";

/**
 * A value that comes from somewhere else (a default, the scene, the road…)
 * unless this field overrides it (ADR-0027). The field always shows the value
 * in effect; its label row says where an inherited value comes from, or offers
 * Reset once the value is overridden. Changing the control is the override.
 */
export interface IInherit {
	/** Where the value comes from when not overridden: "default", "scene", "road"… */
	from: string;
	/** True while the field shows the inherited value (nothing overridden). */
	inherited: boolean;
	/** Drop the override and go back to the inherited value. */
	onReset: () => void;
	/** The inherited value in words, for Reset's tooltip, e.g. "smoothly" or "2.4". */
	value?: string;
}

/**
 * What every setting field is given (ADR-0105): `inherit`, its way back to the
 * default (Default while there, Reset once changed), or `hasNoDefault` for a
 * value that is only ever its own (where something stands, a value in the
 * data), with nothing to go back to. Required, so no field forgets its Reset.
 */
export type TResettable =
	| { inherit: IInherit; hasNoDefault?: never }
	| { inherit?: never; hasNoDefault: true };

/** The label row's right side: "Default" / "From scene" while inherited, Reset once overridden. */
export const InheritAction = ({ inherit }: { inherit: IInherit }) => {
	const { from, inherited, onReset, value } = inherit;
	if (inherited) {
		return (
			<span className={styles.inheritTag}>{from === "default" ? "Default" : `From ${from}`}</span>
		);
	}
	const target = from === "default" ? "the default" : `the ${from}’s setting`;
	return (
		<Tooltip label={`Back to ${target}${value ? ` (${value})` : ""}`}>
			<button type="button" className={styles.reset} aria-label="Reset" onClick={onReset}>
				<Icon name="reset" size={13} />

				<span className={styles.resetText}>Reset</span>
			</button>
		</Tooltip>
	);
};
