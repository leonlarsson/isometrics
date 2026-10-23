import type { ReactNode } from "react";

import styles from "./Fields.module.css";

/** Muted helper text under a field or at the end of a section. */
export const Hint = ({ children }: { children: ReactNode }) => {
	return <p className={styles.hint}>{children}</p>;
};
