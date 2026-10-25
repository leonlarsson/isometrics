import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ReactNode } from "react";

import { Icon, type TIconName } from "./Icon";
import { Tooltip } from "./Tooltip";

import styles from "./Menu.module.css";

/**
 * Dropdown menus, built on Base UI's Menu (ADR-0024): it handles focus,
 * keyboard navigation, submenus and ARIA; this file only adds our styling.
 * Use these parts instead of importing `@base-ui/react/menu` directly.
 */

interface IMenuTriggerProps {
	children: ReactNode;
	label?: string;
	/** False leaves out the down arrow, e.g. for a "More" button that is just an icon. */
	chevron?: boolean;
	/** "danger" for a trigger that warns, e.g. the save status when saving failed. */
	tone?: "danger";
	/** A tooltip on hover, for a trigger that is just an icon. */
	tooltip?: string;
	/** Just an icon (the children), as a small square like a small IconButton, e.g. in a panel's title bar. */
	iconOnly?: boolean;
}

const MenuTrigger = ({
	children,
	label,
	chevron = true,
	tone,
	tooltip,
	iconOnly = false,
}: IMenuTriggerProps) => {
	const trigger = (
		<BaseMenu.Trigger
			className={styles.trigger}
			aria-label={label}
			data-tone={tone}
			data-icon-only={iconOnly || undefined}
		>
			{children}

			{chevron && !iconOnly && (
				<span className={styles.chevron}>
					<Icon name="chevronDown" size={14} />
				</span>
			)}
		</BaseMenu.Trigger>
	);
	return tooltip ? <Tooltip label={tooltip}>{trigger}</Tooltip> : trigger;
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

interface IMenuCheckboxItemProps {
	label: string;
	icon?: TIconName;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	/** Leave the menu open after picking it, for menus of several switches to flip in a row. */
	keepOpen?: boolean;
}

/** A setting that is on or off, ticked on the right while on. Picking it closes the menu. */
const MenuCheckboxItem = ({
	label,
	icon,
	checked,
	onCheckedChange,
	keepOpen = false,
}: IMenuCheckboxItemProps) => {
	return (
		<BaseMenu.CheckboxItem
			className={styles.item}
			checked={checked}
			onCheckedChange={(next) => onCheckedChange(next)}
			closeOnClick={!keepOpen}
		>
			{icon && (
				<span className={styles.icon}>
					<Icon name={icon} size={16} />
				</span>
			)}

			<span className={styles.text}>{label}</span>

			<BaseMenu.CheckboxItemIndicator className={styles.check}>
				<Icon name="check" size={16} />
			</BaseMenu.CheckboxItemIndicator>
		</BaseMenu.CheckboxItem>
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

interface IContextMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Where it opens, in screen px: usually where the right-click was. */
	x: number;
	y: number;
	/** A heading saying what the menu is for, e.g. the name of the thing that was right-clicked. */
	title?: ReactNode;
	/** A muted line under the title, e.g. what kind of thing it is. */
	subtitle?: ReactNode;
	/** Menu.Item, Menu.CheckboxItem, Menu.Submenu and Menu.Separator. */
	children: ReactNode;
}

/**
 * A menu that opens at a point instead of under a trigger, for right-clicks.
 * Controlled, so one menu can serve the scene and lists alike.
 */
export const ContextMenu = ({
	open,
	onOpenChange,
	x,
	y,
	title,
	subtitle,
	children,
}: IContextMenuProps) => {
	const anchor = {
		getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }),
	};
	return (
		<BaseMenu.Root open={open} onOpenChange={onOpenChange}>
			<BaseMenu.Portal>
				<BaseMenu.Positioner
					className={styles.positioner}
					anchor={anchor}
					side="bottom"
					align="start"
					sideOffset={2}
				>
					{/* No trigger to give focus back to; an action may open something that takes it. */}
					<BaseMenu.Popup className={styles.popup} finalFocus={false}>
						{title ? (
							<BaseMenu.Group>
								<BaseMenu.GroupLabel className={styles.header}>
									<span className={styles.headerTitle}>{title}</span>

									{subtitle && <span className={styles.description}>{subtitle}</span>}
								</BaseMenu.GroupLabel>

								<BaseMenu.Separator className={styles.separator} />

								{children}
							</BaseMenu.Group>
						) : (
							children
						)}
					</BaseMenu.Popup>
				</BaseMenu.Positioner>
			</BaseMenu.Portal>
		</BaseMenu.Root>
	);
};

interface IMenuGroupProps {
	/** A muted heading over the group's items. */
	label: string;
	children: ReactNode;
}

/** Items under a heading, e.g. one category in a long list (instead of another submenu level). */
const MenuGroup = ({ label, children }: IMenuGroupProps) => {
	return (
		<BaseMenu.Group>
			<BaseMenu.GroupLabel className={styles.groupLabel}>{label}</BaseMenu.GroupLabel>

			{children}
		</BaseMenu.Group>
	);
};

/** A short paragraph in a menu that isn't an item, e.g. what a status means. */
const MenuNote = ({ children }: { children: ReactNode }) => {
	return <p className={styles.note}>{children}</p>;
};

const MenuSeparator = () => {
	return <BaseMenu.Separator className={styles.separator} />;
};

export const Menu = {
	Root: BaseMenu.Root,
	Trigger: MenuTrigger,
	Popup: MenuPopup,
	Item: MenuItem,
	CheckboxItem: MenuCheckboxItem,
	Submenu: MenuSubmenu,
	Group: MenuGroup,
	Note: MenuNote,
	Separator: MenuSeparator,
};
