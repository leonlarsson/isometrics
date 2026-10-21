import { useEffect, useSyncExternalStore } from "react";

import { resolveTheme, scenePalettes, type TResolvedTheme } from "#/scene/theme";

import { useEditor } from "./store";

const QUERY = "(prefers-color-scheme: dark)";

const subscribe = (callback: () => void) => {
	const media = window.matchMedia(QUERY);
	media.addEventListener("change", callback);
	return () => media.removeEventListener("change", callback);
};

const prefersDark = () => window.matchMedia(QUERY).matches;

export const useResolvedTheme = (): TResolvedTheme => {
	const preference = useEditor((s) => s.scene.theme);
	const dark = useSyncExternalStore(subscribe, prefersDark, () => false);
	return resolveTheme(preference, dark);
};

export const usePalette = () => {
	return scenePalettes[useResolvedTheme()];
};

/** Mirror the resolved theme onto <html data-theme> so CSS tokens follow it. */
export const useThemeAttribute = () => {
	const theme = useResolvedTheme();
	useEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [theme]);
};
