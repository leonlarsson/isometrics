import { describe, expect, it } from "vitest";

import { matchesSearch } from "./settingsSearch";

describe("matchesSearch", () => {
	it("matches when every word of the query is in the text, in any order or case", () => {
		expect(matchesSearch("Sunlight colour", "colour")).toBe(true);
		expect(matchesSearch("Sunlight colour", "COLOUR sun")).toBe(true);
		expect(matchesSearch("Sunlight colour", "sun height")).toBe(false);
		expect(matchesSearch("Ground", "  ")).toBe(true);
	});
});
