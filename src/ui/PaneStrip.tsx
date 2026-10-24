import type { ReactNode } from "react";

import { IconButton } from "./Button";

import styles from "./PaneStrip.module.css";

interface IPaneStripProps {
	/** The side of the screen it's on. */
	side: "left" | "right";
	/** What the button says, e.g. "Show Add to scene". */
	label: string;
	onOpen: () => void;
	/** Under the open button, e.g. shortcuts to the pane's tabs. */
	children?: ReactNode;
}

/**
 * A folded side pane (ADR-0055): a thin strip whose button opens it again,
 * as does dragging its inner edge out (the pane's resize handle stays there).
 */
export const PaneStrip = ({ side, label, onOpen, children }: IPaneStripProps) => {
	return (
		<aside className={styles.strip} data-side={side}>
			<IconButton
				icon={side === "left" ? "chevronRight" : "chevronLeft"}
				label={`${label} (or drag its edge out; Ctrl+Space shows both panels)`}
				tooltipSide={side === "left" ? "right" : "left"}
				onClick={onOpen}
			/>

			{children}
		</aside>
	);
};
