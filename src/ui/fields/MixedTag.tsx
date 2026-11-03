import { Tooltip } from "../Tooltip";

import styles from "./Fields.module.css";

/** Whether values differ, so a field shows Mixed (compared as JSON: arrays and bindings by content). */
export const valuesDiffer = (values: readonly unknown[]) =>
	new Set(values.map((value) => JSON.stringify(value ?? null))).size > 1;

/**
 * The label row's tag for a setting that differs between the selected things
 * (ADR-0064): the field shows the last one selected's value, and a change sets it on
 * all of them.
 */
export const MixedTag = () => {
	return (
		<Tooltip label="It differs between the selected things. This shows the value of the last one selected; a change sets it on all of them.">
			<span className={styles.mixedTag}>Mixed</span>
		</Tooltip>
	);
};
