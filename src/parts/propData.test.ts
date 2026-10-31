import { describe, expect, it } from "vitest";

import { assignRowsByName, layoutSpot, placeForEachRow, sizeBindingFor } from "#/editor/dataRows";
import { rowEntries, rowKeyMatching, valuesWithRow } from "#/scene/rowData";
import { DataBindingSchema, SceneSchema, WorldDataSchema } from "#/scene/schema";

import { readSetting } from "./dataBinding";
import { entityAsDrawn, scaleFromData, valuesOfEntity } from "./propData";

const data = WorldDataSchema.parse({
	values: [{ key: "visitors", value: 120 }],
	tables: [
		{
			key: "clubs",
			keyColumn: "club",
			columns: [
				{ key: "club", name: "Club" },
				{ key: "players", name: "Players", threshold: { line: 30, flagsWhen: "below" } },
				{ key: "league" },
			],
			rows: [
				{ club: "APES", players: 71, league: "Ruby" },
				{ club: "CGM", players: 25, league: "Diamond 3" },
				{ club: "Hunt: Showdown 1896", players: null, league: "Gold" },
			],
			history: [
				{ at: "2026-09-01", rows: [{ club: "APES", players: 60 }] },
				{ at: "2026-10-01", rows: [{ club: "APES", players: 66 }] },
			],
		},
	],
});

describe("things that follow a table row (ADR-0108)", () => {
	it("reads a row's columns as row.<column>, with names, past values and the column's line", () => {
		const entries = rowEntries(data.tables[0], "APES");
		expect(entries.map((entry) => [entry.key, entry.value])).toEqual([
			["row.club", "APES"],
			["row.players", 71],
			["row.league", "Ruby"],
		]);
		expect(entries[1].name).toBe("Players");
		expect(entries[1].history).toEqual([
			{ at: "2026-09-01", value: 60 },
			{ at: "2026-10-01", value: 66 },
		]);
		expect(entries[1].threshold?.line).toBe(30);
	});

	it("leaves empty cells out, so they read as no data", () => {
		const keys = rowEntries(data.tables[0], "Hunt: Showdown 1896").map((entry) => entry.key);
		expect(keys).not.toContain("row.players");
	});

	it("adds the row to the world's values, and gives the same list for the same row", () => {
		const ref = { tableKey: "clubs", rowKey: "CGM" };
		const values = valuesWithRow(data, ref);
		expect(values.map((entry) => entry.key)).toEqual([
			"visitors",
			"row.club",
			"row.players",
			"row.league",
		]);
		expect(valuesWithRow(data, { ...ref })).toBe(values);
		expect(valuesWithRow(data, null)).toBe(data.values);
		expect(valuesWithRow(data, { tableKey: "gone", rowKey: "x" })).toBe(data.values);
	});

	it("matches names to rows loosely", () => {
		expect(rowKeyMatching(data.tables[0], "apes")).toBe("APES");
		expect(rowKeyMatching(data.tables[0], "hunt showdown 1896")).toBe("Hunt: Showdown 1896");
		expect(rowKeyMatching(data.tables[0], "Nobody")).toBeUndefined();
	});
});

describe("sizes from data (ADR-0109)", () => {
	const range = { min: 1, max: 40 };
	const bind = (options: object) => DataBindingSchema.parse({ key: "v", ...options });
	const at = (value: number, options: object) =>
		readSetting(bind(options), [{ key: "v", value }], range);

	it("places a number between the range on a straight scale, clamped", () => {
		const options = { valueAtLowSetting: 0, valueAtHighSetting: 100 };
		expect(at(0, options)).toBe(1);
		expect(at(50, options)).toBeCloseTo(20.5);
		expect(at(500, options)).toBe(40);
		expect(at(-5, options)).toBe(1);
	});

	it("places it on a log scale, where each tenfold is the same step", () => {
		const options = {
			usesLogScale: true,
			valueAtLowSetting: 100,
			valueAtHighSetting: 100_000,
			lowSetting: 0,
			highSetting: 3,
		};
		expect(at(100, options)).toBeCloseTo(0);
		expect(at(1000, options)).toBeCloseTo(1);
		expect(at(10_000, options)).toBeCloseTo(2);
		expect(at(0, options)).toBeCloseTo(0);
	});

	it("leaves text alone", () => {
		expect(readSetting(bind({}), [{ key: "v", value: "lots" }], range)).toBeUndefined();
	});

	it("draws an object with its props and size from its row, keeping what's stored", () => {
		const entity = SceneSchema.parse({
			version: 1,
			entities: [
				{
					id: "tower",
					kind: "office_tower_01",
					dataRow: { tableKey: "clubs", rowKey: "APES" },
					data: {
						floorCount: { key: "row.players", valueAtLowSetting: 0, valueAtHighSetting: 80 },
						scale: { key: "visitors", valueAtLowSetting: 0, valueAtHighSetting: 120 },
					},
				},
			],
		}).entities[0];
		const values = valuesOfEntity(entity, data);
		const drawn = entityAsDrawn(entity, values);
		// 71 of 80 on 1–40 floors: 1 + 71/80 × 39 = 35.6, to the field's step.
		expect(drawn.props.floorCount).toBe(36);
		expect(drawn.scale).toBe(4);
		expect(entity.props.floorCount).toBeUndefined();
		expect(entityAsDrawn(entity, values)).toBe(drawn);
		expect(scaleFromData({ data: {} }, values)).toBeUndefined();
	});
});

describe("assigning rows and placing one for each (ADR-0108)", () => {
	const scene = () =>
		SceneSchema.parse({
			version: 1,
			data,
			entities: [
				{ id: "a", kind: "house_01", name: "Apes" },
				{ id: "b", kind: "house_01", label: { title: "cgm" } },
				{ id: "c", kind: "house_01", name: "Nobody" },
			],
		});

	it("gives each object the row matching its name, and says which matched none", () => {
		const draft = scene();
		const result = assignRowsByName(draft, ["a", "b", "c"], data.tables[0]);
		expect(result.matched.map((each) => each.rowKey)).toEqual(["APES", "CGM"]);
		expect(result.unmatched).toEqual([{ id: "c", name: "Nobody" }]);
		expect(draft.entities[0].dataRow).toEqual({ tableKey: "clubs", rowKey: "APES" });
		expect(draft.entities[2].dataRow).toBeNull();
	});

	it("places an object for each row, following it, sized by a column", () => {
		const draft = scene();
		const ids = placeForEachRow(draft, {
			table: data.tables[0],
			kind: "office_tower_01",
			layout: "grid",
			spacing: 4,
			sizeColumn: "players",
			sizeSetting: "floorCount",
			usesLogScale: false,
			cardColumns: ["players"],
		});
		expect(ids).toHaveLength(3);
		const placed = draft.entities.filter((entity) => ids.includes(entity.id));
		expect(placed.map((entity) => entity.name)).toEqual(["APES", "CGM", "Hunt: Showdown 1896"]);
		expect(placed[0].dataRow).toEqual({ tableKey: "clubs", rowKey: "APES" });
		expect(placed[0].label.dataKeys).toEqual(["row.players"]);
		expect(placed[0].data.floorCount).toMatchObject({
			key: "row.players",
			valueAtLowSetting: 25,
			valueAtHighSetting: 71,
		});
	});

	it("lays out grids, lines and circles round the centre", () => {
		expect(layoutSpot("line", 0, 3, 2)).toEqual([-2, 0]);
		expect(layoutSpot("grid", 3, 4, 2)).toEqual([1, 1]);
		const [x, z] = layoutSpot("circle", 0, 8, 3);
		expect(x).toBeCloseTo(0);
		expect(z).toBeLessThan(0);
	});

	it("starts a log scale's range at its smallest value above 0", () => {
		const table = { rows: [{ v: 0 }, { v: 10 }, { v: 1000 }] };
		expect(sizeBindingFor(table, "v", true)).toMatchObject({
			valueAtLowSetting: 10,
			valueAtHighSetting: 1000,
		});
	});
});
