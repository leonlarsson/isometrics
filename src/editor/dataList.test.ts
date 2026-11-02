import { describe, expect, it } from "vitest";

import { WorldDataSchema } from "#/scene/schema";

import { dataFoundIn, originOf, sourceNameOf, tableInWords, valueInWords } from "./dataList";

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

	it("says why a value shows its number, in plain words", () => {
		const sources = WorldDataSchema.parse({
			sources: [
				{ id: "f", kind: "file", name: "sent.csv", fileName: "sent.csv" },
				{ id: "a", kind: "api", url: "https://api.example.org/now.json" },
				{ id: "n", kind: "api", name: "Steam" },
			],
		}).sources;
		const value = (input: object) =>
			WorldDataSchema.parse({ values: [{ key: "v", name: "V", value: 3, ...input }] }).values[0];
		const history = [
			{ at: "2024", value: 1 },
			{ at: "2025", value: 3 },
		];
		expect(valueInWords(value({}), sources).long).toBe("Typed by hand.");
		expect(valueInWords(value({ history }), sources).long).toBe(
			"Typed by hand. It keeps 2 past values, 2024 to 2025; the number shown is the newest, from 2025.",
		);
		expect(
			valueInWords(value({ source: { sourceId: "f", path: "sent" }, history }), sources),
		).toEqual({
			long: "From the “sent” column of sent.csv, one row per date. It keeps 2 past values, 2024 to 2025; the number shown is the newest, from 2025.",
			short: "the “sent” column, 2 past values",
		});
		expect(
			valueInWords(value({ source: { sourceId: "f", path: "Stats!sent" } }), sources).long,
		).toBe("From “sent” in the “Stats” sheet of sent.csv.");
		expect(
			valueInWords(value({ source: { sourceId: "a", path: "totalUsers" } }), sources).long,
		).toBe("From api.example.org: the “totalUsers” in its answer.");
		expect(
			valueInWords(
				value({ source: { sourceId: "a", path: "", field: "sent", dateField: "day" }, history }),
				sources,
			).long,
		).toBe(
			"From the list api.example.org answers: each entry's “sent”, dated by its “day”. It keeps 2 past values, 2024 to 2025; the number shown is the newest, from 2025.",
		);
		expect(valueInWords(value({ source: { sourceId: "n" } }), sources).long).toMatch(
			/^Put in from outside this app .* It has no address, so it can't be read again\.$/,
		);
		expect(valueInWords(value({ source: { sourceId: "gone" } }), sources).short).toBe(
			"its source was removed",
		);
		expect(tableInWords(data.tables[0], data.sources).long).toBe(
			"From the list api.example.org answers: one row for each entry, 1 row.",
		);
	});
});
