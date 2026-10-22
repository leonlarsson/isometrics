import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

import styles from "./Tabs.module.css";

interface ITabsProps<TValue extends string> {
	value: TValue;
	onChange: (value: TValue) => void;
	tabs: { value: TValue; label: string }[];
	/** One TabPanel per tab. */
	children: ReactNode;
	/** Keep the tab list at the top of a scrolling panel. */
	sticky?: boolean;
}

/** Segmented tabs with a sliding indicator, built on Base UI's Tabs (ADR-0024). */
export const Tabs = <TValue extends string>({
	value,
	onChange,
	tabs,
	children,
	sticky,
}: ITabsProps<TValue>) => {
	return (
		<BaseTabs.Root
			className={styles.root}
			value={value}
			onValueChange={(next) => onChange(next as TValue)}
		>
			<div className={styles.bar} data-sticky={sticky || undefined}>
				<BaseTabs.List className={styles.list}>
					{tabs.map((tab) => (
						<BaseTabs.Tab key={tab.value} value={tab.value} className={styles.tab}>
							{tab.label}
						</BaseTabs.Tab>
					))}

					<BaseTabs.Indicator className={styles.indicator} />
				</BaseTabs.List>
			</div>

			{children}
		</BaseTabs.Root>
	);
};

interface ITabPanelProps {
	value: string;
	children: ReactNode;
}

export const TabPanel = ({ value, children }: ITabPanelProps) => {
	return (
		<BaseTabs.Panel value={value} className={styles.panel}>
			{children}
		</BaseTabs.Panel>
	);
};
