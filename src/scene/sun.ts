import { mixColor } from "#/lib/color";
import { toRadians } from "#/lib/math";

import type { TLighting } from "./schema";

/**
 * The time of day as light: where the sun is, its colour and strength, how
 * the sky tints the world, and how dark it is (for lit windows and lamps).
 * Framework-free and tested; render/SceneLights turns it into lights and
 * ui/AppShell into the sky behind the world. See docs/adr/0052-time-of-day.md.
 *
 * Compass directions are as for viewpoints: degrees counter-clockwise from +x
 * seen from above. The sun rises from +x ("east", 0°), passes +z ("south",
 * 270°) and sets towards −x ("west", 180°).
 */

export const SUNRISE = 6;
export const SUNSET = 19.5;
/** How high the sun gets at midday, in degrees. */
const MAX_ELEVATION = 64;
/** The moon: always this high, opposite the sun. */
const MOON_ELEVATION = 38;
const MOON_COLOR = "#9fb3ff";

/** The classic studio daylight (no time of day): the sun as it always was. */
export const CLASSIC_SUN = { azimuth: 326.3, elevation: 58.9 };

/** Where the sun is in the sky, in degrees: below the horizon (elevation under 0) at night. */
export interface ISunPosition {
	azimuth: number;
	elevation: number;
}

interface IKey {
	hour: number;
	/** Colour and strength (1 = full daylight) of the sun, or the moon at night. */
	light: string;
	strength: number;
	/** Fill light from the sky and the ground, relative to daylight. */
	fill: number;
	/** What the sky tints the world with, and how much (0–1). */
	tint: string;
	tintAmount: number;
	/** The sky behind the world. */
	sky: string;
	/** 0 = day, 1 = full night: lights come on. */
	night: number;
}

/** A day in keyframes; the light blends between them. Midnight wraps round. */
const KEYS: IKey[] = [
	{
		hour: 0,
		light: MOON_COLOR,
		strength: 0.18,
		fill: 0.32,
		tint: "#3a4a8a",
		tintAmount: 0.75,
		sky: "#141a33",
		night: 1,
	},
	{
		hour: 4.5,
		light: MOON_COLOR,
		strength: 0.16,
		fill: 0.36,
		tint: "#4a4f86",
		tintAmount: 0.7,
		sky: "#1d2347",
		night: 1,
	},
	{
		hour: 5.5,
		light: "#ff9a6b",
		strength: 0.12,
		fill: 0.5,
		tint: "#8a6f9e",
		tintAmount: 0.55,
		sky: "#6b5c86",
		night: 0.7,
	},
	{
		hour: 6.3,
		light: "#ffa463",
		strength: 0.55,
		fill: 0.7,
		tint: "#ffc29a",
		tintAmount: 0.4,
		sky: "#f1b48f",
		night: 0.25,
	},
	{
		hour: 8,
		light: "#ffe0bb",
		strength: 0.9,
		fill: 0.92,
		tint: "#ffe7cf",
		tintAmount: 0.15,
		sky: "#f4e3d0",
		night: 0,
	},
	{
		hour: 12.75,
		light: "#ffffff",
		strength: 1,
		fill: 1,
		tint: "#ffffff",
		tintAmount: 0,
		sky: "#eef1f3",
		night: 0,
	},
	{
		hour: 17,
		light: "#fff0d6",
		strength: 0.95,
		fill: 0.95,
		tint: "#fff1dd",
		tintAmount: 0.1,
		sky: "#f3e9dc",
		night: 0,
	},
	{
		hour: 18.6,
		light: "#ffae5c",
		strength: 0.7,
		fill: 0.8,
		tint: "#ffcc99",
		tintAmount: 0.35,
		sky: "#f4c592",
		night: 0.1,
	},
	{
		hour: 19.4,
		light: "#ff6f45",
		strength: 0.35,
		fill: 0.62,
		tint: "#d98a8a",
		tintAmount: 0.45,
		sky: "#cc7f86",
		night: 0.45,
	},
	{
		hour: 20.3,
		light: "#7d86d9",
		strength: 0.16,
		fill: 0.42,
		tint: "#5a5a9a",
		tintAmount: 0.6,
		sky: "#3b3c6e",
		night: 0.85,
	},
	{
		hour: 21.5,
		light: MOON_COLOR,
		strength: 0.18,
		fill: 0.34,
		tint: "#3a4a8a",
		tintAmount: 0.75,
		sky: "#171d3b",
		night: 1,
	},
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The keyframe values at an hour, blended between the two around it. */
const keyAt = (hour: number): Omit<IKey, "hour"> => {
	const h = ((hour % 24) + 24) % 24;
	const next = KEYS.findIndex((key) => key.hour > h);
	const a = KEYS[(next === -1 ? KEYS.length : next) - 1];
	const b = next === -1 ? { ...KEYS[0], hour: 24 } : KEYS[next];
	const t = (h - a.hour) / (b.hour - a.hour);
	return {
		light: mixColor(a.light, b.light, t),
		strength: lerp(a.strength, b.strength, t),
		fill: lerp(a.fill, b.fill, t),
		tint: mixColor(a.tint, b.tint, t),
		tintAmount: lerp(a.tintAmount, b.tintAmount, t),
		sky: mixColor(a.sky, b.sky, t),
		night: lerp(a.night, b.night, t),
	};
};

/** How dark it is at an hour from the time of day alone (0 = day, 1 = night), for the stars. */
export const darknessAt = (hour: number) => keyAt(hour).night;

/** Where the moon is when the sun is at `azimuth`: opposite it, always this high. */
export const moonPositionFor = (sunAzimuth: number) => ({
	azimuth: (sunAzimuth + 180) % 360,
	elevation: MOON_ELEVATION,
});

/** Where the sun is at an hour: elevation below 0 at night. */
export const sunPositionAt = (hour: number) => {
	const h = ((hour % 24) + 24) % 24;
	const dayLength = SUNSET - SUNRISE;
	if (h >= SUNRISE && h <= SUNSET) {
		// Across the day it climbs and sinks along a sine, from east (0°/360°) through south (270°)
		// to west (180°).
		const day = (h - SUNRISE) / dayLength;
		return {
			azimuth: (((360 - 180 * day) % 360) + 360) % 360,
			elevation: MAX_ELEVATION * Math.sin(Math.PI * day),
		};
	}
	// At night it carries on evenly below the horizon, from west through north (90°) back to east,
	// as one stretch from sunset to the next sunrise, so nothing jumps at midnight (the moon, which
	// lights the night, stands opposite it).
	const night = ((h - SUNSET + 24) % 24) / (24 - dayLength);
	return {
		azimuth: 180 - 180 * night,
		elevation: -MAX_ELEVATION * Math.sin(Math.PI * night),
	};
};

/** Where the sun is in a world at `hour` (null = the classic studio daylight), with the world's own direction for it. */
export const sunAt = (
	lighting: Pick<TLighting, "sunAzimuth" | "sunElevation">,
	hour: number | null,
): ISunPosition => {
	const base = hour === null ? CLASSIC_SUN : sunPositionAt(hour);
	return {
		azimuth: lighting.sunAzimuth ?? base.azimuth,
		elevation: lighting.sunElevation ?? base.elevation,
	};
};

export interface ISkyLight {
	/** Where the light comes from (the sun, or the moon at night), in degrees. */
	azimuth: number;
	elevation: number;
	color: string;
	/** 1 = the theme's daylight. */
	strength: number;
	/** Sky and ground fill light, relative to the theme's. */
	fill: number;
	tint: string;
	tintAmount: number;
	/** The sky behind the world, or null for the theme's own background. */
	sky: string | null;
	/** 0 = day, 1 = full night. */
	night: number;
}

/**
 * The light under an overcast sky (weather, ADR-0102), `overcast` 0–1: the sun
 * dims and the fill grows, so shadows soften, and the light and the sky behind
 * the diorama grey, more as it grows. 0 changes nothing.
 */
export const overcastLight = (light: ISkyLight, overcast: number): ISkyLight =>
	overcast <= 0
		? light
		: {
				...light,
				strength: light.strength * (1 - 0.6 * overcast),
				fill: light.fill * (1 + 0.45 * overcast),
				color: mixColor(light.color, "#dfe3e8", 0.55 * overcast),
				tint: mixColor(light.tint, "#c9ced4", 0.6 * overcast),
				tintAmount: light.tintAmount * (1 - 0.6 * overcast),
				sky: mixColor(
					light.sky ?? "#c4cad1",
					mixColor("#aab2bb", "#1c2028", light.night),
					0.65 * overcast,
				),
			};

/**
 * The light for a world at `hour` (null = the classic studio daylight), with
 * the world's own overrides on top (sun direction, colour, strength), under
 * as much overcast as its weather makes (ADR-0102).
 */
export const skyLightAt = (lighting: TLighting, hour: number | null, overcast = 0): ISkyLight =>
	overcastLight(clearSkyLightAt(lighting, hour), overcast);

/** The light at `hour` with the world's overrides, before any weather. */
const clearSkyLightAt = (lighting: TLighting, hour: number | null): ISkyLight => {
	const base: ISkyLight =
		hour === null
			? {
					...CLASSIC_SUN,
					color: "#ffffff",
					strength: 1,
					fill: 1,
					tint: "#ffffff",
					tintAmount: 0,
					sky: null,
					night: 0,
				}
			: (() => {
					const key = keyAt(hour);
					const sun = sunPositionAt(hour);
					// After dark the moon lights the world, from the opposite side of the sky.
					const moon = sun.elevation < 0;
					const { azimuth, elevation } = moon
						? moonPositionFor(sun.azimuth)
						: { azimuth: sun.azimuth, elevation: Math.max(sun.elevation, 2) };
					return {
						azimuth,
						elevation,
						color: key.light,
						strength: key.strength,
						fill: key.fill,
						tint: key.tint,
						tintAmount: key.tintAmount,
						sky: key.sky,
						night: key.night,
					};
				})();
	return {
		...base,
		azimuth: lighting.sunAzimuth ?? base.azimuth,
		elevation: lighting.sunElevation ?? base.elevation,
		color: lighting.sunColor ?? base.color,
		strength: lighting.sunStrength ?? base.strength,
		night:
			lighting.whenLightsAreOn === "on" ? 1 : lighting.whenLightsAreOn === "off" ? 0 : base.night,
	};
};

/** The sun and shade contrast that keeps the theme's own balance of sunlight and fill (ADR-0072). */
export const BALANCED_CONTRAST = 0.5;

/**
 * How much to strengthen the sunlight and the fill (sky and ambient light)
 * for a world's sun and shade contrast, given how strong each is now and how
 * high the sun stands (degrees): light moves between them while the light on
 * the ground stays the same, so the world gets no brighter or darker, only
 * its shade deeper or softer. A low sun lights the ground at a slant, so it
 * gets more of the fill's light for the same effect. At BALANCED_CONTRAST both
 * stay as they are; each step of 0.2 doubles or halves the fill against the
 * sun on the ground (the render lab's sun ×1.3 and fill ×0.55 is about 0.75
 * with a high sun). With no sunlight there's nothing to move.
 */
export const sunAndFillFactors = (
	sun: number,
	fill: number,
	sunElevation: number,
	contrast: number,
) => {
	const onGround = sun * Math.sin(toRadians(Math.max(sunElevation, 2)));
	const shift = 32 ** (BALANCED_CONTRAST - contrast);
	const shifted = onGround + fill * shift;
	if (onGround <= 0 || shifted <= 0) {
		return { sun: 1, fill: 1 };
	}
	const total = onGround + fill;
	return { sun: total / shifted, fill: (total * shift) / shifted };
};

/** "06:30" for 6.5 hours. */
export const formatHour = (hour: number) => {
	const minutes = Math.round((((hour % 24) + 24) % 24) * 60) % (24 * 60);
	return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};
