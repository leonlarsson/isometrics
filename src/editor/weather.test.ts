import { describe, expect, it } from "vitest";

import { worldBindingMapsOf } from "#/scene/dataBindings";
import { AreaSchema, DataBindingSchema, SceneSchema, WeatherSchema } from "#/scene/schema";
import { overcastLight, skyLightAt } from "#/scene/sun";

import {
	AREA_CLOUDS_ABOVE,
	areaWeathersNow,
	cloudAltitudeOf,
	mostAnywhere,
	weatherNow,
} from "./weather";

const weather = (fields = {}) => WeatherSchema.parse(fields);
const lighting = SceneSchema.parse({ version: 1 }).lighting;

describe("weather (ADR-0102)", () => {
	it("is clear by default, and leaves the light as it was", () => {
		const now = weatherNow(weather());
		expect(now).toMatchObject({ rain: 0, snow: 0, fog: 0, wetness: 0, snowCover: 0, overcast: 0 });
		expect(skyLightAt(lighting, 12, now.overcast)).toEqual(skyLightAt(lighting, 12));
	});

	it("wets the ground with the rain and settles snow with the snowfall, unless set", () => {
		expect(weatherNow(weather({ rainAmount: 0.5, snowAmount: 0.5 }))).toMatchObject({
			wetness: 0.6,
			snowCover: 0.65,
		});
		expect(weatherNow(weather({ rainAmount: 1, groundWetness: 0.2 })).wetness).toBe(0.2);
	});

	it("follows data: value ÷ value at full, up to all", () => {
		const data = [{ key: "rain", name: "Rain", value: 12, unit: "mm" }];
		const fromData = weather({
			data: { rainAmount: DataBindingSchema.parse({ key: "rain", valueAtFull: 20 }) },
		});
		expect(weatherNow(fromData, data).rain).toBeCloseTo(0.6);
		expect(weatherNow(fromData, [{ ...data[0], value: 40 }]).rain).toBe(1);
	});

	it("dims and softens the light as it grows, unless told not to", () => {
		const storm = weatherNow(weather({ rainAmount: 1 }));
		expect(storm.overcast).toBeGreaterThan(0.5);
		const clear = skyLightAt(lighting, 12);
		const overcast = overcastLight(clear, storm.overcast);
		expect(overcast.strength).toBeLessThan(clear.strength);
		expect(overcast.fill).toBeGreaterThan(clear.fill);
		expect(weatherNow(weather({ rainAmount: 1, softensLight: false })).overcast).toBe(0);
	});
});

describe("weather per area (ADR-0151)", () => {
	const square = [
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10],
	];
	const area = (id: string, fields = {}) => AreaSchema.parse({ id, points: square, ...fields });

	it("is the world's until an area has its own", () => {
		expect(area("a").weather).toBeNull();
		expect(areaWeathersNow([area("a")])).toEqual([]);
	});

	it("lists the areas with their own weather, as set or from data, but not hidden ones", () => {
		const data = [{ key: "mood", name: "Mood", value: 3 }];
		const areas = [
			area("calm"),
			area("storm", {
				weather: {
					rainAmount: 0.2,
					data: { rainAmount: DataBindingSchema.parse({ key: "mood", valueAtFull: 4 }) },
				},
			}),
			area("hidden", { weather: { snowAmount: 1 }, isHidden: true }),
		];
		const weathers = areaWeathersNow(areas, data);
		expect(weathers.map(({ area }) => area.id)).toEqual(["storm"]);
		expect(weathers[0].now.rain).toBe(0.75);
		// The same list until the areas or the data change.
		expect(areaWeathersNow(areas, data)).toBe(weathers);
		expect(mostAnywhere(weatherNow(weather()), weathers, (now) => now.rain)).toBe(0.75);
	});

	it("keeps its data bindings with the world's, so renames and deletes reach them", () => {
		const scene = SceneSchema.parse({
			version: 1,
			areas: [
				{
					id: "a",
					points: square,
					weather: { data: { lightningRate: { key: "anger" } } },
				},
			],
		});
		expect(
			worldBindingMapsOf(scene).some((bindings) => bindings.lightningRate?.key === "anger"),
		).toBe(true);
	});

	it("floats its clouds over its top unless their height is set, and the world's on their ring", () => {
		const raised = area("hill", { height: 2, weather: {} });
		const now = areaWeathersNow([raised])[0].now;
		expect(cloudAltitudeOf(now, { area: raised })).toBe(2 + AREA_CLOUDS_ABOVE);
		expect(cloudAltitudeOf({ cloudAltitude: 20 }, { area: raised })).toBe(20);
		expect(cloudAltitudeOf({ cloudAltitude: null }, { reach: 100 })).toBe(45);
	});
});
