import type { ReactNode } from "react";

import styles from "./List.module.css";

/** A vertical list of rows, e.g. the roads in the Scene tab or saved backups. */
export const List = ({ children }: { children: ReactNode }) => {
	return <ul className={styles.list}>{children}</ul>;
};

interface IListItemProps {
	label: ReactNode;
	/** Muted text on the right (or under the label with `stacked`). */
	meta?: ReactNode;
	/** A small colour chip before the label; any CSS background. */
	swatch?: string;
	/** Clicking the row selects it. Without it the row isn't clickable. */
	onClick?: () => void;
	/** Highlights the row (the selected item). */
	current?: boolean;
	/** Buttons at the end of the row (outside the clickable area). */
	actions?: ReactNode;
	/** Put the meta under the label instead of on the right. */
	stacked?: boolean;
}

export const ListItem = ({
	label,
	meta,
	swatch,
	onClick,
	current,
	actions,
	stacked,
}: IListItemProps) => {
	const content = (
		<>
			{swatch && <span className={styles.swatch} style={{ background: swatch }} />}

			<span className={styles.text} data-stacked={stacked || undefined}>
				<span className={styles.label}>{label}</span>

				{meta && <span className={styles.meta}>{meta}</span>}
			</span>
		</>
	);
	return (
		<li className={styles.item}>
			{onClick ? (
				<button
					type="button"
					className={styles.main}
					aria-current={current || undefined}
					onClick={onClick}
				>
					{content}
				</button>
			) : (
				<div className={styles.main}>{content}</div>
			)}

			{actions}
		</li>
	);
};
