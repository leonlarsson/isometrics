import { describe, expect, it } from "vitest";

import { dividersOf, percentagesFrom, toPercentages } from "./SplitField";

describe("SplitField's shares", () => {
	it("turns relative weights into percentages that fill the bar", () => {
		expect(toPercentages([9, 1])).toEqual([90, 10]);
		expect(toPercentages([1, 1, 2])).toEqual([25, 25, 50]);
		// Nothing anywhere: an even split, not a bar of nothing.
		expect(toPercentages([0, 0])).toEqual([50, 50]);
	});

	it("puts a divider between each pair, and reads percentages back from where they're dragged", () => {
		expect(dividersOf([25, 25, 50])).toEqual([25, 50]);
		expect(percentagesFrom([30, 80])).toEqual([30, 50, 20]);
		// Dragged past each other: still in order, still adding up to 100.
		expect(percentagesFrom([80, 30])).toEqual([30, 50, 20]);
		expect(percentagesFrom([33.4]).reduce((a, b) => a + b, 0)).toBe(100);
	});
});
