import { Link } from "@tanstack/react-router";

import styles from "./NotFound.module.css";

/** Shown for any URL that isn't a page in the app. */
export const NotFound = () => (
	<main className={styles.page}>
		<span className={styles.logo} aria-hidden="true" />

		<h1 className={styles.title}>Page not found</h1>

		<p className={styles.text}>There’s nothing at this address.</p>

		<Link to="/" className={styles.link}>
			Back to the editor
		</Link>
	</main>
);
