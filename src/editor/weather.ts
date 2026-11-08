import { readScale } from "#/parts/dataBinding";
import { valuesOfArea } from "#/scene/areas";
import { areaBaseOf } from "#/scene/grounds";
import type { TArea, TGround, TReadableValues, TWeather, TWorldData } from "#/scene/schema";
import type { ISkyWeather } from "#/scene/sky";
import type { TWeatherMapAmount } from "#/scene/weatherMap";

import { useEditor } from "./store";
import { useWorldData, worldDataNow } from "./worldData";

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
	/** How high the clouds float, as set (null: where they float by default, `cloudAltitudeOf`). */
	cloudAltitude: number | null;
	/** How see-through the clouds are: 0 solid. */
	cloudTransparency: number;
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

/** What each of them is called on the Weather tab, for messages that name them. */
export const WEATHER_DATA_LABELS: Record<TWeatherDataTarget, string> = {
	cloudCover: "Cloud cover",
	rainAmount: "Rain",
	snowAmount: "Snow",
	fogDensity: "Fog",
	hazeAmount: "Haze",
	lightningRate: "Lightning",
};

/** The amounts that follow data now, in the Weather tab's order, by name: "Rain and Lightning". */
export const namesFollowingData = (weather: Pick<TWeather, "data">): string => {
	const names = WEATHER_DATA.filter((key) => weather.data[key]).map(
		(key) => WEATHER_DATA_LABELS[key],
	);
	return names.length > 1
		? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
		: (names[0] ?? "");
};

/**
 * A quick pick put on (ADR-0102): its amounts, nothing else falling, the
 * ground following the weather, and every amount By hand, since a pick sets
 * them all. An amount left From data would ignore the pick and mix with it
 * (a pick of Snow with rain still from data). Undo brings the data back.
 */
export const putOnQuickPick = (
	weather: Pick<TWeather, TWeatherDataTarget | "groundWetness" | "snowCover" | "data">,
	pick: Partial<Pick<TWeather, TWeatherDataTarget>>,
) => {
	Object.assign(
		weather,
		{ rainAmount: 0, snowAmount: 0, fogDensity: 0, hazeAmount: 0, lightningRate: 0 },
		pick,
		{ groundWetness: null, snowCover: null },
	);
	for (const key of WEATHER_DATA) {
		delete weather.data[key];
	}
};

/** What it's like now, from the world's weather and its data. */
export const weatherNow = (weather: TWeather, data?: TReadableValues): IWeatherNow => {
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
		cloudAltitude: weather.cloudAltitude,
		cloudTransparency: weather.cloudTransparency,
	};
};

/** How far over an area's top its clouds float unless set: over houses and trees, low enough to read as over it. */
export const AREA_CLOUDS_ABOVE = 9;

/** The highest clouds can float (`cloudAltitude`'s limit). */
export const MOST_CLOUD_ALTITUDE = 80;

/**
 * How high clouds float: as set, else the world's on their ring round it
 * (higher for a big world, `reach` its longer side) or an area's over its top.
 */
export const cloudAltitudeOf = (
	now: Pick<IWeatherNow, "cloudAltitude">,
	over: { reach: number } | { area: Pick<TArea, "height">; base?: number },
) =>
	now.cloudAltitude ??
	("area" in over
		? (over.base ?? 0) + over.area.height + AREA_CLOUDS_ABOVE
		: 30 + over.reach * 0.15);

/** The world's weather in effect now, from the store, for code that runs each frame. */
export const weatherNowInWorld = () => {
	const { scene } = useEditor.getState();
	return weatherNow(scene.weather, worldDataNow().values);
};

/** How overcast the world's weather makes the light (0–1), for components: changes with the weather. */
export const useOvercast = () => {
	const data = useWorldData().values;
	return useEditor((s) => weatherNow(s.scene.weather, data).overcast);
};

/** What the world's weather brings to the sky now (its clouds, overcast), for components. */
export const useSkyWeather = (): ISkyWeather => {
	const overcast = useOvercast();
	const data = useWorldData().values;
	const cloudCover = useEditor((s) => weatherNow(s.scene.weather, data).cloudCover);
	const cloudColor = useEditor((s) => s.scene.weather.cloudColor);
	const cloudSpeed = useEditor((s) => s.scene.weather.cloudSpeed);
	return { cloudCover, cloudColor, cloudSpeed, overcast };
};

/** An area with weather of its own (ADR-0151), and that weather in effect now. */
export interface IAreaWeatherNow {
	area: TArea;
	now: IWeatherNow;
	/** Where it stands: the top of the ground under it (ADR-0155); its clouds float that much higher. */
	base: number;
}

const NO_AREA_WEATHERS: readonly IAreaWeatherNow[] = [];
const NO_GROUNDS: readonly TGround[] = [];

/** Kept per list of areas and data, so selectors and frames reuse it until either changes. */
const areaWeathersKept = new WeakMap<
	readonly TArea[],
	{
		data: TWorldData | undefined;
		grounds: readonly TGround[];
		weathers: readonly IAreaWeatherNow[];
	}
>();

/**
 * The areas shown with weather of their own (ADR-0151), in order (later on
 * top), each with its weather in effect: as set or from its data, the world's
 * values and the columns of the row it follows (ADR-0152).
 */
export const areaWeathersNow = (
	areas: readonly TArea[],
	data?: TWorldData,
	grounds: readonly TGround[] = NO_GROUNDS,
): readonly IAreaWeatherNow[] => {
	const kept = areaWeathersKept.get(areas);
	if (kept && kept.data === data && kept.grounds === grounds) {
		return kept.weathers;
	}
	const weathers: IAreaWeatherNow[] = [];
	for (const area of areas) {
		if (area.weather && !area.isHidden) {
			weathers.push({
				area,
				now: weatherNow(area.weather, data ? valuesOfArea(area, data) : undefined),
				base: areaBaseOf(area, grounds),
			});
		}
	}
	const list = weathers.length > 0 ? weathers : NO_AREA_WEATHERS;
	areaWeathersKept.set(areas, { data, grounds, weathers: list });
	return list;
};

/** The areas' own weathers now, from the store, for code that runs each frame. */
export const areaWeathersInWorld = () =>
	areaWeathersNow(
		useEditor.getState().scene.areas,
		worldDataNow(),
		useEditor.getState().scene.grounds,
	);

/** What an area's weather puts on the weather map (scene/weatherMap): its amounts, each 0–1. */
export const weatherMapAmountsOf = (
	area: Pick<TArea, "height">,
	now: IWeatherNow,
	base = 0,
): Record<TWeatherMapAmount, number> => ({
	rain: now.rain,
	snow: now.snow,
	wetness: now.wetness,
	snowCover: now.snowCover,
	fog: now.fog,
	haze: now.haze,
	overcast: now.overcast,
	splashes: now.showsSplashes ? now.rain : 0,
	cloudAltitude: cloudAltitudeOf(now, { area, base }) / MOST_CLOUD_ALTITUDE,
});

/** The most of an amount anywhere: the world's, or an area's own if more. */
export const mostAnywhere = (
	world: IWeatherNow,
	areas: readonly IAreaWeatherNow[],
	amount: (now: IWeatherNow) => number,
) => areas.reduce((most, { now }) => Math.max(most, amount(now)), amount(world));
