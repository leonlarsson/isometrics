import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactNode } from "react";

import { Icon, type TIconName } from "./Icon";

import styles from "./Menu.module.css";

/**
 * Dropdown menus, built on Base UI's Menu (ADR-0024): it handles focus,
 * keyboard navigation, submenus and ARIA; this file only adds our styling.
 * Use these parts instead of importing `@base-ui/react/menu` directly.
 */

interface IMenuTriggerProps {
	children: ReactNode;
	label?: string;
}

const MenuTrigger = ({ children, label }: IMenuTriggerProps) => {
	return (
		<BaseMenu.Trigger className={styles.trigger} aria-label={label}>
			{children}

			<Icon name="chevronDown" size={14} />
		</BaseMenu.Trigger>
	);
};

interface IMenuPopupProps {
	children: ReactNode;
}

const MenuPopup = ({ children }: IMenuPopupProps) => {
	return (
		<BaseMenu.Portal>
			<BaseMenu.Positioner className={styles.positioner} sideOffset={6} align="start">
				<BaseMenu.Popup className={styles.popup}>{children}</BaseMenu.Popup>
			</BaseMenu.Positioner>
		</BaseMenu.Portal>
	);
};

interface IMenuItemProps {
	label: string;
	icon?: TIconName;
	/** A second, muted line under the label. */
	description?: string;
	/** Keyboard shortcut shown on the right, e.g. "Ctrl+O". */
	shortcut?: string;
	disabled?: boolean;
	onClick: () => void;
}

const MenuItem = ({ label, icon, description, shortcut, disabled, onClick }: IMenuItemProps) => {
	return (
		<BaseMenu.Item className={styles.item} disabled={disabled} onClick={onClick}>
			{icon && (
				<span className={styles.icon}>
					<Icon name={icon} size={16} />
				</span>
			)}

			<span className={styles.text}>
				{label}

				{description && <span className={styles.description}>{description}</span>}
			</span>

			{shortcut && <kbd className={styles.shortcut}>{shortcut}</kbd>}
		</BaseMenu.Item>
	);
};

interface IMenuSubmenuProps {
	label: string;
	icon?: TIconName;
	children: ReactNode;
}

const MenuSubmenu = ({ label, icon, children }: IMenuSubmenuProps) => {
	return (
		<BaseMenu.SubmenuRoot>
			<BaseMenu.SubmenuTrigger className={styles.item}>
				{icon && (
					<span className={styles.icon}>
						<Icon name={icon} size={16} />
					</span>
				)}

				<span className={styles.text}>{label}</span>

				<Icon name="chevronRight" size={14} />
			</BaseMenu.SubmenuTrigger>

			<BaseMenu.Portal>
				<BaseMenu.Positioner className={styles.positioner} sideOffset={2} alignOffset={-5}>
					<BaseMenu.Popup className={styles.popup}>{children}</BaseMenu.Popup>
				</BaseMenu.Positioner>
			</BaseMenu.Portal>
		</BaseMenu.SubmenuRoot>
	);
};

const MenuSeparator = () => {
	return <BaseMenu.Separator className={styles.separator} />;
};

export const Menu = {
	Root: BaseMenu.Root,
	Trigger: MenuTrigger,
	Popup: MenuPopup,
	Item: MenuItem,
	Submenu: MenuSubmenu,
	Separator: MenuSeparator,
};
