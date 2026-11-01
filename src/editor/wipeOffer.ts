import { APP_NAME } from "#/lib/app";

import { listWorlds } from "./persistence";

/**
 * The fresh-start number (ADR-0059). Bump it in a release that changes the
 * app so much that starting over beats carrying old worlds and settings
 * along: every browser that has worlds and hasn't seen this number is offered,
 * once, to wipe everything (with the app menu's Wipe everything (the logo)'s two confirmations)
 * or to carry on. New visitors and freshly wiped browsers just take the number.
 */
export const FRESH_START = 0;

const KEY = `${APP_NAME.toLowerCase()}:fresh-start-seen`;

/** The fresh-start number this browser last saw (0 if none). */
const seen = () => {
	try {
		const stored = Number(localStorage.getItem(KEY));
		return Number.isFinite(stored) ? stored : 0;
	} catch {
		// Storage unavailable: nothing stored to wipe, so never offer it.
		return Number.POSITIVE_INFINITY;
	}
};

/** Note that this browser has seen the fresh-start number (the current one by default). */
export const markFreshStartSeen = (number = FRESH_START) => {
	try {
		localStorage.setItem(KEY, String(number));
	} catch {
		// Storage unavailable: there's nothing stored to wipe either.
	}
};

/**
 * Whether to offer a fresh start now: the number went up since this browser
 * last saw it, and it has worlds to start over from. A browser with nothing
 * stored takes the number without being asked.
 */
export const shouldOfferFreshStart = (number = FRESH_START) => {
	if (seen() >= number) {
		return false;
	}
	if (listWorlds().length === 0) {
		markFreshStartSeen(number);
		return false;
	}
	return true;
};
