import { Collapsible } from "@base-ui/react/collapsible";
import type { ReactNode } from "react";

import { setPanelOpen, usePanelOpen } from "#/editor/panelMemory";

import { Icon, type TIconName } from "../Icon";

import { matchesSearch, useSettingsSearch } from "./settingsSearch";

import styles from "./Fields.module.css";

interface ISectionProps {
	title: string;
	children: ReactNode;
	/** Controls on the right of the title, e.g. an IconButtonGroup or a switch. */
	actions?: ReactNode;
	/** Shown before the title. */
	icon?: TIconName;
	/**
	 * Makes the panel foldable, remembering in this browser whether it's open.
	 * Unique and stable, e.g. "look.colours". Without one it's always open.
	 */
	id?: string;
	/** Folded until it's opened for the first time. */
	defaultClosed?: boolean;
	/** More words that find the whole panel in the settings search. */
	keywords?: string;
}

/**
 * A panel: a card with a header band (icon, title, actions) over its fields.
 * With an `id`, clicking the header folds it, like Blender's panels. During a
 * settings search it's open, shows only the fields that match (or all of
 * them when its title does), and hides when nothing in it matches (ADR-0054).
 */
export const Section = ({
	title,
	children,
	actions,
	icon,
	id,
	defaultClosed = false,
	keywords = "",
}: ISectionProps) => {
	const query = useSettingsSearch();
	const remembered = usePanelOpen(id ?? "", !defaultClosed);
	const searching = query !== "";
	const open = !id || searching || remembered;
	const heading = (
		<>
			{id && (
				<span className={styles.sectionChevron}>
					<Icon name="chevronRight" size={12} />
				</span>
			)}

			{icon && (
				<span className={styles.sectionIcon}>
					<Icon name={icon} size={15} />
				</span>
			)}

			<h3>{title}</h3>
		</>
	);
	return (
		<Collapsible.Root
			render={<section />}
			className={styles.section}
			open={open}
			onOpenChange={(next) => id && !searching && setPanelOpen(id, next)}
			data-searching={searching || undefined}
			data-title-match={(searching && matchesSearch(`${title} ${keywords}`, query)) || undefined}
		>
			<header className={styles.sectionHeader}>
				{id ? (
					<Collapsible.Trigger className={styles.sectionTrigger}>{heading}</Collapsible.Trigger>
				) : (
					<div className={styles.sectionTrigger}>{heading}</div>
				)}

				{actions && <div className={styles.sectionActions}>{actions}</div>}
			</header>

			<Collapsible.Panel className={styles.sectionBody}>{children}</Collapsible.Panel>
		</Collapsible.Root>
	);
};
