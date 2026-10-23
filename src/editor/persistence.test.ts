import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneSchema } from "#/scene/schema";

import {
	createWorld,
	deleteWorld,
	listSceneBackups,
	listWorlds,
	loadStoredScene,
	openStoredWorld,
	openWorldId,
	readSavedRaw,
	saveScene,
	startFreshAfterCrash,
} from "./persistence";

/** Minimal in-memory Storage, since tests run in Node. */
const memoryStorage = () => {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		key: (i: number) => [...data.keys()][i] ?? null,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
		clear: () => data.clear(),
	};
};

/** The single save from before there were several worlds. */
const SINGLE_SAVE_KEY = "isometrics:scene";

const scene = (title: string) => SceneSchema.parse({ version: 1, meta: { title } });

/** Overwrite the open world's stored text, as an older or broken version might have left it. */
const storeRaw = (raw: string) => {
	const id = openWorldId() ?? createWorld(scene("Placeholder"));
	localStorage.setItem(`isometrics:world:${id}`, raw);
};

describe("loadStoredScene", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("reports an empty store", () => {
		expect(loadStoredScene()).toEqual({ status: "empty" });
	});

	it("loads a valid save", () => {
		saveScene(scene("Mine"));
		const result = loadStoredScene();
		expect(result.status).toBe("ok");
		expect(result.status === "ok" && result.scene.meta.title).toBe("Mine");
		expect(listSceneBackups()).toHaveLength(0);
	});

	it("moves the old single save into the list of worlds, exactly as it was", () => {
		const old = JSON.stringify(scene("From before"));
		localStorage.setItem(SINGLE_SAVE_KEY, old);
		const result = loadStoredScene();
		expect(result.status === "ok" && result.scene.meta.title).toBe("From before");
		expect(listWorlds().map((world) => world.title)).toEqual(["From before"]);
		expect(readSavedRaw()).toBe(old);
		expect(localStorage.getItem(SINGLE_SAVE_KEY)).toBeNull();
		// Moving it again (e.g. an old tab saved it once more) doesn't make a second copy.
		localStorage.setItem(SINGLE_SAVE_KEY, old);
		loadStoredScene();
		expect(listWorlds()).toHaveLength(1);
	});

	it("repairs a save it can partly read, and keeps the original as a backup", () => {
		const old = JSON.stringify({
			version: 1,
			meta: { title: "Mine" },
			entities: [{ kind: "x" }, { id: "a", kind: "house" }], // the first has no id
		});
		localStorage.setItem(SINGLE_SAVE_KEY, old);
		const result = loadStoredScene();
		expect(result.status).toBe("repaired");
		if (result.status !== "repaired") {
			return;
		}
		expect(result.scene.meta.title).toBe("Mine");
		expect(result.scene.entities.map((e) => e.id)).toEqual(["a"]);
		expect(result.summary).toMatch(/^1 object couldn’t be read/);
		const backups = listSceneBackups();
		expect(backups).toHaveLength(1);
		expect(backups[0].raw).toBe(old);
		expect(result.backup?.key).toBe(backups[0].key);
		// Loading doesn't touch the stored original.
		expect(readSavedRaw()).toBe(old);
	});

	it("keeps an unreadable save as a backup instead of discarding it", () => {
		const old = JSON.stringify({ hello: "world" }); // valid JSON, but not a world
		storeRaw(old);
		const result = loadStoredScene();
		expect(result.status).toBe("unreadable");
		const backups = listSceneBackups();
		expect(backups).toHaveLength(1);
		expect(backups[0].raw).toBe(old);
		expect(result.status === "unreadable" && result.backup?.key).toBe(backups[0].key);
		// A readable, single-line reason.
		expect(result.status === "unreadable" && result.reason).toMatch(/doesn’t look like a world/);
		expect(readSavedRaw()).toBe(old);
	});

	it("backs up the same unreadable save only once across reloads", () => {
		storeRaw("{not json");
		loadStoredScene();
		loadStoredScene();
		loadStoredScene();
		expect(listSceneBackups()).toHaveLength(1);
	});

	it("keeps only the newest backups", () => {
		let now = 1_000;
		vi.spyOn(Date, "now").mockImplementation(() => now);
		for (let i = 0; i < 8; i++) {
			now += 1_000;
			storeRaw(`{"broken": ${i}`);
			loadStoredScene();
		}
		const backups = listSceneBackups();
		expect(backups).toHaveLength(5);
		expect(backups[0].raw).toBe('{"broken": 7'); // newest first
	});
});

describe("several worlds", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("keeps each world in its own slot and lists them, most recently edited first", () => {
		let now = 1_000;
		vi.spyOn(Date, "now").mockImplementation(() => (now += 1_000));
		const first = createWorld(scene("First"));
		const second = createWorld(scene("Second"));
		expect(openWorldId()).toBe(second);
		expect(listWorlds().map((world) => world.title)).toEqual(["Second", "First"]);

		// Saving goes to the open world only.
		expect(openStoredWorld(first).status).toBe("ok");
		saveScene(scene("First, edited"));
		expect(listWorlds().map((world) => world.title)).toEqual(["First, edited", "Second"]);
		const reopened = openStoredWorld(second);
		expect(reopened.status === "ok" && reopened.scene.meta.title).toBe("Second");
	});

	it("opens the world that was open last time, or else the most recent one", () => {
		const first = createWorld(scene("First"));
		createWorld(scene("Second"));
		openStoredWorld(first);
		const result = loadStoredScene();
		expect(result.status === "ok" && result.scene.meta.title).toBe("First");
	});

	it("deletes a world only after keeping a backup of it", () => {
		const id = createWorld(scene("Doomed"));
		createWorld(scene("Kept"));
		expect(deleteWorld(id)).toBe(true);
		expect(listWorlds().map((world) => world.title)).toEqual(["Kept"]);
		expect(listSceneBackups().map((backup) => JSON.parse(backup.raw).meta.title)).toEqual([
			"Doomed",
		]);
	});

	it("still lists a world the index has lost", () => {
		const id = createWorld(scene("Orphan"));
		localStorage.setItem("isometrics:world-index", "not json");
		expect(listWorlds()).toEqual([{ id, title: "Orphan", updatedAt: 0 }]);
	});

	it("starts fresh after a crash without losing the world", () => {
		createWorld(scene("Crashed"));
		expect(startFreshAfterCrash()).toBe(true);
		expect(loadStoredScene()).toEqual({ status: "empty" });
		expect(listWorlds().map((world) => world.title)).toEqual(["Crashed"]);
		expect(listSceneBackups()).toHaveLength(1);
		// The next save becomes a new world next to it.
		saveScene(scene("Fresh"));
		expect(
			listWorlds()
				.map((world) => world.title)
				.sort(),
		).toEqual(["Crashed", "Fresh"]);
	});
});
