import { Popover } from "@base-ui/react/popover";

import { RenameInput } from "./List";

import styles from "./RenamePopover.module.css";

interface IRenamePopoverProps {
	open: boolean;
	onClose: () => void;
	/** Where it opens, in screen px: where the context menu was, so the name is edited in place. */
	x: number;
	y: number;
	/** What's renamed, for the field's accessible name and the heading. */
	label: string;
	value: string;
	/** Shown in the empty field, e.g. what it's called without a name. */
	placeholder?: string;
	/** The new name, on Enter or clicking away; Esc closes without it. */
	onCommit: (value: string) => void;
}

/** A small name field that opens at a point, for renaming from a context menu. */
export const RenamePopover = ({
	open,
	onClose,
	x,
	y,
	label,
	value,
	placeholder,
	onCommit,
}: IRenamePopoverProps) => {
	const anchor = {
		getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }),
	};
	return (
		<Popover.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				}
			}}
		>
			<Popover.Portal>
				<Popover.Positioner
					className={styles.positioner}
					anchor={anchor}
					side="bottom"
					align="start"
					sideOffset={2}
				>
					{/* The field focuses itself; nothing gets focus back when it closes (it was the menu). */}
					<Popover.Popup className={styles.popup} initialFocus={false} finalFocus={false}>
						<Popover.Title className={styles.title}>Rename</Popover.Title>

						{/* Base UI unmounts it once it has faded out, so each rename starts afresh. */}
						<RenameInput
							label={label}
							rename={{
								value,
								placeholder,
								editing: true,
								onEditingChange: (editing) => {
									if (!editing) {
										onClose();
									}
								},
								onCommit,
							}}
						/>
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		</Popover.Root>
	);
};
