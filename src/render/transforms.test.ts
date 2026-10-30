import { describe, expect, it } from "vitest";

import type { TVec3 } from "#/scene/schema";

import { turnAbout } from "./transforms";

const upright: TVec3 = [0, 0, 0];

describe("turning in all three axes (ADR-0097)", () => {
	it("tips an upright object around its X, and leans it around its Z", () => {
		expect(turnAbout(upright, "x", 30)).toEqual([30, 0, 0]);
		expect(turnAbout(upright, "z", -45)).toEqual([0, 0, -45]);
	});

	it("turns around its own axes as it faces, keeping its turn around the vertical", () => {
		// Facing east, tipping around its own X is still around X, not Z.
		expect(turnAbout([0, 90, 0], "x", 20)).toEqual([20, 90, 0]);
	});

	it("puts a second tilt together with the first", () => {
		const leaned = turnAbout(upright, "z", 30);
		const back = turnAbout(leaned, "z", -30);
		expect(back[2]).toBeCloseTo(0);
		expect(back[0]).toBeCloseTo(0);
		const both = turnAbout(leaned, "x", 90);
		expect(Math.abs(both[0]) + Math.abs(both[2])).toBeGreaterThan(0);
	});
});
