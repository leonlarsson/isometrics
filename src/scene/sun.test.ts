import { describe, expect, it } from "vitest";

import { mixColor, tintColor } from "#/lib/color";

import { SceneSchema } from "./schema";
import { CLASSIC_SUN, formatHour, SUNRISE, SUNSET, skyLightAt, sunPositionAt } from "./sun";

const lighting = SceneSchema.parse({ version: 1 }).lighting;

describe("sun", () => {
	it("rises in the east, is highest around midday, sets in the west, and is below at night", () => {
		expect(sunPositionAt(SUNRISE).elevation).toBeCloseTo(0, 5);
		expect(sunPositionAt(SUNRISE).azimuth).toBeCloseTo(0, 5);
		const noon = sunPositionAt((SUNRISE + SUNSET) / 2);
		expect(noon.elevation).toBeGreaterThan(60);
		expect(noon.azimuth).toBeCloseTo(270, 5);
		expect(sunPositionAt(SUNSET).azimuth).toBeCloseTo(180, 5);
		expect(sunPositionAt(1).elevation).toBeLessThan(0);
	});

	it("keeps the classic daylight without a time of day", () => {
		const light = skyLightAt(lighting, null);
		expect([light.azimuth, light.elevation]).toEqual([CLASSIC_SUN.azimuth, CLASSIC_SUN.elevation]);
		expect([light.color, light.strength, light.night, light.sky]).toEqual(["#ffffff", 1, 0, null]);
	});

	it("is dark with the moon up at midnight, and bright at noon", () => {
		const night = skyLightAt(lighting, 0);
		expect(night.night).toBe(1);
		expect(night.elevation).toBeGreaterThan(0);
		expect(night.strength).toBeLessThan(0.3);
		const noon = skyLightAt(lighting, 12.75);
		expect([noon.night, noon.strength, noon.color]).toEqual([0, 1, "#ffffff"]);
	});

	it("wraps round midnight smoothly", () => {
		expect(skyLightAt(lighting, 23.99).night).toBeCloseTo(1, 2);
		expect(skyLightAt(lighting, 24).sky).toBe(skyLightAt(lighting, 0).sky);
	});

	it("lets the world override the sun and the lights", () => {
		const light = skyLightAt(
			{
				...lighting,
				sunAzimuth: 90,
				sunElevation: 20,
				sunColor: "#ff0000",
				sunStrength: 2,
				lights: "on",
			},
			12,
		);
		expect([light.azimuth, light.elevation, light.color, light.strength, light.night]).toEqual([
			90,
			20,
			"#ff0000",
			2,
			1,
		]);
		expect(skyLightAt({ ...lighting, lights: "off" }, 0).night).toBe(0);
	});

	it("formats hours as a clock", () => {
		expect(formatHour(6.5)).toBe("06:30");
		expect(formatHour(0)).toBe("00:00");
		expect(formatHour(23.999)).toBe("00:00");
		expect(formatHour(13.25)).toBe("13:15");
	});
});

describe("color", () => {
	it("mixes and tints hex colours", () => {
		expect(mixColor("#000000", "#ffffff", 0.5)).toBe("#808080");
		expect(tintColor("#ffffff", "#ff0000", 1)).toBe("#ff0000");
		expect(tintColor("#808080", "#000000", 0)).toBe("#808080");
	});

	it("goes round once a day without jumping, at midnight too", () => {
		// The direction between neighbouring minutes never changes by more than a little.
		const turn = (a: number, b: number) => Math.abs(((b - a + 540) % 360) - 180);
		for (let minute = 0; minute < 24 * 60; minute++) {
			const a = sunPositionAt(minute / 60);
			const b = sunPositionAt((minute + 1) / 60);
			expect(turn(a.azimuth, b.azimuth), `at ${minute} min`).toBeLessThan(0.5);
			expect(Math.abs(b.elevation - a.elevation), `at ${minute} min`).toBeLessThan(0.5);
		}
		// North (90°) in the middle of the night, below the horizon.
		const middle = sunPositionAt((SUNSET + 24 + SUNRISE) / 2);
		expect(middle.azimuth).toBeCloseTo(90, 5);
		expect(middle.elevation).toBeLessThan(0);
	});
});
