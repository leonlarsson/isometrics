import { describe, expect, it } from "vitest";

import { fieldChoicesInJson, fieldChoicesInSheets } from "./fieldChoices";
import { readSheet } from "./sheets";

describe("what a value could be read from", () => {
	it("lists an answer's single numbers and its lists over time, with what each holds now", () => {
		const choices = fieldChoicesInJson({
			totalUsers: 41740,
			days: [
				{ day: "2026-10-30", sent: 7 },
				{ day: "2026-10-31", sent: 9 },
			],
		});
		expect(
			choices.map(({ label, ref, value, history }) => [label, ref, value, history.length]),
		).toEqual([
			["“totalUsers”", { path: "totalUsers", field: "", dateField: "" }, 41740, 0],
			[
				"each entry's “sent”, by its “day” (the list at “days”)",
				{ path: "days", field: "sent", dateField: "day" },
				9,
				2,
			],
		]);
	});

	it("lists a spreadsheet's columns: over time when it has dates, else each one's last row", () => {
		const dated = readSheet([
			["day", "sent"],
			["2026-10-30", "7"],
			["2026-10-31", "9"],
		]);
		expect(
			fieldChoicesInSheets([{ name: null, sheet: dated }]).map(({ label, ref, value, history }) => [
				label,
				ref.path,
				value,
				history.length,
			]),
		).toEqual([["the “sent” column", "sent", 9, 2]]);
		const plain = readSheet([
			["visitors", "rain"],
			["10", "2"],
			["12", "3"],
		]);
		expect(
			fieldChoicesInSheets([
				{ name: "Stats", sheet: plain },
				{ name: "Other", sheet: plain },
			])[0],
		).toMatchObject({ label: "Stats › “visitors”", ref: { path: "Stats!visitors" }, value: 12 });
	});
});
