import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { memoryStorage } from "./testStorage";

const world = () =>
	SceneSchema.parse({
		version: 1,
		ground: { width: 40, depth: 40 },
		entities: [{ id: "keep", kind: "house_01", position: [8, 8] }],
	});

/** A fresh copy of the editor's modules: what a reload starts from. */
const freshModules = async () => {
	vi.resetModules();
	return {
		store: (await import("./store")).useEditor,
		workshop: await import("./workshop"),
		session: await import("./workshopSession"),
		whatIsOpen: await import("./whatIsOpen"),
		prefabs: await import("./prefabLibrary"),
	};
};

describe("the Workshop over a reload (ADR-0134)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("localStorage", memoryStorage());
		vi.stubGlobal("sessionStorage", memoryStorage());
		// A window to listen on, with what the editor's modules read of it when they load.
		vi.stubGlobal("window", Object.assign(new EventTarget(), { navigator: { userAgent: "" } }));
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("opens again as it was, asked about before leaving, and is forgotten once left", async () => {
		const before = await freshModules();
		before.store.getState().loadScene(world());
		const stop = before.session.keepWorkshopSession(before.store);
		before.workshop.makeNewPrefab(null);
		before.workshop.renamePrefabInWorkshop("Kiosk");
		before.workshop.showGroundInWorkshop(true);
		before.store.getState().addEntity({ kind: "box_01", name: "", position: [1, 1] });
		vi.advanceTimersByTime(1000);
		stop();

		// The page reloads: the same world opens, then the Workshop on it.
		const after = await freshModules();
		after.store.getState().loadScene(world());
		expect(after.session.resumeWorkshopSession(after.store)).toBe(true);
		const workshop = after.whatIsOpen.workshopOf(after.store.getState().whatIsOpen);
		expect(workshop).toMatchObject({ name: "Kiosk", showsGround: true, isResumed: true });
		expect(after.store.getState().scene.entities.map((e) => e.kind)).toEqual(["box_01"]);

		// Built on before the reload: leaving asks first, though there's no undo history.
		after.workshop.leaveWorkshopFirst();
		expect(after.store.getState().workshopLeaving).not.toBeNull();
		const stopAgain = after.session.keepWorkshopSession(after.store);
		after.workshop.confirmLeavingWorkshop();
		stopAgain();
		expect(after.store.getState().scene.entities.map((e) => e.id)).toEqual(["keep"]);
		expect(sessionStorage.getItem("isometrics:workshop")).toBeNull();
	});

	it("isn't opened again on another world", async () => {
		const before = await freshModules();
		before.store.getState().loadScene(world());
		const stop = before.session.keepWorkshopSession(before.store);
		before.workshop.makeNewPrefab(null);
		vi.advanceTimersByTime(1000);
		stop();
		sessionStorage.setItem(
			"isometrics:workshop",
			(sessionStorage.getItem("isometrics:workshop") ?? "").replace(
				'"worldId":null',
				'"worldId":"elsewhere"',
			),
		);
		const after = await freshModules();
		after.store.getState().loadScene(world());
		expect(after.session.resumeWorkshopSession(after.store)).toBe(false);
	});
});

describe("Remove from this world… (ADR-0134)", () => {
	it("takes the prefab and its copies out, as one undo step", async () => {
		const { store, prefabs } = await freshModules();
		store.getState().loadScene(
			SceneSchema.parse({
				version: 1,
				prefabs: [{ id: "prefab_kiosk", entities: [{ id: "a", kind: "box_01" }] }],
				entities: [
					{ id: "c1", kind: "prefab_kiosk" },
					{ id: "c2", kind: "prefab_kiosk", position: [4, 0] },
					{ id: "keep", kind: "house_01" },
				],
			}),
		);
		store.getState().select("c1");
		expect(prefabs.removePrefabFromWorld("prefab_kiosk")).toBe(2);
		expect(store.getState().scene.prefabs).toEqual([]);
		expect(store.getState().scene.entities.map((e) => e.id)).toEqual(["keep"]);
		expect(store.getState().selectedId).toBeNull();
		store.getState().undo();
		expect(store.getState().scene.entities).toHaveLength(3);
		expect(store.getState().scene.prefabs).toHaveLength(1);
	});
});
