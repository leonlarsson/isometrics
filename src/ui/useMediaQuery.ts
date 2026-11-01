import { useSyncExternalStore } from "react";

/** Whether a CSS media query matches, following it as the window changes (false on the server). */
export const useMediaQuery = (query: string) =>
	useSyncExternalStore(
		(onChange) => {
			const media = window.matchMedia(query);
			media.addEventListener("change", onChange);
			return () => media.removeEventListener("change", onChange);
		},
		() => window.matchMedia(query).matches,
		() => false,
	);
