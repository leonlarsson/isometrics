import { describe, expect, it } from "vitest";

import { parsePaletteMemory, toFront } from "./paletteMemory";

describe("paletteMemory", () => {
	it("reads empty lists when nothing is stored or it's unreadable", () => {
		const empty = { favourites: [], recent: [], collapsed: [] };
		expect(parsePaletteMemory(null)).toEqual(empty);
		expect(parsePaletteMemory("{nope")).toEqual(empty);
		expect(parsePaletteMemory("5")).toEqual(empty);
		expect(
			parsePaletteMemory(JSON.stringify({ favourites: "x", recent: ["part:house_01"] })),
		).toEqual({
			...empty,
			recent: ["part:house_01"],
		});
	});

	it("moves a used item to the front, without repeats, within the limit", () => {
		expect(toFront(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
		expect(toFront(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
	});
});
