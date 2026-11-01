import { useSyncExternalStore } from "react";

/** The toolbar's phone width. Keep in sync with the `max-width: 700px` rules in Toolbar.module.css and AppMenu.module.css. */
const QUERY = "(max-width: 700px)";

const subscribe = (onChange: () => void) => {
	const media = window.matchMedia(QUERY);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
};

/** Whether the toolbar is at its phone width: no room for the app menu's logo, so File holds its items. */
export const useNarrowToolbar = () =>
	useSyncExternalStore(
		subscribe,
		() => window.matchMedia(QUERY).matches,
		() => false,
	);
