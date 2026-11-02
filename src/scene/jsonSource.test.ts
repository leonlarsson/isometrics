import { describe, expect, it } from "vitest";

import { dataFromJson, describeJson, readJsonPath, readSourceAgain } from "./jsonSource";
import { DataSourceSchema, WorldDataSchema } from "./schema";
import { putReadData } from "./sheets";

/** The shapes of the owner's APIs (docs/data-study, test sources). */
const usersCount = { totalUsers: 41738 };
const daily = [
	{ day: "2026-10-29", sent: 1520 },
	{ day: "2026-10-31", sent: 1692 },
	{ day: "2026-10-30", sent: 1601 },
];
const counts = [
	{ category: "Battlefield 6", item: "messages", sent: 51200 },
	{ category: "Battlefield 2042", item: "messages", sent: 9300 },
];
const leaderboard = {
	meta: { season: "s8" },
	count: 2,
	data: [
		{
			rank: 1,
			name: "Alpha#0001",
			clubTag: "APES",
			league: "Ruby",
			rankScore: 61000,
			stats: { kills: 9 },
		},
		{
			rank: 2,
			name: "Bravo#0002",
			clubTag: "OG",
			league: "Ruby",
			rankScore: 59000,
			stats: { kills: 4 },
		},
	],
};

describe("JSON sources (ADR-0113)", () => {
	it("reads paths into objects and lists", () => {
		expect(readJsonPath(leaderboard, "data.1.clubTag")).toBe("OG");
		expect(readJsonPath(leaderboard, "")).toBe(leaderboard);
		expect(readJsonPath(leaderboard, "data.9.rank")).toBeUndefined();
	});

	it("finds a response's numbers and lists, with their fields", () => {
		expect(describeJson(usersCount).numbers).toEqual([{ path: "totalUsers", value: 41738 }]);
		const [list] = describeJson(leaderboard).lists;
		expect(list.path).toBe("data");
		expect(list.length).toBe(2);
		expect(list.fields).toContainEqual({ path: "rankScore", kind: "number" });
		expect(list.fields).toContainEqual({ path: "stats.kills", kind: "number" });
		expect(describeJson(daily).lists[0].fields).toContainEqual({ path: "day", kind: "date" });
		expect(describeJson(leaderboard).numbers.map((n) => n.path)).toEqual(["count"]);
	});

	it("makes a value, a value over time and a table, each knowing where it's from", () => {
		const read = dataFromJson(daily, "src", [
			{ kind: "history", path: "", field: "sent", dateField: "day", name: "Messages sent" },
		]);
		expect(read.values[0]).toMatchObject({ key: "messages_sent", value: 1692 });
		expect(read.values[0].history.map((p) => p.at)).toEqual([
			"2026-10-29",
			"2026-10-30",
			"2026-10-31",
		]);

		const table = dataFromJson(leaderboard, "src", [
			{
				kind: "table",
				path: "data",
				name: "Top players",
				fields: ["name", "clubTag", "rankScore", "stats.kills"],
				keyField: "name",
				maxRowCount: 1,
			},
		]).tables[0];
		expect(table.keyColumn).toBe("name");
		expect(table.columns.map((c) => [c.key, c.name])).toEqual([
			["name", "Name"],
			["clubtag", "Club tag"],
			["rankscore", "Rank score"],
			["stats_kills", "Kills"],
		]);
		expect(table.rows).toEqual([
			{ name: "Alpha#0001", clubtag: "APES", rankscore: 61000, stats_kills: 9 },
		]);
	});

	it("reads a source again into the same values and tables", () => {
		const source = DataSourceSchema.parse({ id: "bf", kind: "api", url: "https://example.com" });
		const first = putReadData(
			WorldDataSchema.parse({}),
			source,
			dataFromJson({ totalUsers: 10, list: counts }, "bf", [
				{ kind: "value", path: "totalUsers", name: "Users" },
				{
					kind: "table",
					path: "list",
					name: "Counts",
					fields: ["category", "sent"],
					keyField: "category",
					maxRowCount: null,
				},
			]),
		);
		const again = readSourceAgain(first, source, {
			totalUsers: 12,
			list: [{ category: "Battlefield 6", sent: 52000 }],
		});
		expect(again.values).toEqual([{ key: "users", value: 12, history: [] }]);
		expect(again.tables).toEqual([
			{ key: "counts", rows: [{ category: "Battlefield 6", sent: 52000 }] },
		]);
		// What the response no longer has is left out, so it stays as it last was.
		expect(readSourceAgain(first, source, {}).values).toEqual([]);
	});

	it("finds short texts and yes/no too, which a value can hold", () => {
		expect(
			describeJson({ status: "Good", online: true, long: "x".repeat(200), empty: "" }).texts,
		).toEqual([
			{ path: "status", value: "Good" },
			{ path: "online", value: "yes" },
		]);
	});

	it("keeps a value's own settings when it's read again, and tells a list's values apart by field", () => {
		const source = DataSourceSchema.parse({ id: "bf", kind: "api", url: "https://example.com" });
		const days = [
			{ day: "2026-10-30", sent: 7, views: 70 },
			{ day: "2026-10-31", sent: 9, views: 90 },
		];
		const picks = [
			{ kind: "history" as const, path: "days", field: "sent", dateField: "day", name: "Sent" },
			{ kind: "history" as const, path: "days", field: "views", dateField: "day", name: "Views" },
		];
		const first = putReadData(
			WorldDataSchema.parse({}),
			source,
			dataFromJson({ days }, "bf", picks),
		);
		expect(first.values.map((value) => [value.key, value.value])).toEqual([
			["sent", 9],
			["views", 90],
		]);
		const watched = {
			...first,
			values: first.values.map((value) =>
				value.key === "sent"
					? {
							...value,
							about: "Per day",
							numberStyle: "full" as const,
							threshold: { line: 5, flagsWhen: "below" as const, word: "Quiet" },
						}
					: value,
			),
		};
		const again = putReadData(
			watched,
			source,
			dataFromJson({ days: [...days, { day: "2026-11-01", sent: 11, views: 110 }] }, "bf", picks),
		);
		expect(again.values.map((value) => [value.key, value.value])).toEqual([
			["sent", 11],
			["views", 110],
		]);
		expect(again.values[0]).toMatchObject({
			about: "Per day",
			numberStyle: "full",
			threshold: { line: 5 },
		});
	});
});
