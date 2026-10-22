import { APP_NAME } from "#/lib/app";

import styles from "./StatusBanner.module.css";

/**
 * Project status notice shown above the editor while the app is an
 * experimental playground. Saved worlds have no compatibility promise yet:
 * old ones are repaired where possible (ADR-0026), but parts can be lost.
 */
export const StatusBanner = () => (
	<p className={styles.banner} role="status">
		<strong>Work in progress.</strong>

		<span className={styles.long}>
			{APP_NAME} is an experimental playground: things will change and break, and saved worlds, in
			this browser or exported as files, may be lost or only partly open in later versions.
		</span>

		<span className={styles.short}>Things will change, and saved worlds may be lost.</span>
	</p>
);
