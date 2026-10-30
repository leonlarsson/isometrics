import { describe, expect, it } from "vitest";

import { DataBindingSchema, SceneSchema } from "#/scene/schema";

import { sceneHours, shownHours } from "./dayClock";

const base = SceneSchema.parse({ version: 1 }).lighting;

describe("sceneHours", () => {
	it("is null (classic daylight) with no time of day", () => {
		expect(sceneHours(base, [], 0, 0)).toBeNull();
	});

	it("runs the day cycle from the set time, wrapping at midnight", () => {
		const cycle = { ...base, time: 22, timeSource: "cycle" as const, dayLength: 120 };
		expect(sceneHours(cycle, [], 0, 0)).toBe(22);
		expect(sceneHours(cycle, [], 0, 15)).toBe(1);
	});

	it("takes the time from a data value, or the set time without one", () => {
		const fromData = {
			...base,
			time: 9,
			timeSource: "data" as const,
			data: { time: DataBindingSchema.parse({ key: "hour" }) },
		};
		expect(sceneHours(fromData, [{ key: "hour", name: "", value: 18.5, unit: "" }], 0, 0)).toBe(
			18.5,
		);
		expect(sceneHours(fromData, [{ key: "hour", name: "", value: "late", unit: "" }], 0, 0)).toBe(
			9,
		);
		expect(sceneHours(fromData, [], 0, 0)).toBe(9);
	});

	it("follows the local clock", () => {
		const noonish = new Date(2026, 9, 23, 13, 30).getTime();
		expect(sceneHours({ ...base, timeSource: "clock" }, [], noonish, 0)).toBe(13.5);
	});
});

describe("shownHours", () => {
	it("shows a set time exactly, the viewer's clock to the minute, and a day cycle in steps", () => {
		expect(shownHours(12.75, { ...base, timeSource: "fixed" })).toBe(12.75);
		expect(shownHours(19 + 59.9 / 60, { ...base, timeSource: "clock" })).toBe(19 + 59 / 60);
		// A two-minute day: three-minute steps (about four updates a second).
		expect(shownHours(18 + 4 / 60, { ...base, timeSource: "cycle", dayLength: 120 })).toBeCloseTo(
			18 + 3 / 60,
		);
		// A slow day: one-minute steps.
		expect(
			shownHours(18 + 4.4 / 60, { ...base, timeSource: "cycle", dayLength: 1800 }),
		).toBeCloseTo(18 + 4 / 60);
		// A ten-second day: 36-minute steps.
		expect(shownHours(18.5, { ...base, timeSource: "cycle", dayLength: 10 })).toBeCloseTo(18.6);
	});
});
