import { describe, expect, it } from "vitest";

import { mixColor, tintColor } from "#/lib/color";

import { SceneSchema } from "./schema";
import {
	BALANCED_CONTRAST,
	CLASSIC_SUN,
	formatHour,
	SUNRISE,
	SUNSET,
	skyLightAt,
	sunAndFillFactors,
	sunPositionAt,
} from "./sun";

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
				whenLightsAreOn: "on",
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
		expect(skyLightAt({ ...lighting, whenLightsAreOn: "off" }, 0).night).toBe(0);
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

describe("sun and shade contrast", () => {
	// The light theme's sun and fill (hemisphere + ambient) at full day, the sun high.
	const sun = 2.4;
	const fill = 1.85;
	const high = 90;
	const onGround = (elevation: number) => sun * Math.sin((elevation * Math.PI) / 180);

	it("keeps the theme's own balance by default", () => {
		expect(SceneSchema.parse({ version: 1 }).lighting.sunShadeContrast).toBe(BALANCED_CONTRAST);
		expect(sunAndFillFactors(sun, fill, 40, BALANCED_CONTRAST)).toEqual({ sun: 1, fill: 1 });
	});

	it("moves light between the sun and the fill, keeping the light on the ground", () => {
		for (const elevation of [8, 40, 90]) {
			for (const contrast of [0, 0.25, 0.75, 1]) {
				const factors = sunAndFillFactors(sun, fill, elevation, contrast);
				expect(onGround(elevation) * factors.sun + fill * factors.fill).toBeCloseTo(
					onGround(elevation) + fill,
					10,
				);
			}
		}
		const deeper = sunAndFillFactors(sun, fill, high, 0.75);
		expect(deeper.sun).toBeGreaterThan(1);
		expect(deeper.fill).toBeLessThan(1);
		const softer = sunAndFillFactors(sun, fill, high, 0.25);
		expect(softer.sun).toBeLessThan(1);
		expect(softer.fill).toBeGreaterThan(1);
	});

	it("is about the render lab's stronger sun at 0.75, and halves the fill against the sun every 0.2", () => {
		const lab = sunAndFillFactors(sun, fill, high, 0.75);
		expect(lab.sun).toBeCloseTo(1.3, 1);
		expect(lab.fill).toBeCloseTo(0.55, 1);
		const a = sunAndFillFactors(sun, fill, high, 0.6);
		const b = sunAndFillFactors(sun, fill, high, 0.8);
		expect((fill * a.fill) / (sun * a.sun) / ((fill * b.fill) / (sun * b.sun))).toBeCloseTo(2, 10);
	});

	it("strengthens a low sun more, as it lights the ground at a slant", () => {
		expect(sunAndFillFactors(sun, fill, 10, 0.75).sun).toBeGreaterThan(
			sunAndFillFactors(sun, fill, high, 0.75).sun,
		);
	});

	it("leaves a world without sunlight as it is", () => {
		expect(sunAndFillFactors(0, fill, 40, 1)).toEqual({ sun: 1, fill: 1 });
	});
});
