import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

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
	/** The left column: a list to pick from, often with a search. */
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
	nav,
	navLabel,
	children,
	showsPage,
	onBack,
	backLabel = "Back",
}: ISplitDialogProps) => {
	const narrow = useNarrowLayout();
	const dragHandle = useDialogDrag();

	return (
		<BaseDialog.Root open={open} onOpenChange={onOpenChange}>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className={styles.backdrop} />

				<BaseDialog.Popup className={styles.popup}>
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
							{nav}
						</nav>

						<div className={styles.page}>{children}</div>
					</div>
				</BaseDialog.Popup>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
};
