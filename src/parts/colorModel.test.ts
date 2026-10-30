import { describe, expect, it } from "vitest";

import { ColorSettingSchema } from "#/scene/schema";

import { resolvePartTransparencies, resolveTransparencies } from "./colorModel";
import type { IColorSpec } from "./types";

const part: { colors: IColorSpec[] } = {
	colors: [
		{ id: "frame", name: "Frame", default: "#ffffff" },
		{ id: "glass", name: "Glass", default: "#cfe6e4", seeThrough: { transparency: 0.65 } },
	],
};

const stored = (colors: Record<string, Partial<ReturnType<typeof ColorSettingSchema.parse>>>) => ({
	colors: Object.fromEntries(
		Object.entries(colors).map(([id, setting]) => [id, ColorSettingSchema.parse(setting)]),
	),
});

describe("see-through colours (ADR-0090)", () => {
	it("are as see-through as the part says until set, and solid colours stay solid", () => {
		expect(resolvePartTransparencies(part)).toEqual({ frame: 0, glass: 0.65 });
	});

	it("take an object's own transparency, and only where the colour is see-through", () => {
		expect(
			resolveTransparencies(
				part,
				stored({ glass: { transparency: 0.2 }, frame: { transparency: 0.9 } }),
			),
		).toEqual({ frame: 0, glass: 0.2 });
	});

	it("go back to the part's with a setting of null, as saved worlds have", () => {
		expect(resolveTransparencies(part, stored({ glass: { color: "#000000" } }))).toEqual({
			frame: 0,
			glass: 0.65,
		});
	});
});
