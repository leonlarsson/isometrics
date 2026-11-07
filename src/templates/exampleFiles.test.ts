import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DataSourceSchema } from "#/scene/schema";
import { dataFromSheet, guessReading, parseCsv, readSheet } from "#/scene/sheets";

import { TEMPLATES } from "./index";

/** Every template's spreadsheet sources that name an example file of this site's own. */
const examples = TEMPLATES.flatMap((template) => {
	const scene = template.create();
	return scene.data.sources
		.filter((source) => source.exampleFileUrl)
		.map((source) => [`${template.id}: ${source.exampleFileUrl}`, scene, source] as const);
});

describe("the templates' example files (kept on this site, /examples/)", () => {
	it("are there for the data templates", () => {
		expect(examples.length).toBeGreaterThan(0);
	});

	it.each(examples)("%s is there, and reads back as the template holds it", (_, scene, source) => {
		const path = `public${source.exampleFileUrl}`;
		expect(existsSync(path)).toBe(true);
		const sheet = readSheet(parseCsv(readFileSync(path, "utf8")).rows);
		const read = dataFromSheet(sheet, guessReading(sheet), {
			sourceId: source.id,
			tableName: source.name,
		});
		for (const value of scene.data.values.filter((each) => each.source?.sourceId === source.id)) {
			const got = read.values.find((each) => each.source?.path === value.source?.path);
			expect(got?.value, value.key).toEqual(value.value);
			expect(got?.history, value.key).toEqual(value.history);
		}
		for (const table of scene.data.tables.filter((each) => each.source?.sourceId === source.id)) {
			const rows = read.tables[0]?.rows ?? [];
			const keys = table.columns.map((column) => column.key);
			const shown = (row: Record<string, unknown>) =>
				Object.fromEntries(keys.map((key) => [key, row[key] ?? null]));
			expect(rows.map(shown), table.key).toEqual(table.rows.map(shown));
			// A table over time (ADR-0153): its past is the file's, date by date.
			if ((read.tables[0]?.history.length ?? 0) > 0) {
				expect(
					read.tables[0].history.map((moment) => ({ at: moment.at, rows: moment.rows.map(shown) })),
					`${table.key}'s past`,
				).toEqual(table.history.map((moment) => ({ at: moment.at, rows: moment.rows.map(shown) })));
			}
		}
	});

	it("can only be this site's own example files", () => {
		const file = (exampleFileUrl: string) =>
			DataSourceSchema.safeParse({ id: "s", kind: "file", exampleFileUrl }).success;
		expect(file("/examples/battlefieldstats-sent-monthly.csv")).toBe(true);
		expect(file("https://evil.example/x.csv")).toBe(false);
		expect(file("/examples/../secrets.csv")).toBe(false);
		expect(file("//evil.example/examples/x.csv")).toBe(false);
		expect(file("javascript:alert(1)")).toBe(false);
	});
});
