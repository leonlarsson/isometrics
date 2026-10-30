import { mixColor } from "#/lib/color";

import type { TBackdrop, TLighting, TSky } from "./schema";
import { CLASSIC_SUN, darknessAt, moonPositionFor, skyLightAt, sunPositionAt } from "./sun";

/**
 * The sky around the world in perspective, and the backdrop behind the
 * isometric diorama (ADR-0070): what colours and lights they show for a world
 * at an hour (null = classic daylight). Framework-free and tested;
 * render/SkyDome and render/Clouds draw the sky, ui/AppShell the backdrop.
 */

interface ISkyKey {
	hour: number;
	/** The sky's colour straight up, and at the horizon. */
	colorOverhead: string;
	colorAtHorizon: string;
}

/** The sky's colours through a day; they blend between keys, and midnight wraps round. */
const SKY_KEYS: ISkyKey[] = [
	{ hour: 0, colorOverhead: "#070b1f", colorAtHorizon: "#1b2347" },
	{ hour: 4.5, colorOverhead: "#0b1130", colorAtHorizon: "#2a2f5a" },
	{ hour: 5.5, colorOverhead: "#2b2f63", colorAtHorizon: "#b0718a" },
	{ hour: 6.3, colorOverhead: "#5b7fc2", colorAtHorizon: "#f6b98f" },
	{ hour: 8, colorOverhead: "#6fa3e0", colorAtHorizon: "#d8e6f2" },
	{ hour: 12.75, colorOverhead: "#4f8fdc", colorAtHorizon: "#cfe3f5" },
	{ hour: 17, colorOverhead: "#5d93d8", colorAtHorizon: "#e3e6e6" },
	{ hour: 18.6, colorOverhead: "#4f74b8", colorAtHorizon: "#f6c38b" },
	{ hour: 19.4, colorOverhead: "#343d7c", colorAtHorizon: "#e07f6d" },
	{ hour: 20.3, colorOverhead: "#161c48", colorAtHorizon: "#5a4a80" },
	{ hour: 21.5, colorOverhead: "#090e26", colorAtHorizon: "#1d2448" },
];

/** The classic studio daylight's sky (no time of day): a clear, soft blue. */
const CLASSIC_SKY = { colorOverhead: "#5b97dd", colorAtHorizon: "#d6e7f5" };

/** The sky's own colours at an hour, blended between the two keys around it. */
export const skyColorsAt = (hour: number | null) => {
	if (hour === null) {
		return CLASSIC_SKY;
	}
	const h = ((hour % 24) + 24) % 24;
	const next = SKY_KEYS.findIndex((key) => key.hour > h);
	const a = SKY_KEYS[(next === -1 ? SKY_KEYS.length : next) - 1];
	const b = next === -1 ? { ...SKY_KEYS[0], hour: 24 } : SKY_KEYS[next];
	const t = (h - a.hour) / (b.hour - a.hour);
	return {
		colorOverhead: mixColor(a.colorOverhead, b.colorOverhead, t),
		colorAtHorizon: mixColor(a.colorAtHorizon, b.colorAtHorizon, t),
	};
};

export interface ISkyLook {
	colorOverhead: string;
	colorAtHorizon: string;
	/** The sun's disc, where the sunlight comes from; null when it's hidden or below the horizon. */
	sunDisc: { azimuth: number; elevation: number; color: string } | null;
	/** The moon's disc at night, opposite the sun; null when hidden or by day. */
	moonDisc: { azimuth: number; elevation: number } | null;
	/** How bright the stars are, 0–1: the world's star density, as dark as it is. */
	starBrightness: number;
	/** How cloudy (0–1), the clouds' colour and how fast they drift. */
	cloudCover: number;
	cloudColor: string;
	cloudSpeed: number;
}

/** What the weather brings to the sky (ADR-0102): its clouds, and how overcast it is (0–1). */
export interface ISkyWeather {
	cloudCover: number;
	cloudColor: string | null;
	cloudSpeed: number;
	overcast: number;
}

/** A world's weather as it comes: a few white clouds drifting, nothing overcast. */
export const DEFAULT_SKY_WEATHER: ISkyWeather = {
	cloudCover: 0.3,
	cloudColor: null,
	cloudSpeed: 1,
	overcast: 0,
};

/**
 * The sky for a world at an hour (null = classic daylight): its colours (set
 * ones by day, darkening at night; else the time of day's), the sun where the light comes from (Sun &
 * sky's direction and height count), the moon and stars as it gets dark, and
 * the weather's clouds tinted like the light. Weather's overcast (ADR-0102)
 * greys the sky, hides the sun and stars and gathers more and greyer clouds.
 */
export const skyLookAt = (
	lighting: TLighting,
	sky: TSky,
	hour: number | null,
	{
		cloudCover,
		cloudColor: setCloudColor,
		cloudSpeed,
		overcast,
	}: ISkyWeather = DEFAULT_SKY_WEATHER,
): ISkyLook => {
	const colors = skyColorsAt(hour);
	const light = skyLightAt(lighting, hour, overcast);
	const sunNow = hour === null ? CLASSIC_SUN : sunPositionAt(hour);
	const sun = {
		azimuth: lighting.sunAzimuth ?? sunNow.azimuth,
		elevation: lighting.sunElevation ?? sunNow.elevation,
	};
	const darkness = hour === null ? 0 : darknessAt(hour);
	const daylit = sun.elevation > -2;
	/** A colour set by hand is the sky's by day: it darkens towards the time of day's at night. */
	const byNight = (set: string | null, fromTime: string) =>
		set === null ? fromTime : mixColor(set, fromTime, darkness * 0.9);
	/** A colour greyed by the overcast: towards a grey that darkens with the night. */
	const greyed = (color: string, grey: string) =>
		overcast <= 0 ? color : mixColor(color, mixColor(grey, "#1a1e26", darkness), 0.7 * overcast);
	const cloudColor =
		setCloudColor ??
		mixColor(mixColor("#ffffff", light.tint, light.tintAmount), "#56608a", darkness * 0.8);
	return {
		colorOverhead: greyed(byNight(sky.colorOverhead, colors.colorOverhead), "#9aa3ad"),
		colorAtHorizon: greyed(byNight(sky.colorAtHorizon, colors.colorAtHorizon), "#c3c9cf"),
		sunDisc: sky.showsSun && daylit && overcast < 0.6 ? { ...sun, color: light.color } : null,
		moonDisc:
			sky.showsMoon && darkness > 0.3 && overcast < 0.6 ? moonPositionFor(sun.azimuth) : null,
		starBrightness: sky.starDensity * darkness * (1 - overcast),
		cloudCover: Math.max(cloudCover, 0.85 * overcast),
		// White clouds take on the light's colour, and a moonlit grey-blue at night; greyer overcast.
		cloudColor: overcast <= 0 ? cloudColor : mixColor(cloudColor, "#8a929c", 0.6 * overcast),
		cloudSpeed,
	};
};

/** Pure green, the colour video editors key out. */
export const GREEN_SCREEN = "#00ff00";

/** Behind the world in the diorama: a CSS background, or null for the sky's colour (as before). */
export const backdropBackground = (backdrop: TBackdrop, themeBackground: string) => {
	switch (backdrop.kind) {
		case "sky":
			return null;
		case "color":
			return backdrop.color ?? themeBackground;
		case "gradient":
			return `linear-gradient(${backdrop.gradientAngle}deg, ${backdrop.gradientStart ?? themeBackground}, ${backdrop.gradientEnd ?? themeBackground})`;
		case "greenScreen":
			return GREEN_SCREEN;
	}
};

/**
 * The sky's colour behind the isometric diorama at an hour (ADR-0052), and how much of it shows
 * over the theme's background: none at noon, more as the light colours (dawn, golden hour),
 * almost all at dusk and night. Null with the classic daylight, which has no sky colour.
 */
export const dioramaSkyAt = (lighting: TLighting, hour: number | null, overcast = 0) => {
	const light = skyLightAt(lighting, hour, overcast);
	if (!light.sky) {
		return null;
	}
	return {
		color: light.sky,
		weight: Math.min(0.9, 0.9 * Math.max(light.night, light.tintAmount * 1.2, overcast * 0.8)),
	};
};
