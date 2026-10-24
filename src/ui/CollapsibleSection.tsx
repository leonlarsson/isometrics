import { Collapsible } from "@base-ui/react/collapsible";
import type { ReactNode } from "react";

import { Icon, type TIconName } from "./Icon";

import styles from "./CollapsibleSection.module.css";

interface ICollapsibleSectionProps {
	label: string;
	/** Shown before the label. */
	icon?: TIconName;
	/** Shown muted after the label, e.g. how many items the section holds. */
	count?: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
}

/**
 * A titled group in a list whose heading folds it shut (Base UI Collapsible,
 * ADR-0024). The heading stays at the top while the group scrolls under it.
 */
export const CollapsibleSection = ({
	label,
	icon,
	count,
	open,
	onOpenChange,
	children,
}: ICollapsibleSectionProps) => {
	return (
		<Collapsible.Root className={styles.section} open={open} onOpenChange={onOpenChange}>
			<h3 className={styles.heading}>
				<Collapsible.Trigger className={styles.trigger}>
					<span className={styles.chevron}>
						<Icon name="chevronRight" size={12} />
					</span>

					{icon && (
						<span className={styles.icon}>
							<Icon name={icon} size={14} />
						</span>
					)}

					{label}

					{count !== undefined && <span className={styles.count}>{count}</span>}
				</Collapsible.Trigger>
			</h3>

			<Collapsible.Panel className={styles.panel}>{children}</Collapsible.Panel>
		</Collapsible.Root>
	);
};
