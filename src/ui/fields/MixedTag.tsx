import { Tooltip } from "../Tooltip";

import styles from "./Fields.module.css";

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
