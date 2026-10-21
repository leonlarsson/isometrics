import { APP_NAME } from "#/lib/app";

import styles from "./StatusBanner.module.css";

/** Project status notice shown above the editor while the app is under heavy development. */
export const StatusBanner = () => (
	<p className={styles.banner} role="status">
		<strong>Work in progress.</strong> {APP_NAME} is under heavy development: things will change and
		will break.
	</p>
);
