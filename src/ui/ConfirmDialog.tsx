import { AlertDialog } from "@base-ui/react/alert-dialog";
import { type ReactNode, useEffect, useState } from "react";

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
	/**
	 * Seconds the confirm button stays disabled (counting down) each time the
	 * dialog opens, for actions that can't be undone, so it isn't clicked in a hurry.
	 */
	confirmDelaySeconds?: number;
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
	confirmDelaySeconds = 0,
}: IConfirmDialogProps) => {
	const [waiting, setWaiting] = useState(0);
	useEffect(() => {
		if (!open || confirmDelaySeconds <= 0) {
			setWaiting(0);
			return;
		}
		setWaiting(confirmDelaySeconds);
		const timer = setInterval(() => setWaiting((left) => Math.max(0, left - 1)), 1000);
		return () => clearInterval(timer);
	}, [open, confirmDelaySeconds]);

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
							disabled={waiting > 0}
							onClick={() => {
								onConfirm();
								onOpenChange(false);
							}}
						>
							{confirmLabel}

							{waiting > 0 && <span className={styles.countdown}> ({waiting})</span>}
						</Button>
					</div>
				</AlertDialog.Popup>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	);
};
