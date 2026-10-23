import type { ReactNode } from "react";

import styles from "./Fields.module.css";

interface ISectionProps {
	title: string;
	children: ReactNode;
	/** Controls on the right of the title, e.g. an IconButtonGroup or a switch. */
	actions?: ReactNode;
}

/** A titled block in a panel. Panels are a stack of sections. */
export const Section = ({ title, children, actions }: ISectionProps) => {
	return (
		<section className={styles.section}>
			<header className={styles.sectionHeader}>
				<h3>{title}</h3>

				{actions}
			</header>

			<div className={styles.sectionBody}>{children}</div>
		</section>
	);
};
