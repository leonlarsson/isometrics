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
	DEFAULT_PREFERENCES,
	GRAPHICS_PRESETS,
	PIXEL_DENSITIES,
	preferencesChanged,
	REAL_LIGHT_COUNTS,
	resetPreferences,
	setPreference,
	type TAmbientOcclusion,
	type TAntiAliasing,
	type TGraphicsPreset,
	type TPixelDensity,
	type TPreferences,
	type TRealLightCount,
} from "#/editor/preferences";

import { SelectField, SwitchField } from "./fields";
import type { ISettingsPage } from "./SettingsDialog";

const PRESET_LABELS: Record<TGraphicsPreset, string> = {
	standard: "Standard",
	nice: "Nice",
	ultra: "Ultra",
};

const PRESET_HINTS: Record<TGraphicsPreset, string> = {
	standard: "The view as it always was, for any device.",
	nice: "Darker where things meet, and a glow round lights after dark. For a good graphics card.",
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
