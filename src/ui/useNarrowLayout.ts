import { useSyncExternalStore } from "react";

/** The phone and small-tablet layout. Keep in sync with the `max-width: 900px` rules in AppShell.module.css. */
const QUERY = "(max-width: 900px)";

const subscribe = (onChange: () => void) => {
	const media = window.matchMedia(QUERY);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
};

/** Whether the editor uses its narrow layout: the scene full screen with the panels in a bottom sheet. */
export const useNarrowLayout = () =>
	useSyncExternalStore(
		subscribe,
		() => window.matchMedia(QUERY).matches,
		() => false,
	);
