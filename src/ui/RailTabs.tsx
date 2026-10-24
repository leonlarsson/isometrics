import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { Fragment, type ReactNode } from "react";

import { Icon, type TIconName } from "./Icon";
import { Tooltip } from "./Tooltip";

import styles from "./RailTabs.module.css";

export interface IRailTab<TValue extends string> {
	value: TValue;
	/** The tab's name: its tooltip and accessible name. */
	label: string;
	icon: TIconName;
}

interface IRailTabsProps<TValue extends string> {
	value: TValue;
	onChange: (value: TValue) => void;
	/** The tabs in groups, with a divider between groups. Empty groups are skipped. */
	groups: IRailTab<TValue>[][];
	/** Accessible name of the tab list. */
	label: string;
	/** A strip of icons down the left (wide panels), or a bar along the top that scrolls (phones). */
	orientation?: "vertical" | "horizontal";
	/** At the end of a horizontal bar, e.g. the sheet's hide button. */
	barEnd?: ReactNode;
	/** Beside or under the strip: a header and the tab's RailTabPanel. */
	children: ReactNode;
}

/**
 * Icon tabs on a rail, like the tabs down the side of Blender's properties
 * editor (ADR-0054), built on Base UI's Tabs (ADR-0024). Each icon names its
 * tab in a tooltip; adding a menu is adding an icon.
 */
export const RailTabs = <TValue extends string>({
	value,
	onChange,
	groups,
	label,
	orientation = "vertical",
	barEnd,
	children,
}: IRailTabsProps<TValue>) => {
	const shown = groups.filter((group) => group.length > 0);
	return (
		<BaseTabs.Root
			className={styles.root}
			data-orientation={orientation}
			orientation={orientation}
			value={value}
			onValueChange={(next) => onChange(next as TValue)}
		>
			<div className={styles.rail}>
				<BaseTabs.List className={styles.list} aria-label={label}>
					{shown.map((group, index) => (
						<Fragment key={group[0].value}>
							{index > 0 && <span className={styles.divider} aria-hidden="true" />}

							{group.map((tab) => (
								<Tooltip
									key={tab.value}
									label={tab.label}
									side={orientation === "vertical" ? "left" : "top"}
								>
									<BaseTabs.Tab value={tab.value} className={styles.tab} aria-label={tab.label}>
										<Icon name={tab.icon} size={18} />
									</BaseTabs.Tab>
								</Tooltip>
							))}
						</Fragment>
					))}
				</BaseTabs.List>

				{barEnd && <div className={styles.barEnd}>{barEnd}</div>}
			</div>

			<div className={styles.content}>{children}</div>
		</BaseTabs.Root>
	);
};

/** One tab's content. Only render the open tab's. */
export const RailTabPanel = ({ value, children }: { value: string; children: ReactNode }) => {
	return (
		<BaseTabs.Panel value={value} className={styles.panel}>
			{children}
		</BaseTabs.Panel>
	);
};
