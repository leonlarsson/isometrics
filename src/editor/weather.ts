import { readScale } from "#/parts/dataBinding";
import type { TDataEntry, TWeather } from "#/scene/schema";
import type { ISkyWeather } from "#/scene/sky";

import { useEditor } from "./store";

/**
 * The weather in effect (ADR-0102): each amount as set or from its data
 * value, the ground following the rain and the snow unless set, and how
 * overcast it makes the light. What the view draws and the light follows.
 */
export interface IWeatherNow {
	rain: number;
	snow: number;
	fog: number;
	haze: number;
	lightning: number;
	/** How wet the ground looks, and how much snow has settled, 0–1. */
	wetness: number;
	snowCover: number;
	showsSplashes: boolean;
	/** How much it dims, softens and greys the light (0 while weather doesn't soften it). */
	overcast: number;
	/** How cloudy it is (0–1), the clouds' colour (null: white, tinted by the light) and how fast they drift. */
	cloudCover: number;
	cloudColor: string | null;
	cloudSpeed: number;
}

/** The weather's settings that can follow a data value. */
export const WEATHER_DATA = [
	"cloudCover",
	"rainAmount",
	"snowAmount",
	"fogDensity",
	"hazeAmount",
	"lightningRate",
] as const;

export type TWeatherDataTarget = (typeof WEATHER_DATA)[number];

/** What it's like now, from the world's weather and its data. */
export const weatherNow = (weather: TWeather, data?: readonly TDataEntry[]): IWeatherNow => {
	const amount = (key: TWeatherDataTarget) =>
		readScale(weather.data[key], data, { max: 1 }) ?? weather[key];
	const rain = amount("rainAmount");
	const snow = amount("snowAmount");
	const fog = amount("fogDensity");
	return {
		rain,
		snow,
		fog,
		haze: amount("hazeAmount"),
		lightning: amount("lightningRate"),
		wetness: weather.groundWetness ?? Math.min(1, rain * 1.2),
		snowCover: weather.snowCover ?? Math.min(1, snow * 1.3),
		showsSplashes: weather.showsSplashes,
		overcast: weather.softensLight ? Math.min(1, Math.max(rain * 0.9, snow * 0.75, fog * 0.7)) : 0,
		cloudCover: amount("cloudCover"),
		cloudColor: weather.cloudColor,
		cloudSpeed: weather.cloudSpeed,
	};
};

/** The world's weather in effect now, from the store, for code that runs each frame. */
export const weatherNowInWorld = () => {
	const { scene } = useEditor.getState();
	return weatherNow(scene.weather, scene.data);
};

/** How overcast the world's weather makes the light (0–1), for components: changes with the weather. */
export const useOvercast = () =>
	useEditor((s) => weatherNow(s.scene.weather, s.scene.data).overcast);

/** What the world's weather brings to the sky now (its clouds, overcast), for components. */
export const useSkyWeather = (): ISkyWeather => {
	const overcast = useOvercast();
	const cloudCover = useEditor((s) => weatherNow(s.scene.weather, s.scene.data).cloudCover);
	const cloudColor = useEditor((s) => s.scene.weather.cloudColor);
	const cloudSpeed = useEditor((s) => s.scene.weather.cloudSpeed);
	return { cloudCover, cloudColor, cloudSpeed, overcast };
};
