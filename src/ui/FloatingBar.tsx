import type { ReactNode } from "react";

import { IconButton } from "./Button";
import { Icon, type TIconName } from "./Icon";

import styles from "./FloatingBar.module.css";

interface IFloatingBarProps {
	/** A picture for what it's about, in a soft tile before the text. */
	icon?: TIconName;
	/** What it's about, in a few words: the bar's first line. */
	title: ReactNode;
	/** More about it, under the title: short lines, and `FloatingBarNote`s. */
	children?: ReactNode;
	/** Its main buttons, under the text: at its end, or sharing the width on narrow screens. */
	actions?: ReactNode;
	/**
	 * Lets it be hidden: a close button at the end of the title row, saying what hiding does
	 * (`label`, e.g. "Hide this bar (it's back when the page reloads)"). The bar's owner decides
	 * what hidden means and for how long.
	 */
	dismiss?: { label: string; onDismiss: () => void };
	/**
	 * One slim row (a mode that stays a while, like the Workshop): the icon, the title (which may
	 * hold a field), then the buttons; no lines under it, so explain in a tooltip instead.
	 */
	isCompact?: boolean;
}

/**
 * A bar floating over the top of the view (the kit, ADR-0024): an icon, a
 * title, a few short lines and its main buttons, optionally dismissible from
 * its title row; or, compact, all of it on one slim row. Keeps clear of the
 * label cards.
 */
export const FloatingBar = ({
	icon,
	title,
	children,
	actions,
	dismiss,
	isCompact = false,
}: IFloatingBarProps) =>
	isCompact ? (
		<div className={styles.bar} data-compact="" data-label-obstacle="" role="status">
			{icon && (
				<span className={styles.icon} aria-hidden="true">
					<Icon name={icon} size={15} />
				</span>
			)}

			<div className={styles.compactTitle}>{title}</div>

			{actions && <div className={styles.actions}>{actions}</div>}
		</div>
	) : (
		<FullBar icon={icon} title={title} actions={actions} dismiss={dismiss}>
			{children}
		</FullBar>
	);

const FullBar = ({ icon, title, children, actions, dismiss }: IFloatingBarProps) => (
	<div className={styles.bar} data-label-obstacle="" role="status">
		{icon && (
			<span className={styles.icon} aria-hidden="true">
				<Icon name={icon} size={18} />
			</span>
		)}

		<div className={styles.main}>
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
	</div>
);

/** Something in a floating bar that waits on the viewer, with its own small button: a row set apart. */
export const FloatingBarNote = ({
	children,
	action,
}: {
	children: ReactNode;
	action?: ReactNode;
}) => (
	<div className={styles.note}>
		<span className={styles.noteText}>{children}</span>

		{action && <span className={styles.noteAction}>{action}</span>}
	</div>
);
