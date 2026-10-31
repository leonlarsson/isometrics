import { describe, expect, it } from "vitest";

import { changeOf, changeWords, flagOf, sinceWords, thresholdWords } from "./trends";

describe("trends and thresholds (ADR-0110)", () => {
	it("says how much a value moved since the point before", () => {
		const entry = {
			value: 1692,
			history: [
				{ at: "2026-08", value: 1500 },
				{ at: "2026-09", value: 1840 },
				{ at: "2026-10", value: 1692 },
			],
		};
		const change = changeOf(entry);
		expect(change?.since).toBe("2026-09");
		expect(changeWords(change ?? { share: 0, since: "" })).toBe("▼ 8% on September");
		// A value that arrived since its last point is compared with that point.
		expect(changeOf({ ...entry, value: 2000 })?.since).toBe("2026-10");
		expect(changeOf({ value: "on", history: [] })).toBeNull();
	});

	it("words dates as a change says them", () => {
		expect(sinceWords("2026-10-30")).toBe("since 30 Oct");
		expect(sinceWords("2025")).toBe("on 2025");
	});

	it("flags a value past its line, with a word", () => {
		const threshold = { line: 30, flagsWhen: "below" as const, word: "Watch" };
		expect(flagOf({ value: 25, threshold })).toBe("Watch");
		expect(flagOf({ value: 31, threshold })).toBeNull();
		expect(flagOf({ value: 31, threshold: { ...threshold, flagsWhen: "above" } })).toBe("Watch");
		expect(thresholdWords({ threshold, unit: "" })).toBe("under 30");
	});
});
