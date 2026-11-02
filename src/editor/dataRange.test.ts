import { describe, expect, it } from "vitest";

import { WorldDataSchema } from "#/scene/schema";

import { dataRangeOf, rangeBindingFor } from "./dataRange";

const data = WorldDataSchema.parse({
	values: [
		{
			key: "visitors",
			name: "Visitors",
			value: 1410,
			history: [
				{ at: "2026-10-27", value: 1180 },
				{ at: "2026-11-02", value: 1410 },
			],
		},
		{ key: "goal", name: "Goal", value: 500 },
		{ key: "status", name: "Status", value: "Good" },
	],
	tables: [
		{
			key: "shops",
			name: "Shops",
			keyColumn: "shop",
			columns: [{ key: "shop" }, { key: "sales" }],
			rows: [
				{ shop: "A", sales: 120 },
				{ shop: "B", sales: 980 },
			],
		},
	],
});
const row = { tableKey: "shops", rowKey: "A" };

describe("where a size following data starts", () => {
	it("goes from the data's lowest to its highest", () => {
		expect(dataRangeOf(data, "visitors", null)).toEqual({ min: 1180, max: 1410 });
		expect(dataRangeOf(data, "row.sales", row)).toEqual({ min: 120, max: 980 });
	});

	it("goes from 0 for a value that has only had one number, and has none for text", () => {
		expect(dataRangeOf(data, "goal", null)).toEqual({ min: 0, max: 500 });
		expect(dataRangeOf(data, "status", null)).toBeNull();
	});

	it("makes a binding with that range and the setting's ends", () => {
		expect(rangeBindingFor(data, "visitors", null, { low: 0.6, high: 2 })).toMatchObject({
			key: "visitors",
			valueAtLowSetting: 1180,
			valueAtHighSetting: 1410,
			lowSetting: 0.6,
			highSetting: 2,
		});
	});
});
