import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrefabSchema, SceneSchema } from "#/scene/schema";

import { PREFAB_LIBRARY_KEY, parsePrefabLibrary } from "./prefabLibrary";
import { blockedStorage, memoryStorage, storageEvent } from "./testStorage";

const design = (id: string, name = "Kiosk") =>
	PrefabSchema.parse({ id, name, entities: [{ id: "box", kind: "box_01" }] });

/** A fresh copy of the modules, so nothing read by an earlier test is cached. */
const freshModules = async () => {
	vi.resetModules();
	return {
		library: await import("./prefabLibrary"),
		store: (await import("./store")).useEditor,
	};
};

describe("My prefabs (ADR-0134)", () => {
	it("reads what's stored like any world from outside, and nothing from what can't be read", () => {
		expect(parsePrefabLibrary(null)).toEqual([]);
		expect(parsePrefabLibrary("{nope")).toEqual([]);
		expect(parsePrefabLibrary(JSON.stringify({ not: "a list" }))).toEqual([]);
		const old = parsePrefabLibrary(
			JSON.stringify([
				{ id: "prefab_old", entities: [{ id: "a", kind: "house", elevation: 1 }] },
				{ id: "no_prefix" },
			]),
		);
		expect(old.map((prefab) => prefab.id)).toEqual(["prefab_old"]);
		expect(old[0].entities[0]).toMatchObject({ kind: "house_01", altitude: 1 });
	});

	describe("in storage", () => {
		beforeEach(() => {
			vi.stubGlobal("localStorage", memoryStorage());
			vi.stubGlobal("window", new EventTarget());
		});
		afterEach(() => vi.unstubAllGlobals());

		it("keeps the newest first, one per prefab, and removes one", async () => {
			const { library } = await freshModules();
			library.keepInLibrary(design("prefab_a", "A"));
			library.keepInLibrary(design("prefab_b", "B"));
			library.keepInLibrary(design("prefab_a", "A again"));
			expect(library.readPrefabLibrary().map((prefab) => prefab.name)).toEqual(["A again", "B"]);
			library.removeFromLibrary("prefab_a");
			expect(library.readPrefabLibrary().map((prefab) => prefab.id)).toEqual(["prefab_b"]);
			expect(JSON.parse(localStorage.getItem(PREFAB_LIBRARY_KEY) ?? "")).toHaveLength(1);
		});

		it("keeps what another tab kept in the meantime, and follows its changes", async () => {
			const { library } = await freshModules();
			library.readPrefabLibrary();
			localStorage.setItem(PREFAB_LIBRARY_KEY, JSON.stringify([design("prefab_other")]));
			library.keepInLibrary(design("prefab_mine"));
			expect(library.readPrefabLibrary().map((prefab) => prefab.id)).toEqual([
				"prefab_mine",
				"prefab_other",
			]);
			const unsubscribe = library.subscribePrefabLibrary(() => {});
			window.dispatchEvent(storageEvent(null, null));
			expect(library.readPrefabLibrary()).toEqual([]);
			unsubscribe();
		});

		it("still keeps them for the session when the storage is blocked", async () => {
			vi.stubGlobal("localStorage", blockedStorage());
			const { library } = await freshModules();
			expect(library.keepInLibrary(design("prefab_a"))).toBe(false);
			library.keepInLibrary(design("prefab_b"));
			expect(library.readPrefabLibrary().map((prefab) => prefab.id)).toEqual([
				"prefab_b",
				"prefab_a",
			]);
		});

		it("places one in a world, its design copied in, as one undo step", async () => {
			const { library, store } = await freshModules();
			store
				.getState()
				.loadScene(SceneSchema.parse({ version: 1, ground: { width: 40, depth: 40 } }));
			const id = library.placeFromLibrary(design("prefab_a"), [0, 0]);
			const { scene, past, selectedId } = store.getState();
			expect(scene.prefabs.map((prefab) => prefab.id)).toEqual(["prefab_a"]);
			expect(scene.entities.map((entity) => entity.kind)).toEqual(["prefab_a"]);
			expect(selectedId).toBe(id);
			expect(past).toHaveLength(1);
		});

		it("keeps a design the world has as the world has it", async () => {
			const { library, store } = await freshModules();
			store
				.getState()
				.loadScene(SceneSchema.parse({ version: 1, prefabs: [design("prefab_a", "Mine here")] }));
			library.placeFromLibrary(design("prefab_a", "From the library"), [0, 0]);
			expect(store.getState().scene.prefabs.map((prefab) => prefab.name)).toEqual(["Mine here"]);
			expect(store.getState().scene.entities).toHaveLength(1);
		});
	});
});
