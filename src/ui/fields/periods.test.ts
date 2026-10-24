import { describe, expect, it } from "vitest";

import { dragPeriods, formatClock, parseClock, periodSpans } from "./periods";

describe("clock times", () => {
	it("reads 24-hour times typed several ways, and nothing that isn't a time", () => {
		expect(["19:30", "1930", "19.30", "7:05", "19", "0", "24:00"].map(parseClock)).toEqual([
			19.5,
			19.5,
			19.5,
			7 + 5 / 60,
			19,
			0,
			24,
		]);
		expect(["", "1", "19:", "19:3", "25:00", "24:30", "12:60", "noon"].map(parseClock)).toEqual([
			null,
			1,
			null,
			null,
			null,
			null,
			null,
			null,
		]);
	});

	it("writes hours as 24-hour times, midnight as 00:00", () => {
		expect([19.5, 5, 0, 24, 23 + 59 / 60].map(formatClock)).toEqual([
			"19:30",
			"05:00",
			"00:00",
			"00:00",
			"23:59",
		]);
	});
});

describe("the 24-hour strip", () => {
	const periods = [
		{ from: 5, until: 8 },
		{ from: 22, until: 2 },
	];

	it("lays periods out, splitting one past midnight in two", () => {
		expect(periodSpans(periods)).toEqual([
			{ index: 0, start: 5, end: 8, startsPeriod: true, endsPeriod: true },
			{ index: 1, start: 22, end: 24, startsPeriod: true, endsPeriod: false },
			{ index: 1, start: 0, end: 2, startsPeriod: false, endsPeriod: true },
		]);
		expect(periodSpans([{ from: 6, until: 6 }])).toEqual([]);
	});

	it("moves a period whole, in quarter hours, around midnight too", () => {
		const move = { kind: "move" as const, index: 0, from: 6, original: periods[0] };
		expect(dragPeriods(periods, move, 7.1)[0]).toEqual({ from: 6, until: 9 });
		expect(dragPeriods(periods, move, 6 + 20)[0]).toEqual({ from: 1, until: 4 });
		expect(dragPeriods(periods, { ...move, from: 23 }, 21)[0]).toEqual({ from: 3, until: 6 });
	});

	it("drags a period's start or end, but never to nothing", () => {
		expect(dragPeriods(periods, { kind: "start", index: 0 }, 4.4)[0]).toEqual({
			from: 4.5,
			until: 8,
		});
		expect(dragPeriods(periods, { kind: "end", index: 1 }, 3)[1]).toEqual({ from: 22, until: 3 });
		expect(dragPeriods(periods, { kind: "end", index: 0 }, 5)[0]).toEqual({ from: 5, until: 8 });
	});

	it("adds a period by dragging on an empty part, once it's at least a quarter hour", () => {
		const add = { kind: "add" as const, from: 12, index: null };
		expect(dragPeriods(periods, add, 12.1)).toHaveLength(2);
		expect(dragPeriods(periods, add, 14.6)).toEqual([...periods, { from: 12, until: 14.5 }]);
		expect(dragPeriods(periods, add, 10)[2]).toEqual({ from: 10, until: 12 });
		// Dragging back to nothing takes it away again.
		const added = [...periods, { from: 12, until: 14.5 }];
		expect(dragPeriods(added, { ...add, index: 2 }, 12)).toEqual(periods);
	});
});
