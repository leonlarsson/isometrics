import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parsePaletteMemory, toFront } from "./paletteMemory";
import { blockedStorage, memoryStorage, storageEvent } from "./testStorage";

const KEY = "isometrics:palette";

/** A fresh copy of the module, so nothing read by an earlier test is cached. */
const freshModule = async () => {
	vi.resetModules();
	return import("./paletteMemory");
};

describe("paletteMemory", () => {
	it("reads empty lists when nothing is stored or it's unreadable", () => {
		const empty = { favourites: [], recent: [], collapsed: [], category: null, layout: "grid" };
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

	describe("in storage", () => {
		beforeEach(() => {
			vi.stubGlobal("localStorage", memoryStorage());
			vi.stubGlobal("window", new EventTarget());
		});
		afterEach(() => vi.unstubAllGlobals());

		it("keeps what another tab changed in the meantime", async () => {
			const { readPaletteMemory, toggleFavourite, rememberUsed } = await freshModule();
			readPaletteMemory();
			// Another tab favourites a part after this one has read the storage.
			localStorage.setItem(KEY, JSON.stringify({ favourites: ["part:house_01"] }));

			toggleFavourite("part:car_01");
			rememberUsed("road:road_01");
			expect(JSON.parse(localStorage.getItem(KEY) ?? "")).toEqual({
				favourites: ["part:house_01", "part:car_01"],
				recent: ["road:road_01"],
				collapsed: [],
				category: null,
				layout: "grid",
			});
		});

		it("follows another tab's change, and forgets everything when the storage is wiped", async () => {
			const { readPaletteMemory, subscribePaletteMemory } = await freshModule();
			const listener = vi.fn();
			const unsubscribe = subscribePaletteMemory(listener);

			window.dispatchEvent(storageEvent(KEY, JSON.stringify({ favourites: ["part:house_01"] })));
			expect(readPaletteMemory().favourites).toEqual(["part:house_01"]);

			window.dispatchEvent(storageEvent(null, null));
			expect(readPaletteMemory().favourites).toEqual([]);
			expect(listener).toHaveBeenCalledTimes(2);
			unsubscribe();
		});

		it("still remembers for the session when the storage is blocked", async () => {
			vi.stubGlobal("localStorage", blockedStorage());
			const { readPaletteMemory, toggleFavourite } = await freshModule();
			toggleFavourite("part:house_01");
			toggleFavourite("part:car_01");
			expect(readPaletteMemory().favourites).toEqual(["part:house_01", "part:car_01"]);
		});
	});
});
