import { Icon, type TIconName } from "./Icon";

import styles from "./DataWindow.module.css";

/**
 * What a page in the Data window shows, above its title: "Value", "Table" or
 * "Source", with the icon its card in the list has (ADR-0123), so it's clear
 * what was opened.
 */
export const PageKind = ({ icon, kind }: { icon: TIconName; kind: string }) => (
	<p className={styles.eyebrow}>
		<Icon name={icon} size={13} />

		{kind}
	</p>
);
