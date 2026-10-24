import type { ReactNode } from "react";

import { IconButton } from "./Button";
import { Icon, type TIconName } from "./Icon";

import styles from "./PaneHeader.module.css";

interface IPaneHeaderProps {
	icon: TIconName;
	title: string;
	/** Controls at the right end, e.g. an IconButton. */
	actions?: ReactNode;
	/**
	 * A side pane's fold button (ADR-0055), at the pane's outer edge: where the
	 * folded strip's open button then appears, so folding and opening is one spot.
	 */
	fold?: { side: "left" | "right"; label: string; onFold: () => void };
}

/**
 * The band at the top of a side pane (Add to scene, the outliner): its icon
 * and name, and a few controls. The properties' header matches it (ADR-0054).
 */
export const PaneHeader = ({ icon, title, actions, fold }: IPaneHeaderProps) => {
	const foldButton = fold && (
		<IconButton
			icon={fold.side === "left" ? "chevronLeft" : "chevronRight"}
			label={fold.label}
			tooltipSide={fold.side}
			onClick={fold.onFold}
		/>
	);
	return (
		<header className={styles.header} data-fold={fold?.side}>
			{fold?.side === "left" && foldButton}

			<span className={styles.icon}>
				<Icon name={icon} size={15} />
			</span>

			<h2 className={styles.title}>{title}</h2>

			{actions && <div className={styles.actions}>{actions}</div>}

			{fold?.side === "right" && foldButton}
		</header>
	);
};
