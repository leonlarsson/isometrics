import { useState } from "react";

import { APP_NAME } from "#/lib/app";

import { IconButton } from "./Button";

import styles from "./StatusBanner.module.css";

/** This browser has closed the notice (kept with the rest of the site's storage, ADR-0140). */
const NOTICE_CLOSED_KEY = `${APP_NAME.toLowerCase()}:preview-notice-closed`;

const isNoticeClosed = () => {
	try {
		return localStorage.getItem(NOTICE_CLOSED_KEY) !== null;
	} catch {
		return false;
	}
};

/**
 * The early-preview notice above the editor: worlds are kept in this browser only, so say how to
 * keep a copy. Old worlds keep opening (ADR-0106); this is about where they're kept, not about
 * losing them. Closing it is remembered in this browser.
 */
export const StatusBanner = () => {
	const [isClosed, setIsClosed] = useState(isNoticeClosed);
	if (isClosed) {
		return null;
	}
	const close = () => {
		setIsClosed(true);
		try {
			localStorage.setItem(NOTICE_CLOSED_KEY, "1");
		} catch {
			// Storage unavailable: it just shows again next time.
		}
	};
	return (
		<div className={styles.banner} role="status">
			<p className={styles.text}>
				<strong>Early preview.</strong>

				<span className={styles.long}>
					Your worlds are kept in this browser only: use File → Save to file to keep a copy.
				</span>

				<span className={styles.short}>Worlds stay in this browser.</span>
			</p>

			<IconButton icon="close" label="Close this notice" onClick={close} />
		</div>
	);
};
