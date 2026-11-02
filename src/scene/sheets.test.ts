import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DataSourceSchema, WorldDataSchema } from "./schema";
import {
	dataFromSheet,
	guessReading,
	parseCsv,
	putReadData,
	readNumber,
	readSheet,
	whyNotReadAs,
} from "./sheets";

const SAMPLES = new URL("../../docs/data-study/samples/", import.meta.url);

/** A sample CSV from the data study, read and typed. */
const sample = (name: string) => {
	const { rows, delimiter } = parseCsv(readFileSync(new URL(name, SAMPLES), "utf8"));
	return readSheet(rows, { decimalComma: delimiter === ";" });
};

const csv = (text: string) => {
	const { rows, delimiter } = parseCsv(text);
	return readSheet(rows, { decimalComma: delimiter === ";" });
};

const kinds = (sheet: ReturnType<typeof readSheet>) =>
	Object.fromEntries(sheet.columns.map((column) => [column.key, column.kind]));

describe("parseCsv", () => {
	it("reads quoted cells with delimiters, quotes and line breaks in them", () => {
		expect(parseCsv('name,note\r\n"Smith, J","said ""hi""\nthen left"\r\n').rows).toEqual([
			["name", "note"],
			["Smith, J", 'said "hi"\nthen left'],
		]);
	});

	it("finds the delimiter: semicolons and tabs too", () => {
		expect(parseCsv("a;b\n1;2").delimiter).toBe(";");
		expect(parseCsv("a\tb\n1\t2").rows).toEqual([
			["a", "b"],
			["1", "2"],
		]);
	});
});

describe("readNumber", () => {
	it("reads grouped thousands, decimals, signs and a unit after", () => {
		expect(readNumber("1,234.5", false)).toEqual({ value: 1234.5, unit: "" });
		expect(readNumber("1.234,5", true)).toEqual({ value: 1234.5, unit: "" });
		expect(readNumber("1.5", true)).toEqual({ value: 1.5, unit: "" });
		expect(readNumber("-12 min", false)).toEqual({ value: -12, unit: " min" });
		expect(readNumber("92%", false)).toEqual({ value: 92, unit: "%" });
	});

	it("leaves dates, versions and words alone", () => {
		expect(readNumber("2023-01-01", false)).toBeNull();
		expect(readNumber("3.1.2", false)).toBeNull();
		expect(readNumber("Ruby", false)).toBeNull();
		expect(readNumber("1,5", false)).toBeNull();
	});
});

describe("readSheet", () => {
	it("types each column: numbers with their unit, dates, text", () => {
		const sheet = csv("Day;Load;Status;Year\n03/04/2026;12,5 %;ok;2025\n25/04/2026;-;slow;2026\n");
		expect(kinds(sheet)).toEqual({ day: "date", load: "number", status: "text", year: "date" });
		expect(sheet.columns[0].cells).toEqual(["2026-04-03", "2026-04-25"]);
		expect(sheet.columns[1]).toMatchObject({ unit: " %", cells: [12.5, null] });
	});

	it("knows which columns name every row", () => {
		const sheet = sample("battlefieldstats-sent-by-category.csv");
		expect(sheet.columns.map((column) => [column.key, column.namesRows])).toEqual([
			["category", false],
			["item", true],
			["sent", true],
		]);
	});

	it("reads Excel's cells: numbers, yes/no and dates as they are", () => {
		const sheet = readSheet([
			["When", "Open", "Visitors"],
			[new Date(Date.UTC(2026, 9, 30)), true, 1200],
		]);
		// TRUE and FALSE read as yes and no, as links' true and false do (both switch things on and off).
		expect(sheet.columns.map((column) => column.cells[0])).toEqual(["2026-10-30", "yes", 1200]);
	});
});

describe("guessReading", () => {
	it("reads dates with numbers as values over time", () => {
		expect(guessReading(sample("battlefieldstats-sent-daily.csv"))).toEqual({
			readsAs: "history",
			dateColumn: "day",
		});
		expect(guessReading(sample("battlefieldstats-sent-monthly.csv")).readsAs).toBe("history");
	});

	it("reads rows of things as a table, named by the column of names", () => {
		expect(guessReading(sample("the-finals-s8-top-100.csv"))).toEqual({
			readsAs: "table",
			keyColumn: "name",
		});
		expect(guessReading(sample("the-finals-s8-top-clubs.csv"))).toEqual({
			readsAs: "table",
			keyColumn: "club",
		});
	});

	it("reads one row as a value per column, and names beside values as a value per row", () => {
		expect(guessReading(csv("Population,Air quality\n48210,Good")).readsAs).toBe("valuePerColumn");
		expect(guessReading(csv("Metric,Value\nPopulation,48210\nAir quality,Good"))).toEqual({
			readsAs: "valuePerRow",
			nameColumn: "metric",
			valueColumn: "value",
		});
	});

	it("says why a sheet can't be read a way", () => {
		const players = sample("the-finals-s8-top-100.csv");
		expect(whyNotReadAs(players, "history")).toBe("no column of dates");
		expect(whyNotReadAs(csv("a,b\n1,2\n1,2"), "valuePerRow")).toBe("no column names every row");
	});
});

describe("dataFromSheet and putReadData", () => {
	const source = DataSourceSchema.parse({ id: "s1", kind: "file", fileName: "sent.csv" });

	it("makes a value with its history, the latest value last", () => {
		const sheet = sample("battlefieldstats-sent-daily.csv");
		const { values } = dataFromSheet(sheet, guessReading(sheet), {
			sourceId: "s1",
			tableName: "Sent",
		});
		expect(values).toHaveLength(1);
		expect(values[0]).toMatchObject({ key: "sent", source: { sourceId: "s1", path: "sent" } });
		expect(values[0].history).toHaveLength(1399);
		expect(values[0].history[0].at).toBe("2023-01-01");
		expect(values[0].value).toBe(values[0].history.at(-1)?.value);
	});

	it("makes a table with a row per line, by column key", () => {
		const sheet = sample("the-finals-s8-top-clubs.csv");
		const { tables } = dataFromSheet(sheet, guessReading(sheet), {
			sourceId: "s1",
			tableName: "Top clubs",
		});
		expect(tables[0]).toMatchObject({ key: "top_clubs", keyColumn: "club" });
		expect(tables[0].rows).toHaveLength(20);
		expect(tables[0].rows[0]).toMatchObject({ club: "APES", players_in_top_10000: 71 });
	});

	it("reading again replaces what the source gave, keeping keys and names; new keys don't collide", () => {
		const world = WorldDataSchema.parse({
			values: [{ key: "population", name: "Population (typed)", value: 1 }],
		});
		const read = (text: string) => {
			const sheet = csv(text);
			return dataFromSheet(sheet, guessReading(sheet), { sourceId: "s1", tableName: "x" });
		};
		const first = putReadData(world, source, read("Population,Air quality\n48210,Good"));
		expect(first.values.map((each) => each.key)).toEqual([
			"population",
			"population_2",
			"air_quality",
		]);
		const renamed = {
			...first,
			values: first.values.map((each) =>
				each.key === "population_2" ? { ...each, name: "People" } : each,
			),
		};
		const second = putReadData(renamed, source, read("Population,Air quality\n50000,Poor"));
		expect(second.values.map((each) => [each.key, each.name, each.value])).toEqual([
			["population", "Population (typed)", 1],
			["population_2", "People", 50000],
			["air_quality", "Air quality", "Poor"],
		]);
		expect(second.sources).toHaveLength(1);
	});
});
