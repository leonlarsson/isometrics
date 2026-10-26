import { describe, expect, it } from "vitest";

import { changedFromPreset, drawsEffects, graphicsOf, PRESET_GRAPHICS } from "./graphics";
import { DEFAULT_PREFERENCES, parsePreferences } from "./preferences";

describe("graphics settings (ADR-0072)", () => {
	it("start on Standard, which needs no effects composer", () => {
		expect(DEFAULT_PREFERENCES.graphicsPreset).toBe("standard");
		expect(graphicsOf(DEFAULT_PREFERENCES)).toEqual(PRESET_GRAPHICS.standard);
		expect(drawsEffects(PRESET_GRAPHICS.standard)).toBe(false);
		expect(drawsEffects(PRESET_GRAPHICS.nice)).toBe(true);
		expect(drawsEffects(PRESET_GRAPHICS.ultra)).toBe(true);
	});

	it("follow the preset until changed, and keep a change when the preset changes", () => {
		const nice = { ...DEFAULT_PREFERENCES, graphicsPreset: "nice" as const };
		expect(graphicsOf(nice)).toEqual(PRESET_GRAPHICS.nice);
		const changed = { ...nice, showGlowAfterDark: false };
		expect(graphicsOf(changed)).toEqual({ ...PRESET_GRAPHICS.nice, showGlowAfterDark: false });
		expect(changedFromPreset(changed)).toBe(1);
		expect(graphicsOf({ ...changed, graphicsPreset: "ultra" })).toEqual({
			...PRESET_GRAPHICS.ultra,
			showGlowAfterDark: false,
		});
	});

	it("read stored settings, an unreadable one following the preset", () => {
		const stored = parsePreferences(
			JSON.stringify({
				graphicsPreset: "ultra",
				ambientOcclusion: "sometimes",
				maxPixelDensity: 1.5,
			}),
		);
		expect(stored.graphicsPreset).toBe("ultra");
		expect(stored.ambientOcclusion).toBeNull();
		expect(stored.maxPixelDensity).toBe(1.5);
		expect(parsePreferences(JSON.stringify({ graphicsPreset: "potato" })).graphicsPreset).toBe(
			"standard",
		);
	});
});
