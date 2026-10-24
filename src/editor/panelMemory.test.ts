import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parsePanelMemory } from "./panelMemory";
import { blockedStorage, memoryStorage, storageEvent } from "./testStorage";

const KEY = "isometrics:panels";

/** A fresh copy of the module, so nothing read by an earlier test is cached. */
const freshModule = async () => {
	vi.resetModules();
	return import("./panelMemory");
};

describe("panelMemory", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.stubGlobal("window", new EventTarget());
	});
	afterEach(() => vi.unstubAllGlobals());

	it("reads which panels were opened or folded, or nothing when it's unreadable", () => {
		expect(parsePanelMemory(null)).toEqual({});
		expect(parsePanelMemory("{nope")).toEqual({});
		expect(parsePanelMemory("[1, 2]")).toEqual({});
		expect(parsePanelMemory(JSON.stringify({ "look.colours": false, "sky.sun": true }))).toEqual({
			"look.colours": false,
			"sky.sun": true,
		});
	});

	it("keeps the readable entries when some aren't on/off values", () => {
		expect(
			parsePanelMemory(JSON.stringify({ "look.colours": false, "sky.sun": "yes", x: null })),
		).toEqual({ "look.colours": false });
	});

	it("stores only the panels folded or opened by hand, under its own key", async () => {
		const { readPanelMemory, setPanelOpen } = await freshModule();
		expect(readPanelMemory()).toEqual({});
		expect(localStorage.getItem(KEY)).toBeNull();

		setPanelOpen("world.ground", false);
		expect(JSON.parse(localStorage.getItem(KEY) ?? "")).toEqual({ "world.ground": false });
		expect(readPanelMemory()).toEqual({ "world.ground": false });
		expect(localStorage.length).toBe(1);
	});

	it("keeps what another tab folded in the meantime", async () => {
		const { readPanelMemory, setPanelOpen } = await freshModule();
		readPanelMemory();
		// Another tab folds a panel after this one has read the storage.
		localStorage.setItem(KEY, JSON.stringify({ "sky.sun": false }));

		setPanelOpen("world.ground", false);
		expect(JSON.parse(localStorage.getItem(KEY) ?? "")).toEqual({
			"sky.sun": false,
			"world.ground": false,
		});
	});

	it("follows another tab's change, and forgets everything when the storage is wiped", async () => {
		const { readPanelMemory, subscribePanelMemory } = await freshModule();
		const listener = vi.fn();
		const unsubscribe = subscribePanelMemory(listener);

		window.dispatchEvent(storageEvent(KEY, JSON.stringify({ "look.colours": false })));
		expect(readPanelMemory()).toEqual({ "look.colours": false });

		window.dispatchEvent(storageEvent("isometrics:world-index", "[]"));
		expect(readPanelMemory()).toEqual({ "look.colours": false });

		window.dispatchEvent(storageEvent(null, null));
		expect(readPanelMemory()).toEqual({});
		expect(listener).toHaveBeenCalledTimes(2);

		unsubscribe();
		window.dispatchEvent(storageEvent(KEY, JSON.stringify({ "sky.sun": false })));
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("still remembers for the session when the storage is blocked", async () => {
		vi.stubGlobal("localStorage", blockedStorage());
		const { readPanelMemory, setPanelOpen } = await freshModule();
		expect(readPanelMemory()).toEqual({});
		expect(() => setPanelOpen("world.ground", false)).not.toThrow();
		setPanelOpen("sky.sun", false);
		expect(readPanelMemory()).toEqual({ "world.ground": false, "sky.sun": false });
	});
});
