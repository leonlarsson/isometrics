import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ReactNode, useRef } from "react";

import { IconButton } from "./Button";
import { useDialogDrag } from "./useDialogDrag";
import { useNarrowLayout } from "./useNarrowLayout";

import styles from "./SplitDialog.module.css";

interface ISplitDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** Buttons in the title bar, before Close (e.g. Add data). */
	actions?: ReactNode;
	/** Above the left column's list, staying put while the list scrolls: a search, filters. */
	navHead?: ReactNode;
	/** The left column: a list to pick from. */
	nav: ReactNode;
	/** Its name for screen readers ("The world's data"). */
	navLabel: string;
	/** The right column: what's picked in the list. */
	children: ReactNode;
	/**
	 * On phones it shows one column at a time: the page when this is true (with a Back button,
	 * `onBack`), else the list.
	 */
	showsPage: boolean;
	onBack?: () => void;
	/** The Back button's label ("Back to all data"). */
	backLabel?: string;
}

/**
 * A window with a list on the left and what's picked in it on the right, like
 * an app's preferences (SettingsDialog is the one for settings pages): the
 * Data window. On phones and small tablets it fills the screen, one column at
 * a time. Built on Base UI's Dialog (ADR-0024); its title bar moves it.
 */
export const SplitDialog = ({
	open,
	onOpenChange,
	title,
	actions,
	navHead,
	nav,
	navLabel,
	children,
	showsPage,
	onBack,
	backLabel = "Back",
}: ISplitDialogProps) => {
	const narrow = useNarrowLayout();
	const dragHandle = useDialogDrag();
	// Focus starts on the window itself, so no button in its title bar opens with a focus ring.
	const popup = useRef<HTMLDivElement>(null);

	return (
		<BaseDialog.Root open={open} onOpenChange={onOpenChange}>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className={styles.backdrop} />

				<BaseDialog.Popup ref={popup} className={styles.popup} initialFocus={popup}>
					<header className={styles.header} {...dragHandle}>
						{narrow && showsPage && onBack && (
							<IconButton icon="chevronLeft" label={backLabel} onClick={onBack} />
						)}

						<BaseDialog.Title className={styles.title}>{title}</BaseDialog.Title>

						{actions}

						<IconButton icon="close" label="Close" onClick={() => onOpenChange(false)} />
					</header>

					<div className={styles.columns} data-shows={showsPage ? "page" : "list"}>
						<nav className={styles.nav} aria-label={navLabel}>
							{navHead && <div className={styles.navHead}>{navHead}</div>}

							<div className={styles.navList}>{nav}</div>
						</nav>

						<div className={styles.page}>{children}</div>
					</div>
				</BaseDialog.Popup>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
};
