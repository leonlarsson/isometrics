/**
 * Whether this browser lets the site keep anything (ADR-0145). When site data
 * is blocked (a browser setting, some private modes, an embedded page), even
 * looking at `localStorage` throws, `typeof localStorage` included, so
 * anything that reads storage while the app loads asks this first, and the app
 * opens anyway, saying nothing will be kept. No React.
 */

/** The kinds of storage the app uses. */
export type TStorageKind = "localStorage" | "sessionStorage";

/** Whether `kind` can be read without throwing (on the server, in tests without it: false). */
export const storageAvailable = (kind: TStorageKind = "localStorage"): boolean => {
	try {
		const storage = globalThis[kind] as Storage | undefined;
		if (!storage) {
			return false;
		}
		storage.getItem("");
		return true;
	} catch {
		return false;
	}
};
