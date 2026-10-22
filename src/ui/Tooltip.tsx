import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

import styles from "./Tooltip.module.css";

/**
 * Shared hover delay, so moving between nearby buttons opens the next tooltip
 * instantly. Tooltips close the moment the pointer leaves (no close delay).
 */
export const TooltipProvider = ({ children }: { children: ReactNode }) => {
	return (
		<BaseTooltip.Provider delay={500} closeDelay={0}>
			{children}
		</BaseTooltip.Provider>
	);
};

interface ITooltipProps {
	/** What the tooltip says. */
	label: ReactNode;
	/** The element it describes. It must accept a ref and props (a button, a link…). */
	children: ReactElement;
	side?: "top" | "bottom" | "left" | "right";
	/**
	 * Let the pointer move onto the tooltip without it closing, for a tooltip with
	 * something to read at length or click. Off by default: a plain hint closes as
	 * soon as the pointer leaves its element, so it never covers what's next to it.
	 */
	hoverable?: boolean;
}

/**
 * A short hint on hover or focus, built on Base UI's Tooltip (ADR-0024).
 * Use it instead of `title` attributes.
 */
export const Tooltip = ({ label, children, side = "top", hoverable = false }: ITooltipProps) => {
	return (
		<BaseTooltip.Root disableHoverablePopup={!hoverable}>
			<BaseTooltip.Trigger render={children} />

			<BaseTooltip.Portal>
				<BaseTooltip.Positioner className={styles.positioner} side={side} sideOffset={6}>
					<BaseTooltip.Popup className={styles.popup}>{label}</BaseTooltip.Popup>
				</BaseTooltip.Positioner>
			</BaseTooltip.Portal>
		</BaseTooltip.Root>
	);
};
