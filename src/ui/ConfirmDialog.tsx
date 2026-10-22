import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";

import styles from "./ConfirmDialog.module.css";

interface IConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: ReactNode;
	confirmLabel: string;
	onConfirm: () => void;
	/** An extra button on the left that doesn't close the dialog, e.g. "Save to file first". */
	extraAction?: { label: string; onClick: () => void };
}

/**
 * A modal yes/no question, built on Base UI's AlertDialog (ADR-0024). Use it
 * instead of `window.confirm`. Cancel and Escape close it without acting.
 */
export const ConfirmDialog = ({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
	extraAction,
}: IConfirmDialogProps) => {
	return (
		<AlertDialog.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialog.Portal>
				<AlertDialog.Backdrop className={styles.backdrop} />

				<AlertDialog.Popup className={styles.popup}>
					<AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>

					<AlertDialog.Description className={styles.description}>
						{description}
					</AlertDialog.Description>

					<div className={styles.actions}>
						{extraAction && (
							<button type="button" className={styles.extra} onClick={extraAction.onClick}>
								{extraAction.label}
							</button>
						)}

						<AlertDialog.Close className={styles.secondary}>Cancel</AlertDialog.Close>

						<AlertDialog.Close className={styles.primary} onClick={onConfirm}>
							{confirmLabel}
						</AlertDialog.Close>
					</div>
				</AlertDialog.Popup>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	);
};
