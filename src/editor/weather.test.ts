import { describe, expect, it } from "vitest";

import { DataBindingSchema, SceneSchema, WeatherSchema } from "#/scene/schema";
import { overcastLight, skyLightAt } from "#/scene/sun";

import { weatherNow } from "./weather";

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
		const data = [{ key: "rain", label: "Rain", value: 12, unit: "mm" }];
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
