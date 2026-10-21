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
