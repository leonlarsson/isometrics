import {
	changedFromPreset,
	GRAPHICS_SETTINGS,
	graphicsOf,
	PRESET_GRAPHICS,
	type TGraphicsSetting,
} from "#/editor/graphics";
import {
	AMBIENT_OCCLUSION_MODES,
	ANTI_ALIASING_MODES,
	BOAT_WAKE_MODES,
	DEFAULT_PREFERENCES,
	GRAPHICS_PRESETS,
	PIXEL_DENSITIES,
	preferencesChanged,
	REAL_LIGHT_COUNTS,
	resetPreferences,
	SHADOW_MAP_SIZES,
	setPreference,
	type TAmbientOcclusion,
	type TAntiAliasing,
	type TBoatWakes,
	type TGraphicsPreset,
	type TPixelDensity,
	type TPreferences,
	type TRealLightCount,
	type TShadowMapSize,
} from "#/editor/preferences";

import { SelectField, SwitchField } from "./fields";
import type { ISettingsPage } from "./SettingsDialog";

const PRESET_LABELS: Record<TGraphicsPreset, string> = {
	standard: "Standard",
	nice: "Nice",
	ultra: "Ultra",
};

const BOAT_WAKE_LABELS: Record<TBoatWakes, string> = {
	off: "Off",
	foam: "Foam",
};

const PRESET_HINTS: Record<TGraphicsPreset, string> = {
	standard: "The view as it always was, for any device.",
	nice: "Darker where things meet, a glow round lights after dark, and the world mirrored in the water. For a good graphics card.",
	ultra: "Nice, sharper and with soft-edged shadows. For a strong graphics card.",
};

const AMBIENT_OCCLUSION_LABELS: Record<TAmbientOcclusion, string> = {
	off: "Off",
	halfResolution: "Half resolution",
	fullResolution: "Full resolution",
};

const ANTI_ALIASING_LABELS: Record<TAntiAliasing, string> = {
	multisample: "Multisampling (4×)",
	smaa: "SMAA",
};

const onOff = (value: boolean) => (value ? "on" : "off");

/** The Graphics page's settings, for resetting the page. */
const GRAPHICS_PAGE: (keyof TPreferences)[] = ["graphicsPreset", ...GRAPHICS_SETTINGS];

/**
 * A graphics setting's From preset / Reset (ADR-0027, ADR-0072): it follows
 * the preset while it's null.
 */
const fromPreset = (preferences: TPreferences, setting: TGraphicsSetting, value: string) => ({
	from: "preset",
	inherited: preferences[setting] === null,
	onReset: () => setPreference(setting, null),
	value,
});

/**
 * Preferences → Graphics (ADR-0072): how much this browser draws, like a
 * game's graphics settings. A preset, and the settings it sets, each of which
 * follows it until changed.
 */
export const graphicsPage = (preferences: TPreferences): ISettingsPage => {
	const preset = PRESET_GRAPHICS[preferences.graphicsPreset];
	const graphics = graphicsOf(preferences);
	const changed = changedFromPreset(preferences);
	return {
		id: "graphics",
		label: "Graphics",
		icon: "star",
		reset: {
			onReset: () => resetPreferences(GRAPHICS_PAGE),
			changed: preferencesChanged(preferences, GRAPHICS_PAGE),
		},
		groups: [
			{
				title: "Quality",
				rows: [
					{
						id: "graphicsPreset",
						keywords: "quality graphics standard nice ultra performance fast effects",
						field: (
							<SelectField<TGraphicsPreset>
								label="Preset"
								value={preferences.graphicsPreset}
								options={GRAPHICS_PRESETS.map((value) => ({ value, label: PRESET_LABELS[value] }))}
								onChange={(value) => setPreference("graphicsPreset", value)}
								inherit={{
									from: "default",
									inherited: preferences.graphicsPreset === DEFAULT_PREFERENCES.graphicsPreset,
									onReset: () =>
										setPreference("graphicsPreset", DEFAULT_PREFERENCES.graphicsPreset),
									value: PRESET_LABELS[DEFAULT_PREFERENCES.graphicsPreset],
								}}
								hint={`${PRESET_HINTS[preferences.graphicsPreset]}${
									changed > 0
										? ` ${changed === 1 ? "1 setting below is" : `${changed} settings below are`} changed from it.`
										: ""
								}`}
							/>
						),
					},
				],
				note: "Standard draws every world as it always looked. The other settings can make the view slower on a weak graphics card or a phone.",
			},
			{
				title: "Effects",
				rows: [
					{
						id: "ambientOcclusion",
						keywords: "ao shading contact shadows depth corners darker",
						field: (
							<SelectField<TAmbientOcclusion>
								label="Ambient occlusion"
								value={graphics.ambientOcclusion}
								options={AMBIENT_OCCLUSION_MODES.map((value) => ({
									value,
									label: AMBIENT_OCCLUSION_LABELS[value],
								}))}
								onChange={(value) => setPreference("ambientOcclusion", value)}
								inherit={fromPreset(
									preferences,
									"ambientOcclusion",
									AMBIENT_OCCLUSION_LABELS[preset.ambientOcclusion].toLowerCase(),
								)}
								hint="Darker where things meet the ground and each other, so they sit in the world. Full resolution is finer and costs more."
							/>
						),
					},
					{
						id: "showGlowAfterDark",
						keywords: "bloom glow night lights windows lamps headlights",
						field: (
							<SwitchField
								label="Glow after dark"
								checked={graphics.showGlowAfterDark}
								onChange={(value) => setPreference("showGlowAfterDark", value)}
								inherit={fromPreset(
									preferences,
									"showGlowAfterDark",
									onOff(preset.showGlowAfterDark),
								)}
								hint="A soft glow round lit windows, lamps and headlights, as strong as it's dark: none by day."
							/>
						),
					},
					{
						id: "realLightCount",
						keywords: "real lights night lamps windows headlights point lights illuminate streets",
						field: (
							<SelectField<`${TRealLightCount}`>
								label="Real lights at night"
								value={`${graphics.realLightCount}`}
								options={REAL_LIGHT_COUNTS.map((count) => ({
									value: `${count}`,
									label: count === 0 ? "None (painted glows only)" : `${count} nearest the view`,
								}))}
								onChange={(value) =>
									setPreference("realLightCount", Number(value) as TRealLightCount)
								}
								inherit={fromPreset(
									preferences,
									"realLightCount",
									preset.realLightCount === 0 ? "none" : `${preset.realLightCount}`,
								)}
								hint="Lamps, lit windows, cabins and headlights light the streets, walls and water round them. Each one costs a little on every surface it reaches."
							/>
						),
					},
					{
						id: "showWaterReflections",
						keywords: "water reflection mirror ripples river sea harbour",
						field: (
							<SwitchField
								label="Water reflections"
								checked={graphics.showWaterReflections}
								onChange={(value) => setPreference("showWaterReflections", value)}
								inherit={fromPreset(
									preferences,
									"showWaterReflections",
									onOff(preset.showWaterReflections),
								)}
								hint="Water mirrors the world round it, broken up by drifting ripples. Draws the world once more, for all the water."
							/>
						),
					},
					{
						id: "boatWakes",
						keywords: "boat wake foam trail water ship yacht ferry waves",
						field: (
							<SelectField<TBoatWakes>
								label="Boat wakes"
								value={graphics.boatWakes}
								options={BOAT_WAKE_MODES.map((value) => ({
									value,
									label: BOAT_WAKE_LABELS[value],
								}))}
								onChange={(value) => setPreference("boatWakes", value)}
								inherit={fromPreset(
									preferences,
									"boatWakes",
									BOAT_WAKE_LABELS[preset.boatWakes].toLowerCase(),
								)}
								hint="Boats on a route leave a trail of foam behind them, longer the faster they go."
							/>
						),
					},
					{
						id: "useColorGrade",
						keywords: "colour color grade grading saturation contrast vignette cinematic warm",
						field: (
							<SwitchField
								label="Colour grade"
								checked={graphics.useColorGrade}
								onChange={(value) => setPreference("useColorGrade", value)}
								inherit={fromPreset(preferences, "useColorGrade", onOff(preset.useColorGrade))}
								hint="Richer colour, a touch more contrast and a soft vignette; after dark, cooler shadows against warmer lights."
							/>
						),
					},
					{
						id: "showDistanceHaze",
						keywords: "haze fog mist atmosphere distance depth aerial perspective",
						field: (
							<SwitchField
								label="Distance haze"
								checked={graphics.showDistanceHaze}
								onChange={(value) => setPreference("showDistanceHaze", value)}
								inherit={fromPreset(
									preferences,
									"showDistanceHaze",
									onOff(preset.showDistanceHaze),
								)}
								hint="In perspective, far things fade into the sky's colour at the horizon, for depth."
							/>
						),
					},
					{
						id: "useSoftShadows",
						keywords: "pcss shadow blur penumbra soft edges",
						field: (
							<SwitchField
								label="Soft shadows"
								checked={graphics.useSoftShadows}
								onChange={(value) => setPreference("useSoftShadows", value)}
								inherit={fromPreset(preferences, "useSoftShadows", onOff(preset.useSoftShadows))}
								hint="Shadows with soft edges, sharper close to what casts them."
							/>
						),
					},
					{
						id: "shadowMapSize",
						keywords: "shadow resolution sharp detail map quality",
						field: (
							<SelectField<`${TShadowMapSize}`>
								label="Shadow detail"
								value={`${graphics.shadowMapSize}`}
								options={SHADOW_MAP_SIZES.map((size) => ({
									value: `${size}`,
									label: size === 2048 ? "Standard" : "High",
								}))}
								onChange={(value) =>
									setPreference("shadowMapSize", Number(value) as TShadowMapSize)
								}
								inherit={fromPreset(
									preferences,
									"shadowMapSize",
									preset.shadowMapSize === 2048 ? "standard" : "high",
								)}
								hint="How sharp the sun's shadows are: High draws them from four times as many pixels."
							/>
						),
					},
				],
			},
			{
				title: "Sharpness",
				rows: [
					{
						id: "antiAliasing",
						keywords: "aa msaa smaa jagged edges smooth",
						field: (
							<SelectField<TAntiAliasing>
								label="Anti-aliasing"
								value={graphics.antiAliasing}
								options={ANTI_ALIASING_MODES.map((value) => ({
									value,
									label: ANTI_ALIASING_LABELS[value],
								}))}
								onChange={(value) => setPreference("antiAliasing", value)}
								inherit={fromPreset(
									preferences,
									"antiAliasing",
									ANTI_ALIASING_LABELS[preset.antiAliasing],
								)}
								hint="How jagged edges are smoothed. SMAA is quicker with ambient occlusion."
							/>
						),
					},
					{
						id: "maxPixelDensity",
						keywords: "resolution retina hidpi dpr pixel ratio sharp blurry performance",
						field: (
							<SelectField<`${TPixelDensity}`>
								label="Highest pixel density"
								value={`${graphics.maxPixelDensity}`}
								options={PIXEL_DENSITIES.map((density) => ({
									value: `${density}`,
									label: `${density}×`,
								}))}
								onChange={(value) =>
									setPreference("maxPixelDensity", Number(value) as TPixelDensity)
								}
								inherit={fromPreset(preferences, "maxPixelDensity", `${preset.maxPixelDensity}×`)}
								hint="On a sharp (high-density) screen, how many pixels the view draws for each one: fewer is quicker and softer."
							/>
						),
					},
				],
			},
		],
	};
};
