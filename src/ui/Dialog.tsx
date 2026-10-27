import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ReactNode, useRef } from "react";

import { Button } from "./Button";
import { useDialogDrag } from "./useDialogDrag";

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
	/**
	 * A main action next to the close button (which then says Cancel), e.g. Create. It closes the
	 * dialog, unless `keepOpen` (an action whose result shows in it, like Render).
	 */
	confirm?: { label: string; onConfirm: () => void; disabled?: boolean; keepOpen?: boolean };
	/** Room for two columns, e.g. choices on the left and their settings on the right. */
	wide?: boolean;
	/**
	 * What gets focus when it opens: its first control (the default), or the dialog itself, for
	 * one that's mostly to read, so no button's tooltip pops up (a part's details).
	 */
	initialFocus?: "firstControl" | "dialog";
}

/**
 * A modal panel for content that needs more room than a menu: a title, a
 * scrolling body and a close button, optionally with a main action beside
 * it. Built on Base UI's Dialog (ADR-0024); for a yes/no question use
 * `ConfirmDialog`. Escape and the backdrop close it; its title bar moves it.
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
	initialFocus = "firstControl",
}: IDialogProps) => {
	const dragHandle = useDialogDrag();
	const popup = useRef<HTMLDivElement>(null);

	return (
		<BaseDialog.Root open={open} onOpenChange={onOpenChange}>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className={styles.backdrop} />

				<BaseDialog.Popup
					ref={popup}
					className={styles.popup}
					data-wide={wide || undefined}
					initialFocus={initialFocus === "dialog" ? popup : undefined}
				>
					<BaseDialog.Title className={styles.title} {...dragHandle}>
						{title}
					</BaseDialog.Title>

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
									if (!confirm.keepOpen) {
										onOpenChange(false);
									}
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
