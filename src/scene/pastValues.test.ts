import { describe, expect, it } from "vitest";

import {
	changePoint,
	dateForNewEntry,
	isPastDate,
	recordPoint,
	removePoint,
	todayAsDate,
} from "./pastValues";

const past = [
	{ at: "2026-10-27", value: 1180 },
	{ at: "2026-10-28", value: 1260 },
];

describe("past values kept by hand", () => {
	it("records a date's number: added in order, or that date's replaced", () => {
		expect(recordPoint(past, { at: "2026-10-26", value: 1000 }).map((point) => point.at)).toEqual([
			"2026-10-26",
			"2026-10-27",
			"2026-10-28",
		]);
		expect(recordPoint(past, { at: "2026-10-28", value: 1300 })).toEqual([
			{ at: "2026-10-27", value: 1180 },
			{ at: "2026-10-28", value: 1300 },
		]);
	});

	it("changes an entry and keeps them in order, refusing a date another has", () => {
		expect(changePoint(past, 1, { at: "2026-10-20", value: 5 })?.map((point) => point.at)).toEqual([
			"2026-10-20",
			"2026-10-27",
		]);
		expect(changePoint(past, 1, { at: "2026-10-27", value: 5 })).toBeNull();
		expect(removePoint(past, 0)).toEqual([{ at: "2026-10-28", value: 1260 }]);
	});

	it("starts a new entry the day, month or year before the oldest, or today", () => {
		expect(dateForNewEntry(past)).toBe("2026-10-26");
		expect(dateForNewEntry([{ at: "2026-01", value: 1 }])).toBe("2025-12");
		expect(dateForNewEntry([{ at: "2024", value: 1 }])).toBe("2023");
		expect(dateForNewEntry([], "2026-11-02")).toBe("2026-11-02");
		expect(todayAsDate(new Date(2026, 10, 2, 9))).toBe("2026-11-02");
	});

	it("knows a date when it sees one", () => {
		expect(["2026", "2026-10", "2026-10-30", "2026-10-30T14:00:00Z"].every(isPastDate)).toBe(true);
		expect(["", "yesterday", "2026-13-45", "30/10/2026"].some(isPastDate)).toBe(false);
	});
});
