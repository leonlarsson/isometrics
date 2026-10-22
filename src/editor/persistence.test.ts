import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { listSceneBackups, loadStoredScene, saveScene } from "./persistence";

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

const SCENE_KEY = "isometrics:scene";

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
		saveScene(SceneSchema.parse({ version: 1, meta: { title: "Mine" } }));
		const result = loadStoredScene();
		expect(result.status).toBe("ok");
		expect(result.status === "ok" && result.scene.meta.title).toBe("Mine");
		expect(listSceneBackups()).toHaveLength(0);
	});

	it("repairs a save it can partly read, and keeps the original as a backup", () => {
		const old = JSON.stringify({
			version: 1,
			meta: { title: "Mine" },
			entities: [{ kind: "x" }, { id: "a", kind: "house" }], // the first has no id
		});
		localStorage.setItem(SCENE_KEY, old);
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
		// The original save is untouched until the user edits.
		expect(localStorage.getItem(SCENE_KEY)).toBe(old);
	});

	it("keeps an unreadable save as a backup instead of discarding it", () => {
		const old = JSON.stringify({ hello: "world" }); // valid JSON, but not a world
		localStorage.setItem(SCENE_KEY, old);
		const result = loadStoredScene();
		expect(result.status).toBe("unreadable");
		const backups = listSceneBackups();
		expect(backups).toHaveLength(1);
		expect(backups[0].raw).toBe(old);
		expect(result.status === "unreadable" && result.backup?.key).toBe(backups[0].key);
		// A readable, single-line reason.
		expect(result.status === "unreadable" && result.reason).toMatch(/doesn’t look like a world/);
		expect(localStorage.getItem(SCENE_KEY)).toBe(old);
	});

	it("backs up the same unreadable save only once across reloads", () => {
		localStorage.setItem(SCENE_KEY, "{not json");
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
			localStorage.setItem(SCENE_KEY, `{"broken": ${i}`);
			loadStoredScene();
		}
		const backups = listSceneBackups();
		expect(backups).toHaveLength(5);
		expect(backups[0].raw).toBe('{"broken": 7'); // newest first
	});
});
