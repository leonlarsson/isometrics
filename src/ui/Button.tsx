import { Button as BaseButton } from "@base-ui/react/button";
import type { ReactNode } from "react";

import { Icon, type TIconName } from "./Icon";
import { Tooltip } from "./Tooltip";

import styles from "./Button.module.css";

/**
 * The app's buttons (ADR-0025), built on Base UI's Button (ADR-0024). Use
 * these instead of styling a `<button>` by hand.
 *
 * Variants: `primary` for the one main action in a place, `secondary` for the
 * rest, `ghost` for quiet actions in lists and rows, `danger` for confirming a
 * delete. Sizes: `md` in bars and dialogs, `sm` inside inspector sections.
 */

export type TButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface IButtonProps {
	children: ReactNode;
	onClick?: () => void;
	variant?: TButtonVariant;
	size?: "sm" | "md";
	icon?: TIconName;
	disabled?: boolean;
	/** Stretch to the container's width, with the content left-aligned. */
	block?: boolean;
	/** Extra muted text pushed to the right edge (with `block`). */
	meta?: ReactNode;
}

export const Button = ({
	children,
	onClick,
	variant = "secondary",
	size = "md",
	icon,
	disabled,
	block,
	meta,
}: IButtonProps) => {
	return (
		<BaseButton
			className={styles.button}
			data-variant={variant}
			data-size={size}
			data-block={block || undefined}
			disabled={disabled}
			onClick={onClick}
		>
			{icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}

			<span className={styles.text}>{children}</span>

			{meta && <span className={styles.meta}>{meta}</span>}
		</BaseButton>
	);
};

interface IIconButtonProps {
	icon: TIconName;
	/** Accessible name, also shown as the tooltip. Include the shortcut, e.g. "Undo (Ctrl+Z)". */
	label: string;
	onClick: () => void;
	/** `md` in the toolbar, `sm` in panels and rows. */
	size?: "sm" | "md";
	disabled?: boolean;
	/** For on/off buttons: shows the pressed state and sets `aria-pressed`. */
	pressed?: boolean;
	tooltipSide?: "top" | "bottom" | "left" | "right";
}

/** A square button with just an icon. Its label is the accessible name and the tooltip. */
export const IconButton = ({
	icon,
	label,
	onClick,
	size = "sm",
	disabled,
	pressed,
	tooltipSide,
}: IIconButtonProps) => {
	return (
		<Tooltip label={label} side={tooltipSide}>
			<BaseButton
				className={styles.iconButton}
				data-size={size}
				aria-label={label}
				aria-pressed={pressed}
				disabled={disabled}
				focusableWhenDisabled
				onClick={onClick}
			>
				<Icon name={icon} size={size === "sm" ? 16 : 18} />
			</BaseButton>
		</Tooltip>
	);
};

/** Buttons side by side (wrapping), or stacked full-width with `vertical`. */
export const ButtonGroup = ({
	children,
	vertical,
}: {
	children: ReactNode;
	vertical?: boolean;
}) => {
	return (
		<div className={styles.buttonGroup} data-vertical={vertical || undefined}>
			{children}
		</div>
	);
};

/** A row of icon buttons, e.g. in a section header. */
export const IconButtonGroup = ({ children }: { children: ReactNode }) => {
	return <div className={styles.group}>{children}</div>;
};
