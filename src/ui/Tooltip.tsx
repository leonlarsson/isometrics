import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

import styles from "./Tooltip.module.css";

/** Shared hover delay, so moving between nearby buttons opens the next tooltip instantly. */
export const TooltipProvider = ({ children }: { children: ReactNode }) => {
	return <BaseTooltip.Provider delay={500}>{children}</BaseTooltip.Provider>;
};

interface ITooltipProps {
	/** What the tooltip says. */
	label: ReactNode;
	/** The element it describes. It must accept a ref and props (a button, a link…). */
	children: ReactElement;
	side?: "top" | "bottom" | "left" | "right";
}

/**
 * A short hint on hover or focus, built on Base UI's Tooltip (ADR-0024).
 * Use it instead of `title` attributes.
 */
export const Tooltip = ({ label, children, side = "top" }: ITooltipProps) => {
	return (
		<BaseTooltip.Root>
			<BaseTooltip.Trigger render={children} />

			<BaseTooltip.Portal>
				<BaseTooltip.Positioner className={styles.positioner} side={side} sideOffset={6}>
					<BaseTooltip.Popup className={styles.popup}>{label}</BaseTooltip.Popup>
				</BaseTooltip.Positioner>
			</BaseTooltip.Portal>
		</BaseTooltip.Root>
	);
};
