import { describe, expect, it } from "vitest";

import { formatValue, toDataKey } from "./format";

describe("formatValue", () => {
	it("formats numbers with separators and appends units as typed", () => {
		expect(formatValue(4512)).toBe("4,512");
		expect(formatValue(96, "%")).toBe("96%");
		expect(formatValue(2, " min")).toBe("2 min");
		expect(formatValue(1.256)).toBe("1.26");
	});

	it("compacts very large numbers", () => {
		expect(formatValue(3_450_000)).toBe("3.5M");
	});

	it("writes a number in its own style: in full, with separators, or short", () => {
		expect(formatValue(374160, "", "full")).toBe("374160");
		expect(formatValue(374160, "", "grouped")).toBe("374,160");
		expect(formatValue(374160, "", "short")).toBe("374.2K");
		expect(formatValue(980, "", "short")).toBe("980");
		expect(formatValue(1_500_000, " km", "grouped")).toBe("1,500,000 km");
	});

	it("passes text through", () => {
		expect(formatValue("14 / 40")).toBe("14 / 40");
	});
});

describe("toDataKey", () => {
	it("slugifies labels into valid keys", () => {
		expect(toDataKey("Orders packed")).toBe("orders_packed");
		expect(toDataKey("  Loading bay (south) ")).toBe("loading_bay_south");
		expect(toDataKey("!!!")).toBe("value");
	});
});
