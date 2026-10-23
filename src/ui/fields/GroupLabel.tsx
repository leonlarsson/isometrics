import type { ReactNode } from "react";

import styles from "./Fields.module.css";

interface IGroupLabelProps {
	children: ReactNode;
	id?: string;
	/** Render as a heading (e.g. palette categories) instead of plain text. */
	as?: "span" | "h3";
}

/** A small uppercase heading for a group inside a panel (palette categories, "Join with"). */
export const GroupLabel = ({ children, id, as: Tag = "span" }: IGroupLabelProps) => {
	return (
		<Tag id={id} className={styles.groupLabel}>
			{children}
		</Tag>
	);
};
