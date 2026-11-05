import { APP_NAME } from "#/lib/app";

import { Button } from "./Button";

import styles from "./NoWebGlScreen.module.css";

/**
 * Shown instead of the editor when the browser can't draw 3D at all (no
 * WebGL 2, ADR-0145), so a newcomer sees what to do rather than the crash
 * screen: turn on hardware acceleration, or try another browser. The guide
 * and the parts catalogue need no 3D view of their own, so they're offered too.
 */
export const NoWebGlScreen = () => (
	<main className={styles.page} role="alert">
		<span className={styles.logo} aria-hidden="true" />

		<h1 className={styles.title}>Your browser can’t draw 3D here</h1>

		<p className={styles.text}>
			{`${APP_NAME} draws its worlds with WebGL 2, and this browser isn’t giving the page any. Nothing is wrong with your world: it’s the browser’s settings, or the browser.`}
		</p>

		<ul className={styles.steps}>
			<li>
				<strong>Turn on hardware acceleration.</strong> In Chrome or Edge: Settings → System → Use
				graphics acceleration when available, then restart the browser. In Firefox: Settings →
				General → Performance, then untick Use recommended performance settings and tick Use
				hardware acceleration when available.
			</li>

			<li>
				<strong>Or try another browser</strong>, an up-to-date Chrome, Edge, Firefox or Safari. Some
				work computers and remote desktops turn 3D off: a personal device may draw it.
			</li>
		</ul>

		<div className={styles.actions}>
			<Button variant="primary" icon="reset" onClick={() => window.location.reload()}>
				Try again
			</Button>
		</div>

		<p className={styles.hint}>Meanwhile, see how a world is made, or what it can be built from:</p>

		<p className={styles.links}>
			<a className={styles.link} href="/guide">
				Read the guide
			</a>

			<a className={styles.link} href="/parts">
				Browse the parts
			</a>
		</p>
	</main>
);
