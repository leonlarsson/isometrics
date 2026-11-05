import { useSyncExternalStore } from "react";

/*
 * The device's theme on its own, without the editor's store: pages without a
 * world (the guide, the parts catalogue) read it from here, so they don't load
 * the editor to know it.
 */

const QUERY = "(prefers-color-scheme: dark)";

const subscribe = (callback: () => void) => {
	const media = window.matchMedia(QUERY);
	media.addEventListener("change", callback);
	return () => media.removeEventListener("change", callback);
};

const prefersDark = () => window.matchMedia(QUERY).matches;

/** Whether the device asks for dark colours (the system theme), following it as it changes. */
export const usePrefersDark = () => useSyncExternalStore(subscribe, prefersDark, () => false);
