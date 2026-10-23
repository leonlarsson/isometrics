import { useEffect, useMemo, useSyncExternalStore } from "react";

import { skyLightAt } from "#/scene/sun";
import { resolveTheme, scenePalettes, type TResolvedTheme } from "#/scene/theme";

import { useSceneHours } from "./dayClock";
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

/**
 * The theme's colours for the world, with how dark it is there (`night`, from
 * the time of day) so parts can light their windows and lamps. Stays the same
 * object until the theme or the darkness (in steps of a tenth) changes.
 */
export const usePalette = () => {
	const base = scenePalettes[useResolvedTheme()];
	const lighting = useEditor((s) => s.scene.lighting);
	const hours = useSceneHours();
	const night = Math.round(skyLightAt(lighting, hours).night * 10) / 10;
	return useMemo(() => (night === 0 ? base : { ...base, night }), [base, night]);
};

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
