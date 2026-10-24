import type { ReactNode } from "react";

import { useSearchMatch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface IFieldGroupProps {
	/** What the fields in it are about, e.g. "Brightness". */
	title: string;
	children: ReactNode;
}

/**
 * Related fields inside a panel, in a titled inset box, so it's clear which
 * settings belong together (a light's brightness and where it comes from).
 * The settings search shows a group when its title or one of its fields
 * matches (ADR-0054).
 */
export const FieldGroup = ({ title, children }: IFieldGroupProps) => {
	return (
		<fieldset className={styles.fieldGroup} data-search-match={useSearchMatch(title)}>
			<legend className={styles.fieldGroupTitle}>{title}</legend>

			<div className={styles.fieldGroupBody}>{children}</div>
		</fieldset>
	);
};
