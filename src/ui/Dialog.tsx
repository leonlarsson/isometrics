import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

import { Button } from "./Button";

import styles from "./Dialog.module.css";

interface IDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** A line under the title. */
	description?: ReactNode;
	/** The dialog's content; it scrolls when it's taller than the window allows. */
	children: ReactNode;
	/** Label of the button that closes it. */
	closeLabel?: string;
	/** A main action next to the close button (which then says Cancel), e.g. Create. */
	confirm?: { label: string; onConfirm: () => void; disabled?: boolean };
	/** Room for two columns, e.g. choices on the left and their settings on the right. */
	wide?: boolean;
}

/**
 * A modal panel for content that needs more room than a menu: a title, a
 * scrolling body and a close button, optionally with a main action beside
 * it. Built on Base UI's Dialog (ADR-0024); for a yes/no question use
 * `ConfirmDialog`. Escape and the backdrop close it.
 */
export const Dialog = ({
	open,
	onOpenChange,
	title,
	description,
	children,
	closeLabel,
	confirm,
	wide,
}: IDialogProps) => {
	return (
		<BaseDialog.Root open={open} onOpenChange={onOpenChange}>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className={styles.backdrop} />

				<BaseDialog.Popup className={styles.popup} data-wide={wide || undefined}>
					<BaseDialog.Title className={styles.title}>{title}</BaseDialog.Title>

					{description && (
						<BaseDialog.Description className={styles.description}>
							{description}
						</BaseDialog.Description>
					)}

					<div className={styles.body}>{children}</div>

					<div className={styles.actions}>
						<Button onClick={() => onOpenChange(false)}>
							{closeLabel ?? (confirm ? "Cancel" : "Done")}
						</Button>

						{confirm && (
							<Button
								variant="primary"
								disabled={confirm.disabled}
								onClick={() => {
									confirm.onConfirm();
									onOpenChange(false);
								}}
							>
								{confirm.label}
							</Button>
						)}
					</div>
				</BaseDialog.Popup>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
};
