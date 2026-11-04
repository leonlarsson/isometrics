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
import { useEditor } from "./store";

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
	/** How many lights in view light their surroundings as real lights (0: painted only; ADR-0144). */
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
		boatWakes: "foamAndWaves",
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
export const drawsEffects = (graphics: TDrawnGraphics) =>
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

/**
 * What the view draws with: the graphics settings, or a still picture's, whose shadows go further
 * and which may have more real lights than the live view offers (ADR-0144).
 */
export type TDrawnGraphics = Omit<IGraphics, "shadowMapSize" | "realLightCount"> & {
	shadowMapSize: number;
	realLightCount: number;
};

/** The most real lights the live view offers (Real lights at night). */
export const MOST_LIVE_REAL_LIGHTS: TRealLightCount = 64;

/**
 * The most real lights a still picture has (ADR-0144): a common graphics card's room for them in
 * a shader (1,024 uniform vectors, less what the rest of a material takes; render/RealLights caps
 * it by the card's own), and plenty to light a big town's lamps in a picture of it.
 */
export const MOST_RENDER_REAL_LIGHTS = 192;

/**
 * How much lighting work, lights times pixels, a still picture may ask for: as much as the biggest
 * picture already did with the live view's most lights (the browser's 2²⁵ pixels, 64 lights).
 * Every pixel works through every light, and a frame that keeps a weak card busy for seconds
 * resets it.
 */
const RENDER_LIGHT_PIXELS = MOST_LIVE_REAL_LIGHTS * 2 ** 25;

/**
 * How many real lights a still picture of `pixels` drawn pixels has (its size times its smoothing,
 * squared): as many as keep its lighting work within that of the biggest picture with the live
 * view's most, between those 64 and MOST_RENDER_REAL_LIGHTS.
 */
export const realLightsForPicture = (pixels: number) =>
	Math.max(
		MOST_LIVE_REAL_LIGHTS,
		Math.min(MOST_RENDER_REAL_LIGHTS, Math.floor(RENDER_LIGHT_PIXELS / Math.max(1, pixels))),
	);

/**
 * What a still picture is drawn with (Render a picture…, ADR-0084): Ultra and beyond, as it
 * needn't keep up with a moving view; its own pixel density, set by the render, and its own
 * number of real lights, by its size (realLightsForPicture).
 */
export const RENDER_GRAPHICS: TDrawnGraphics = {
	...PRESET_GRAPHICS.ultra,
	realLightCount: MOST_RENDER_REAL_LIGHTS,
	// Sharper than any live view's.
	shadowMapSize: 8192,
	boatWakes: "foamAndWaves",
};

/** What the view draws with (drawnGraphicsOf, or the render's while a still renders), kept up to date. */
export const useGraphics = (): TDrawnGraphics => {
	const graphics = drawnGraphicsOf(usePreferences());
	// The picture's drawn pixels while one renders, else null.
	const picturePixels = useEditor((s) =>
		s.stillRender === null
			? null
			: s.stillRender.width * s.stillRender.height * s.stillRender.smoothing ** 2,
	);
	return picturePixels === null
		? graphics
		: {
				...RENDER_GRAPHICS,
				realLightCount: realLightsForPicture(picturePixels),
				maxPixelDensity: graphics.maxPixelDensity,
			};
};
