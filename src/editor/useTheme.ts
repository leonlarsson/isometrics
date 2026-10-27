import { useEffect, useMemo, useSyncExternalStore } from "react";

import { resolveTheme, scenePalettes, type TResolvedTheme } from "#/scene/theme";

import { useSceneNight } from "./dayClock";
import { useEditor } from "./store";

const QUERY = "(prefers-color-scheme: dark)";

const subscribe = (callback: () => void) => {
	const media = window.matchMedia(QUERY);
	media.addEventListener("change", callback);
	return () => media.removeEventListener("change", callback);
};

const prefersDark = () => window.matchMedia(QUERY).matches;

/** Whether the device asks for dark colours (the system theme), following it as it changes. */
export const usePrefersDark = () => useSyncExternalStore(subscribe, prefersDark, () => false);

export const useResolvedTheme = (): TResolvedTheme => {
	const preference = useEditor((s) => s.scene.theme);
	return resolveTheme(preference, usePrefersDark());
};

/**
 * The theme's colours for the world, with how dark it is there (`night`, from
 * the time of day) so parts can light their windows and lamps. Stays the same
 * object until the theme or the darkness (in steps of a tenth) changes.
 */
export const usePalette = () => {
	const base = scenePalettes[useResolvedTheme()];
	const night = useSceneNight();
	return useMemo(() => (night === 0 ? base : { ...base, night }), [base, night]);
};

/**
 * The theme's colours without the time of day, for the DOM panels (swatches,
 * label pins): they never re-render as the day runs.
 */
export const useThemePalette = () => scenePalettes[useResolvedTheme()];

/**
 * Mirror the resolved theme onto <html data-theme> so CSS tokens follow it, and
 * match the browser's theme-color (address bar on mobile) to the toolbar's --surface.
 */
export const useThemeAttribute = () => {
	const theme = useResolvedTheme();
	useEffect(() => {
		const root = document.documentElement;
		root.dataset.theme = theme;
		const surface = getComputedStyle(root).getPropertyValue("--surface").trim();
		const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		if (meta && surface) {
			meta.content = surface;
		}
	}, [theme]);
};
