import type { ReactNode } from "react";

import { IconButton } from "./Button";

import styles from "./FloatingBar.module.css";

interface IFloatingBarProps {
	/** What it's about, in a few words: the bar's first line. */
	title: ReactNode;
	/** More about it, under the title. */
	children?: ReactNode;
	/** Its buttons: beside the text when there's room, under it on narrow screens. */
	actions?: ReactNode;
	/**
	 * Lets it be hidden: a close button at the end of the title row, saying what hiding does
	 * (`label`, e.g. "Hide this bar (it's back when the page reloads)"). The bar's owner decides
	 * what hidden means and for how long.
	 */
	dismiss?: { label: string; onDismiss: () => void };
}

/**
 * A bar floating over the top of the view (the kit, ADR-0024): a title, a few
 * lines about it and its buttons, optionally dismissible from its title row.
 * Keeps clear of the label cards, and wraps its buttons under the text on
 * narrow screens.
 */
export const FloatingBar = ({ title, children, actions, dismiss }: IFloatingBarProps) => (
	<div className={styles.bar} data-label-obstacle="" role="status">
		<div className={styles.titleRow}>
			<strong className={styles.title}>{title}</strong>

			{dismiss && (
				<span className={styles.dismiss}>
					<IconButton icon="close" label={dismiss.label} onClick={dismiss.onDismiss} />
				</span>
			)}
		</div>

		<div className={styles.body}>
			{children && <div className={styles.details}>{children}</div>}

			{actions && <div className={styles.actions}>{actions}</div>}
		</div>
	</div>
);
