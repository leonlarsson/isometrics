import { describe, expect, it } from "vitest";

import { turnAbout } from "./transforms";

const upright = { rotation: 0, pitch: 0, roll: 0 };

describe("turning in all three axes (ADR-0097)", () => {
	it("tips an upright object around its X as roll, and leans it around its Z as pitch", () => {
		expect(turnAbout(upright, "x", 30)).toEqual({ rotation: 0, pitch: 0, roll: 30 });
		expect(turnAbout(upright, "z", -45)).toEqual({ rotation: 0, pitch: -45, roll: 0 });
	});

	it("turns around its own axes as it faces, keeping its turn around the vertical", () => {
		// Facing east, tipping around its own X is still roll, not pitch.
		expect(turnAbout({ ...upright, rotation: 90 }, "x", 20)).toEqual({
			rotation: 90,
			pitch: 0,
			roll: 20,
		});
	});

	it("puts a second tilt together with the first", () => {
		const leaned = turnAbout(upright, "z", 30);
		const back = turnAbout(leaned, "z", -30);
		expect(back.pitch).toBeCloseTo(0);
		expect(back.roll).toBeCloseTo(0);
		const both = turnAbout(leaned, "x", 90);
		expect(Math.abs(both.roll) + Math.abs(both.pitch)).toBeGreaterThan(0);
	});
});
