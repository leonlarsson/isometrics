import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";

import { Button } from "./Button";

import styles from "./ConfirmDialog.module.css";

interface IConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: ReactNode;
	confirmLabel: string;
	onConfirm: () => void;
	/** The confirm button is red: the action deletes something. */
	danger?: boolean;
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
	danger,
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
							<span className={styles.extra}>
								<Button onClick={extraAction.onClick}>{extraAction.label}</Button>
							</span>
						)}

						<Button onClick={() => onOpenChange(false)}>Cancel</Button>

						<Button
							variant={danger ? "danger" : "primary"}
							onClick={() => {
								onConfirm();
								onOpenChange(false);
							}}
						>
							{confirmLabel}
						</Button>
					</div>
				</AlertDialog.Popup>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	);
};
