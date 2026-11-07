import type { ReactNode } from "react";

import { Icon } from "../Icon";

import styles from "./Fields.module.css";

interface IHintProps {
	children: ReactNode;
	/**
	 * "warning": something to know before acting (a click that changes more
	 * than it seems), in a tinted box with an alert icon, so it isn't missed.
	 */
	tone?: "warning";
}

/** Muted helper text under a field or at the end of a section; a warning stands out. */
export const Hint = ({ children, tone }: IHintProps) => {
	if (tone === "warning") {
		return (
			<p className={styles.warningHint}>
				<Icon name="alert" size={16} />

				<span>{children}</span>
			</p>
		);
	}
	return <p className={styles.hint}>{children}</p>;
};
