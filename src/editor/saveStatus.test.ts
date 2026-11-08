import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { memoryStorage, storageEvent } from "./testStorage";

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

	it("starts as not saved when the browser blocks storage, and opens anyway (ADR-0145)", async () => {
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			get() {
				throw new DOMException("The operation is insecure.", "SecurityError");
			},
		});
		try {
			const { readSaveStatus, loadStoredScene } = await fresh();
			// Every module that reads storage as it loads, loaded without throwing.
			await import("./linkTrust");
			await import("./userWorlds");
			await import("./userPrefabs");
			loadStoredScene();
			expect(readSaveStatus()).toEqual({ state: "failed", reason: "unavailable" });
		} finally {
			Reflect.deleteProperty(globalThis, "localStorage");
		}
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

describe("another tab of the app (ADR-0158)", () => {
	const OPEN = "isometrics:open-world-id";
	const stored = (id: string) => localStorage.getItem(`isometrics:world:${id}`);
	const titleIn = (id: string) => JSON.parse(stored(id) ?? "null")?.meta.title;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("localStorage", memoryStorage());
		vi.stubGlobal("sessionStorage", memoryStorage());
		vi.stubGlobal("window", new EventTarget());
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	/** This tab: world `title` open and autosaving. The other tab is `fresh()` again, on the same storage. */
	const thisTab = async (title: string) => {
		const tab = await fresh();
		const id = tab.createWorld(scene(title));
		const store = tab.createEditorStore(scene(title));
		const stop = tab.startAutosave(store as never, 300);
		const edit = (to: string) => {
			store.getState().commit((s) => {
				s.meta.title = to;
			});
			vi.advanceTimersByTime(300);
		};
		return { ...tab, id, store, stop, edit };
	};

	it("stops saving when another tab opens a different world, rather than write over it", async () => {
		const here = await thisTab("Here");
		const there = await fresh();
		const other = there.createWorld(scene("There"));
		window.dispatchEvent(storageEvent(OPEN, other, here.id));
		expect(here.readSaveStatus()).toEqual({ state: "failed", reason: "changedElsewhere" });

		here.edit("Changed here");
		expect(titleIn(other)).toBe("There");
		expect(titleIn(here.id)).toBe("Here");
		expect(here.readSaveStatus()).toEqual({ state: "failed", reason: "changedElsewhere" });
		expect(here.savingHasStopped()).toBe(true);

		// Opening a world here makes it this tab's again, and it saves.
		expect(here.openStoredWorld(here.id).status).toBe("ok");
		expect(here.savingHasStopped()).toBe(false);
		expect(here.readSaveStatus().state).toBe("saved");
		here.edit("Saved again");
		expect(titleIn(here.id)).toBe("Saved again");
		expect(localStorage.getItem(OPEN)).toBe(here.id);
		here.stop();
	});

	it("stops saving when another tab wipes everything, so the world doesn't come back", async () => {
		const here = await thisTab("Here");
		(await fresh()).wipeEverything();
		window.dispatchEvent(storageEvent(null, null));

		here.edit("Late edit");
		expect(localStorage.length).toBe(0);
		expect(here.readSaveStatus()).toEqual({ state: "failed", reason: "wipedElsewhere" });
		// A world opened here doesn't save again either while it's gone: there's none to open.
		expect(here.openStoredWorld(here.id).status).toBe("empty");
		here.stop();
	});

	it("stops a change waiting for the autosave too", async () => {
		const here = await thisTab("Here");
		here.store.getState().commit((s) => {
			s.meta.title = "Waiting";
		});
		localStorage.removeItem(OPEN);
		window.dispatchEvent(storageEvent(OPEN, null, here.id));
		vi.advanceTimersByTime(300);
		expect(titleIn(here.id)).toBe("Here");
		here.stop();
	});

	it("goes on saving for other keys, an unchanged open world, or once stopped listening", async () => {
		const here = await thisTab("Here");
		window.dispatchEvent(storageEvent("isometrics:panels", "{}"));
		window.dispatchEvent(storageEvent(OPEN, here.id, here.id));
		here.edit("Still saved");
		expect(titleIn(here.id)).toBe("Still saved");

		here.stop();
		window.dispatchEvent(storageEvent(null, null));
		expect(here.savingHasStopped()).toBe(false);
	});

	it("doesn't stop a tab with no world of its own open: the home screen, or a preview", async () => {
		const here = await thisTab("Here");
		here.store.getState().setWhatIsOpen({ kind: "home", why: { kind: "chosen" } });
		window.dispatchEvent(storageEvent(null, null));
		expect(here.savingHasStopped()).toBe(false);

		here.store.getState().setWhatIsOpen({
			kind: "world",
			preview: { link: { from: "shared", id: "abc" } } as never,
			workshop: null,
		});
		window.dispatchEvent(storageEvent(OPEN, "other", here.id));
		expect(here.savingHasStopped()).toBe(false);
		here.stop();
	});

	it("never saves again after this tab wiped everything, even opening a world", async () => {
		const here = await thisTab("Here");
		here.wipeEverything();
		const id = here.createWorld(scene("After the wipe"));
		expect(stored(id)).toBeNull();
		expect(here.readSaveStatus()).toEqual({ state: "failed", reason: "wiped" });
		here.stop();
	});
});

describe("stopReasonOf", () => {
	it("stops for a wipe, or the open world changing, and nothing else", async () => {
		const { stopReasonOf, OPEN_WORLD_ID_KEY } = await import("./persistence");
		expect(stopReasonOf({ key: null, oldValue: null, newValue: null })).toBe("wipedElsewhere");
		expect(stopReasonOf({ key: OPEN_WORLD_ID_KEY, oldValue: "a", newValue: "b" })).toBe(
			"changedElsewhere",
		);
		expect(stopReasonOf({ key: OPEN_WORLD_ID_KEY, oldValue: "a", newValue: null })).toBe(
			"changedElsewhere",
		);
		expect(stopReasonOf({ key: OPEN_WORLD_ID_KEY, oldValue: "a", newValue: "a" })).toBeNull();
		expect(stopReasonOf({ key: "isometrics:world:a", oldValue: "{}", newValue: "{}" })).toBeNull();
	});
});
