import { describe, expect, it } from "vitest";

import { WorldDataSchema } from "#/scene/schema";

import { dataGroupsOf, originOf, sourceNameOf } from "./dataList";

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

describe("the world's data as one list", () => {
	it("groups by source, then typed by hand, then a source that's gone", () => {
		const groups = dataGroupsOf(data);
		expect(groups.map((group) => [group.title, group.values.length, group.tables.length])).toEqual([
			["api.example.org", 1, 1],
			["Weather", 0, 0],
			["Typed by me", 1, 0],
			["From a source that's gone", 1, 0],
		]);
	});

	it("searches by name and key, and keeps all of a source that matches by name", () => {
		expect(dataGroupsOf(data, "goal").map((group) => group.title)).toEqual(["Typed by me"]);
		expect(dataGroupsOf(data, "shop").map((group) => group.tables.length)).toEqual([1]);
		const bySite = dataGroupsOf(data, "example.org");
		expect(bySite.map((group) => [group.title, group.values.length + group.tables.length])).toEqual(
			[["api.example.org", 2]],
		);
		expect(dataGroupsOf(data, "nothing like it")).toEqual([]);
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
