import {
	type TAmbientOcclusion,
	type TAntiAliasing,
	type TBoatWakes,
	type TGraphicsPreset,
	type TPixelDensity,
	type TPreferences,
	type TRealLightCount,
	type TShadowMapSize,
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
	/** Water mirrors the world round it (one more render of the scene, shared by all the water). */
	showWaterReflections: boolean;
	/** What boats driving along a route leave behind them on the water. */
	boatWakes: TBoatWakes;
	/** A colour grade on the finished picture (saturation, contrast, vignette, warm lights at night). */
	useColorGrade: boolean;
	/** In perspective, far things fade into the sky's colour at the horizon. */
	showDistanceHaze: boolean;
	/** Pixels per side of the sun's shadow map: more is sharper. */
	shadowMapSize: TShadowMapSize;
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
	"showWaterReflections",
	"boatWakes",
	"useColorGrade",
	"showDistanceHaze",
	"shadowMapSize",
	"useSoftShadows",
	"antiAliasing",
	"maxPixelDensity",
];

export const PRESET_GRAPHICS: Record<TGraphicsPreset, IGraphics> = {
	standard: {
		ambientOcclusion: "off",
		showGlowAfterDark: false,
		realLightCount: 0,
		showWaterReflections: false,
		boatWakes: "off",
		useColorGrade: false,
		showDistanceHaze: false,
		useSoftShadows: false,
		shadowMapSize: 2048,
		antiAliasing: "multisample",
		maxPixelDensity: 2,
	},
	nice: {
		ambientOcclusion: "halfResolution",
		showGlowAfterDark: true,
		realLightCount: 16,
		showWaterReflections: true,
		boatWakes: "foam",
		useColorGrade: false,
		showDistanceHaze: false,
		useSoftShadows: false,
		shadowMapSize: 2048,
		antiAliasing: "smaa",
		maxPixelDensity: 2,
	},
	ultra: {
		ambientOcclusion: "fullResolution",
		showGlowAfterDark: true,
		realLightCount: 64,
		showWaterReflections: true,
		boatWakes: "foam",
		useColorGrade: true,
		showDistanceHaze: false,
		useSoftShadows: true,
		shadowMapSize: 4096,
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
		showWaterReflections: preferences.showWaterReflections ?? preset.showWaterReflections,
		boatWakes: preferences.boatWakes ?? preset.boatWakes,
		useColorGrade: preferences.useColorGrade ?? preset.useColorGrade,
		showDistanceHaze: preferences.showDistanceHaze ?? preset.showDistanceHaze,
		useSoftShadows: preferences.useSoftShadows ?? preset.useSoftShadows,
		shadowMapSize: preferences.shadowMapSize ?? preset.shadowMapSize,
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
	graphics.antiAliasing === "smaa" ||
	graphics.useColorGrade;

/**
 * What the view draws with: the graphics settings in effect, or in wireframe
 * (ADR-0080) Standard's (no effects, real lights or reflections; its own
 * pixel density).
 */
export const drawnGraphicsOf = (preferences: TPreferences): IGraphics => {
	const graphics = graphicsOf(preferences);
	return preferences.showWireframe
		? { ...PRESET_GRAPHICS.standard, maxPixelDensity: graphics.maxPixelDensity }
		: graphics;
};

/** What the view draws with (drawnGraphicsOf), kept up to date. */
export const useGraphics = () => drawnGraphicsOf(usePreferences());
