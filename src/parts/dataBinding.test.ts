import { describe, expect, it } from "vitest";

import { DataBindingSchema } from "#/scene/schema";

import { cssColor, readColor, readScale, readSwitch, switchesOn } from "./dataBinding";

const data = [
	{ key: "queue", label: "Queue", value: 60, unit: "" },
	{ key: "status", label: "Status", value: "Green", unit: "" },
	{ key: "word", label: "Word", value: "null", unit: "" },
];

const bind = (key: string, options: { above?: number; full?: number } = {}) =>
	DataBindingSchema.parse({ key, ...options });

describe("data bindings (ADR-0058)", () => {
	it("switches on above a threshold (0 by default), and off without the value", () => {
		expect(readSwitch(bind("queue"), data)).toBe(true);
		expect(readSwitch(bind("queue", { above: 50 }), data)).toBe(true);
		expect(readSwitch(bind("queue", { above: 60 }), data)).toBe(false);
		expect(readSwitch(bind("word"), data)).toBe(false);
		expect(readSwitch(bind("gone"), data)).toBeUndefined();
	});

	it("scales a number by its value at 100%, within limits", () => {
		expect(readScale(bind("queue", { full: 40 }), data)).toBe(1.5);
		expect(readScale(bind("queue", { full: 10 }), data, { max: 3 })).toBe(3);
		expect(readScale(bind("status"), data)).toBeUndefined();
	});

	it("reads a colour from any CSS colour value, else nothing", () => {
		expect(readColor(bind("status"), data)).toBe("#008000");
		expect(readColor(bind("word"), data)).toBeUndefined();
		expect(readColor(undefined, data)).toBeUndefined();
	});
});

describe("switchesOn", () => {
	it("reads numbers above the threshold and the words on, yes and true as on, anything else as off", () => {
		expect([1, 0.1, "2", " Yes ", "ON", "true"].map((value) => switchesOn(value))).toEqual(
			Array(6).fill(true),
		);
		expect(
			[0, -1, "0", "", "off", "No", "false", "null", "open", undefined].map((value) =>
				switchesOn(value),
			),
		).toEqual(Array(10).fill(false));
		expect(switchesOn(5, 5)).toBe(false);
		expect(switchesOn("5.5", 5)).toBe(true);
	});
});

describe("cssColor", () => {
	it("reads CSS colour names, hex, rgb() and hsl() as #rrggbb", () => {
		expect(cssColor("Red")).toBe("#ff0000");
		expect(cssColor(" rebeccapurple ")).toBe("#663399");
		expect(cssColor("#0f0")).toBe("#00ff00");
		expect(cssColor("#3D4FD6")).toBe("#3d4fd6");
		expect(cssColor("rgb(255, 128, 0)")).toBe("#ff8000");
		expect(cssColor("rgba(0, 0, 255, 0.5)")).toBe("#0000ff");
		expect(cssColor("hsl(120, 100%, 50%)")).toBe("#00ff00");
	});

	it("reads anything else as no colour", () => {
		for (const value of [
			"open",
			"",
			"#12",
			"#gggggg",
			"rgb(1, 2)",
			"hsl(1, 2, 3)",
			"null",
			5,
			undefined,
		]) {
			expect(cssColor(value), String(value)).toBeNull();
		}
	});
});
