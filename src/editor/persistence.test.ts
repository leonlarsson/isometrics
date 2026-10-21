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

	it("keeps an unreadable save as a backup instead of discarding it", () => {
		const old = JSON.stringify({ version: 1, paths: [], entities: [{ kind: "x" }] }); // entity without id
		localStorage.setItem(SCENE_KEY, old);
		const result = loadStoredScene();
		expect(result.status).toBe("unreadable");
		const backups = listSceneBackups();
		expect(backups).toHaveLength(1);
		expect(backups[0].raw).toBe(old);
		expect(result.status === "unreadable" && result.backup?.key).toBe(backups[0].key);
		// A readable, single-line reason pointing at the problem.
		expect(result.status === "unreadable" && result.reason).toMatch(/^entities\.0\.id: /);
		// The original save is untouched until the user edits.
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
