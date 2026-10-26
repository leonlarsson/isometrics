import { describe, expect, it } from "vitest";

import type { IResolvedLight } from "#/parts/types";

import { pickNearest, realLightIntensity } from "./RealLights";

const light = (level: number, litPanes = 1): IResolvedLight => ({
	on: level > 0,
	level,
	color: "#ffffff",
	reach: 2,
	litPanes,
	weight: 1,
});

describe("real night lights (ADR-0072)", () => {
	it("go to the lit sources nearest the view", () => {
		const at = [5, 1, 9, 3, 7];
		expect(pickNearest(at, 3, (x) => x)).toEqual([1, 3, 5]);
		expect(pickNearest(at, 10, (x) => x)).toEqual([1, 3, 5, 7, 9]);
		expect(pickNearest(at, 0, (x) => x)).toEqual([]);
	});

	it("are as bright as the light is now, and windows as bright as their lit panes", () => {
		expect(realLightIntensity(light(0), "pool")).toBe(0);
		expect(realLightIntensity(light(2), "pool")).toBe(2 * realLightIntensity(light(1), "pool"));
		expect(realLightIntensity(light(1, 0.1), "windows")).toBeLessThan(
			realLightIntensity(light(1, 0.5), "windows"),
		);
	});
});
