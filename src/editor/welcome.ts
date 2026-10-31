import { APP_NAME } from "#/lib/app";

import { listWorlds } from "./persistence";

/**
 * The welcome (ADR-0116): shown once, to a browser that has never kept a
 * world, so people who know the app aren't greeted again. Picking anything or
 * closing it counts as seen; File → Welcome… shows it again any time.
 */
export const WELCOME_SEEN_KEY = `${APP_NAME.toLowerCase()}:welcome-seen`;

/** Whether to greet this browser: never welcomed, and no worlds kept yet. */
export const shouldWelcome = () => {
	try {
		return localStorage.getItem(WELCOME_SEEN_KEY) === null && listWorlds().length === 0;
	} catch {
		// Storage unavailable: nothing can be remembered, so don't greet on every visit.
		return false;
	}
};

/** Note that this browser has been welcomed. */
export const markWelcomed = () => {
	try {
		localStorage.setItem(WELCOME_SEEN_KEY, "1");
	} catch {
		// Storage unavailable: it just shows again next time.
	}
};
