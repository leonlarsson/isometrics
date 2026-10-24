import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { memoryStorage } from "./testStorage";

const scene = (title: string) => SceneSchema.parse({ version: 1, meta: { title } });

/** Fresh copies of the modules, so a status (or a wipe) from an earlier test doesn't carry over. */
const fresh = async () => {
	vi.resetModules();
	const persistence = await import("./persistence");
	const { createEditorStore } = await import("./store");
	return { ...persistence, createEditorStore };
};

/** A storage whose writes fail the way a browser's do. */
const failingStorage = (name: string) => {
	const storage = memoryStorage();
	storage.setItem = () => {
		throw new DOMException("Can't store", name);
	};
	return storage;
};

describe("save status (ADR-0057)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("localStorage", memoryStorage());
		vi.stubGlobal("sessionStorage", memoryStorage());
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("starts as new, before anything is saved", async () => {
		const { readSaveStatus, loadStoredScene } = await fresh();
		loadStoredScene();
		expect(readSaveStatus()).toEqual({ state: "new" });
	});

	it("is saved when a stored world opens, as of its last save", async () => {
		vi.setSystemTime(1_000_000);
		(await fresh()).saveScene(scene("Mine"));
		vi.setSystemTime(2_000_000);
		// The next visit: the page loads again and opens it.
		const { readSaveStatus, loadStoredScene } = await fresh();
		loadStoredScene();
		expect(readSaveStatus()).toEqual({ state: "saved", at: 1_000_000 });
	});

	it("is saving while a change waits for the autosave, then saved", async () => {
		const { readSaveStatus, startAutosave, createEditorStore } = await fresh();
		const store = createEditorStore(scene("World"));
		const stop = startAutosave(store as never, 300);
		store.getState().commit((s) => {
			s.meta.title = "Changed";
		});
		expect(readSaveStatus()).toEqual({ state: "saving" });
		vi.setSystemTime(5_000_000);
		vi.advanceTimersByTime(300);
		// The fake clock moved on with the timers.
		expect(readSaveStatus()).toEqual({ state: "saved", at: 5_000_300 });
		stop();
	});

	it("says why it isn't saved: storage full, or none at all", async () => {
		vi.stubGlobal("localStorage", failingStorage("QuotaExceededError"));
		const full = await fresh();
		full.saveScene(scene("Big"));
		expect(full.readSaveStatus()).toEqual({ state: "failed", reason: "full" });

		vi.stubGlobal("localStorage", failingStorage("SecurityError"));
		const blocked = await fresh();
		blocked.saveScene(scene("Private"));
		expect(blocked.readSaveStatus()).toEqual({ state: "failed", reason: "unavailable" });
	});

	it("isn't saved after everything was wiped", async () => {
		const { readSaveStatus, saveScene, wipeEverything } = await fresh();
		saveScene(scene("Mine"));
		wipeEverything();
		saveScene(scene("Late autosave"));
		expect(readSaveStatus()).toEqual({ state: "failed", reason: "wiped" });
	});
});
