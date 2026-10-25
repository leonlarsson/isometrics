import type { ReactNode } from "react";

import { Icon } from "./Icon";
import { Menu } from "./Menu";

interface ICopyPasteMenuProps {
	/** What the panel's settings are, for the button's name: "Colours", "Lamp light"… */
	what: string;
	onCopy: () => void;
	onPaste: () => void;
	/** More items after Paste, e.g. Paste schedule only. */
	children?: ReactNode;
}

/**
 * A panel's Copy / Paste menu, for its header (ADR-0068): Copy puts the
 * panel's settings on the clipboard; Paste puts the clipboard's onto every
 * selected object that has the same thing.
 */
export const CopyPasteMenu = ({ what, onCopy, onPaste, children }: ICopyPasteMenuProps) => {
	return (
		<Menu.Root>
			<Menu.Trigger label={`Copy or paste: ${what}`} tooltip="Copy or paste" iconOnly>
				<Icon name="copy" size={15} />
			</Menu.Trigger>

			<Menu.Popup>
				<Menu.Item
					icon="copy"
					label="Copy"
					description="To paste onto other objects, or into another world"
					onClick={onCopy}
				/>

				<Menu.Item
					icon="paste"
					label="Paste"
					description="Onto the selected objects that have it"
					onClick={onPaste}
				/>

				{children}
			</Menu.Popup>
		</Menu.Root>
	);
};
