import type { ReactNode } from "react";

import { Icon, type TIconName } from "./Icon";

import styles from "./PaneHeader.module.css";

interface IPaneHeaderProps {
	icon: TIconName;
	title: string;
	/** Controls at the right end, e.g. an IconButton. */
	actions?: ReactNode;
}

/**
 * The band at the top of a side pane (Add to scene, the outliner): its icon
 * and name, and a few controls. The properties' header matches it (ADR-0054).
 */
export const PaneHeader = ({ icon, title, actions }: IPaneHeaderProps) => {
	return (
		<header className={styles.header}>
			<span className={styles.icon}>
				<Icon name={icon} size={15} />
			</span>

			<h2 className={styles.title}>{title}</h2>

			{actions && <div className={styles.actions}>{actions}</div>}
		</header>
	);
};
