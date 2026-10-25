import { describe, expect, it } from "vitest";

import { BackdropSchema, LightingSchema, SkySchema } from "./schema";
import { backdropBackground, GREEN_SCREEN, skyColorsAt, skyLookAt } from "./sky";

const lighting = LightingSchema.parse({});
const sky = SkySchema.parse({});

describe("the sky (ADR-0070)", () => {
	it("is blue by day, dark at night, and a soft blue in classic daylight", () => {
		expect(skyColorsAt(12.75)).toEqual({ colorOverhead: "#4f8fdc", colorAtHorizon: "#cfe3f5" });
		expect(skyColorsAt(0).colorOverhead).toBe("#070b1f");
		expect(skyColorsAt(null).colorOverhead).toBe("#5b97dd");
		// Between keys it blends, and round midnight it wraps.
		expect(skyColorsAt(23).colorOverhead).not.toBe(skyColorsAt(21.5).colorOverhead);
	});

	it("shows the sun by day and the moon and stars at night", () => {
		const noon = skyLookAt(lighting, sky, 12);
		expect(noon.sunDisc?.elevation).toBeGreaterThan(50);
		expect(noon.moonDisc).toBeNull();
		expect(noon.starBrightness).toBe(0);
		const night = skyLookAt(lighting, sky, 1);
		expect(night.sunDisc).toBeNull();
		expect(night.moonDisc).not.toBeNull();
		expect(night.starBrightness).toBeCloseTo(sky.starDensity, 5);
	});

	it("follows the world's own settings: colours, sun direction, what's shown", () => {
		const look = skyLookAt(
			LightingSchema.parse({ sunAzimuth: 90, sunElevation: 30 }),
			SkySchema.parse({ colorOverhead: "#112233", showMoon: false, starDensity: 0 }),
			1,
		);
		// A colour set by hand is the day's: at 1 o'clock it has darkened almost to the night's.
		expect(look.colorOverhead).not.toBe("#112233");
		expect(
			skyLookAt(lighting, SkySchema.parse({ colorOverhead: "#112233" }), 12).colorOverhead,
		).toBe("#112233");
		expect(look.moonDisc).toBeNull();
		expect(look.starBrightness).toBe(0);
		expect(skyLookAt(lighting, SkySchema.parse({ showSun: false }), 12).sunDisc).toBeNull();
		expect(
			skyLookAt(LightingSchema.parse({ sunAzimuth: 90, sunElevation: 30 }), sky, 12).sunDisc,
		).toMatchObject({
			azimuth: 90,
			elevation: 30,
		});
	});
});

describe("the backdrop (ADR-0070)", () => {
	const theme = "#efede8";
	it("is the sky's colour by default, else a colour, a gradient or green", () => {
		expect(backdropBackground(BackdropSchema.parse({}), theme)).toBeNull();
		expect(
			backdropBackground(BackdropSchema.parse({ kind: "color", color: "#123456" }), theme),
		).toBe("#123456");
		expect(backdropBackground(BackdropSchema.parse({ kind: "color" }), theme)).toBe(theme);
		expect(
			backdropBackground(
				BackdropSchema.parse({ kind: "gradient", gradientStart: "#000000" }),
				theme,
			),
		).toBe(`linear-gradient(180deg, #000000, ${theme})`);
		expect(
			backdropBackground(
				BackdropSchema.parse({
					kind: "gradient",
					gradientStart: "#000000",
					gradientEnd: "#ffffff",
					gradientAngle: 90,
				}),
				theme,
			),
		).toBe("linear-gradient(90deg, #000000, #ffffff)");
		expect(backdropBackground(BackdropSchema.parse({ kind: "greenScreen" }), theme)).toBe(
			GREEN_SCREEN,
		);
	});
});
