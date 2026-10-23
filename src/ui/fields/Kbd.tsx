import type { ReactNode } from "react";

import styles from "./Fields.module.css";

/** A keyboard key, e.g. <Kbd>Enter</Kbd>. */
export const Kbd = ({ children }: { children: ReactNode }) => {
	return <kbd className={styles.kbd}>{children}</kbd>;
};
