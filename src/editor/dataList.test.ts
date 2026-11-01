import { describe, expect, it } from "vitest";

import { WorldDataSchema } from "#/scene/schema";

import { dataFoundIn, originOf, sourceNameOf } from "./dataList";

const data = WorldDataSchema.parse({
	sources: [
		{ id: "s", kind: "api", url: "https://api.example.org/now.json" },
		{ id: "w", kind: "link", url: "https://weather.example.com/today.csv", name: "Weather" },
	],
	values: [
		{ key: "visitors", name: "Visitors", value: 3, source: { sourceId: "s", path: "visitors" } },
		{ key: "goal", name: "Goal", value: 10 },
		{ key: "old", name: "Old", value: 1, source: { sourceId: "gone_one" } },
	],
	tables: [
		{
			key: "shops",
			name: "Shops",
			keyColumn: "shop",
			columns: [{ key: "shop", name: "Shop" }],
			rows: [{ shop: "A" }],
			source: { sourceId: "s" },
		},
	],
});

describe("the world's data by kind", () => {
	it("keeps every kind without a search", () => {
		const found = dataFoundIn(data);
		expect([found.values.length, found.tables.length, found.sources.length]).toEqual([3, 1, 2]);
	});

	it("searches by name and key, and by the source things come from", () => {
		const keys = (found: ReturnType<typeof dataFoundIn>) => [
			found.values.map((value) => value.key),
			found.tables.map((table) => table.key),
			found.sources.map((source) => source.id),
		];
		expect(keys(dataFoundIn(data, "goal"))).toEqual([["goal"], [], []]);
		expect(keys(dataFoundIn(data, "shop"))).toEqual([[], ["shops"], []]);
		expect(keys(dataFoundIn(data, "example.org"))).toEqual([["visitors"], ["shops"], ["s"]]);
		expect(keys(dataFoundIn(data, "nothing like it"))).toEqual([[], [], []]);
	});

	it("names sources and origins in words", () => {
		expect(sourceNameOf(data.sources[0])).toBe("api.example.org");
		expect(
			originOf(
				{ sourceId: "s", path: "Stats!sent", field: "", dateField: "", maxRowCount: null },
				data.sources,
			),
		).toBe("from api.example.org, Stats › sent");
		expect(originOf(null, data.sources)).toBe("typed by hand");
	});
});
