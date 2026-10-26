import {
	type TAmbientOcclusion,
	type TAntiAliasing,
	type TGraphicsPreset,
	type TPixelDensity,
	type TPreferences,
	type TRealLightCount,
	usePreferences,
} from "./preferences";

/**
 * Graphics settings (Preferences → Graphics, ADR-0072): how much this
 * browser draws, never saved with a world. A preset sets them all; each one
 * follows it (stored as null) until it's changed. Standard is the view as it
 * always was, at its cost: no effects composer at all.
 */

export interface IGraphics {
	ambientOcclusion: TAmbientOcclusion;
	/** Bloom round bright things, as strong as it's dark (none by day). */
	showGlowAfterDark: boolean;
	/** How many lights, nearest the view, light their surroundings as real lights (0: painted only). */
	realLightCount: TRealLightCount;
	/** Soft-edged shadows (PCSS). */
	useSoftShadows: boolean;
	antiAliasing: TAntiAliasing;
	maxPixelDensity: TPixelDensity;
}

export type TGraphicsSetting = keyof IGraphics;

export const GRAPHICS_SETTINGS: readonly TGraphicsSetting[] = [
	"ambientOcclusion",
	"showGlowAfterDark",
	"realLightCount",
	"useSoftShadows",
	"antiAliasing",
	"maxPixelDensity",
];

export const PRESET_GRAPHICS: Record<TGraphicsPreset, IGraphics> = {
	standard: {
		ambientOcclusion: "off",
		showGlowAfterDark: false,
		realLightCount: 0,
		useSoftShadows: false,
		antiAliasing: "multisample",
		maxPixelDensity: 2,
	},
	nice: {
		ambientOcclusion: "halfResolution",
		showGlowAfterDark: true,
		realLightCount: 16,
		useSoftShadows: false,
		antiAliasing: "smaa",
		maxPixelDensity: 2,
	},
	ultra: {
		ambientOcclusion: "fullResolution",
		showGlowAfterDark: true,
		realLightCount: 64,
		useSoftShadows: true,
		antiAliasing: "smaa",
		maxPixelDensity: 2,
	},
};

/** The settings in effect: each one changed here, or the preset's. */
export const graphicsOf = (preferences: TPreferences): IGraphics => {
	const preset = PRESET_GRAPHICS[preferences.graphicsPreset];
	return {
		ambientOcclusion: preferences.ambientOcclusion ?? preset.ambientOcclusion,
		showGlowAfterDark: preferences.showGlowAfterDark ?? preset.showGlowAfterDark,
		realLightCount: preferences.realLightCount ?? preset.realLightCount,
		useSoftShadows: preferences.useSoftShadows ?? preset.useSoftShadows,
		antiAliasing: preferences.antiAliasing ?? preset.antiAliasing,
		maxPixelDensity: preferences.maxPixelDensity ?? preset.maxPixelDensity,
	};
};

/** How many settings are changed from the preset (set here, to anything). */
export const changedFromPreset = (preferences: TPreferences) =>
	GRAPHICS_SETTINGS.filter((setting) => preferences[setting] !== null).length;

/** Whether the view needs the effects composer: Standard's view never does. */
export const drawsEffects = (graphics: IGraphics) =>
	graphics.ambientOcclusion !== "off" ||
	graphics.showGlowAfterDark ||
	graphics.antiAliasing === "smaa";

/** The graphics settings in effect, kept up to date. */
export const useGraphics = () => graphicsOf(usePreferences());
