import { describe, expect, it } from "vitest";

import { WorldDataSchema } from "./schema";
import { storyDates, worldDataAt } from "./story";

const data = WorldDataSchema.parse({
	values: [
		{
			key: "sent",
			value: 30,
			history: [
				{ at: "2026-01", value: 10 },
				{ at: "2026-02", value: 20 },
				{ at: "2026-03", value: 30 },
			],
		},
		{ key: "typed", value: 5 },
	],
	tables: [
		{
			key: "games",
			keyColumn: "game",
			rows: [{ game: "A", players: 3 }],
			history: [
				{ at: "2026-02", rows: [{ game: "A", players: 2 }] },
				{ at: "2026-03", rows: [{ game: "A", players: 3 }] },
			],
		},
	],
});

describe("stories (ADR-0114)", () => {
	it("lists the dates the data has, oldest first", () => {
		expect(storyDates(data)).toEqual(["2026-01", "2026-02", "2026-03"]);
	});

	it("gives the data as it was on a date", () => {
		const then = worldDataAt(data, "2026-02");
		expect(then.values.map((v) => [v.key, v.value])).toEqual([
			["sent", 20],
			["typed", 5],
		]);
		expect(then.values[0].history).toHaveLength(2);
		expect(then.tables[0].rows).toEqual([{ game: "A", players: 2 }]);
	});

	it("has no data before a past starts", () => {
		const before = worldDataAt(data, "2025-12");
		expect(before.values.map((v) => v.key)).toEqual(["typed"]);
		expect(before.tables[0].rows).toEqual([]);
	});
});
