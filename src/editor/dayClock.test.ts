import { describe, expect, it } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { sceneHours } from "./dayClock";

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
		const fromData = { ...base, time: 9, timeSource: "data" as const, timeKey: "hour" };
		expect(sceneHours(fromData, [{ key: "hour", label: "", value: 18.5, unit: "" }], 0, 0)).toBe(
			18.5,
		);
		expect(sceneHours(fromData, [{ key: "hour", label: "", value: "late", unit: "" }], 0, 0)).toBe(
			9,
		);
		expect(sceneHours(fromData, [], 0, 0)).toBe(9);
	});

	it("follows the local clock", () => {
		const noonish = new Date(2026, 9, 23, 13, 30).getTime();
		expect(sceneHours({ ...base, timeSource: "clock" }, [], noonish, 0)).toBe(13.5);
	});
});
