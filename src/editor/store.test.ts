import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { createEditorStore } from "./store";

const makeStore = () =>
	createEditorStore(
		SceneSchema.parse({
			version: 1,
			data: [{ key: "orders", label: "Orders", value: 3 }],
			entities: [
				{
					id: "w",
					kind: "warehouse",
					label: { title: "Orders", dataKeys: ["orders"] },
					details: { dataKeys: ["orders"] },
				},
			],
		}),
	);

describe("editor store", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("adds, selects and removes entities with undo/redo", () => {
		const store = makeStore();
		const id = store.getState().addEntity({ kind: "house", position: [2, 3] });
		expect(store.getState().selectedId).toBe(id);
		expect(store.getState().scene.entities).toHaveLength(2);

		store.getState().removeEntity(id);
		expect(store.getState().scene.entities).toHaveLength(1);
		expect(store.getState().selectedId).toBeNull();

		store.getState().undo();
		expect(store.getState().scene.entities).toHaveLength(2);
		store.getState().undo();
		expect(store.getState().scene.entities).toHaveLength(1);
		store.getState().redo();
		expect(store.getState().scene.entities.at(-1)?.position).toEqual([2, 3]);
	});

	it("coalesces rapid edits with the same key into one undo step", () => {
		const store = makeStore();
		const { moveEntity } = store.getState();
		moveEntity("w", [1, 0], { coalesce: "drag:1" });
		vi.advanceTimersByTime(100);
		moveEntity("w", [2, 0], { coalesce: "drag:1" });
		vi.advanceTimersByTime(100);
		moveEntity("w", [3, 0], { coalesce: "drag:1" });
		expect(store.getState().past).toHaveLength(1);

		vi.advanceTimersByTime(5000);
		moveEntity("w", [4, 0], { coalesce: "drag:1" });
		expect(store.getState().past).toHaveLength(2);

		store.getState().undo();
		store.getState().undo();
		expect(store.getState().scene.entities[0].position).toEqual([0, 0]);
	});

	it("does not record no-op commits", () => {
		const store = makeStore();
		store.getState().commit(() => {});
		expect(store.getState().past).toHaveLength(0);
	});

	it("rotates within 0–360", () => {
		const store = makeStore();
		store.getState().rotateEntity("w", -15);
		expect(store.getState().scene.entities[0].rotation).toBe(345);
	});

	it("duplicates with a new id and offset", () => {
		const store = makeStore();
		const copyId = store.getState().duplicateEntity("w");
		const [original, copy] = store.getState().scene.entities;
		expect(copyId).not.toBe("w");
		expect(copy.position).toEqual([original.position[0] + 1, original.position[1] + 1]);
		expect(copy.label).toEqual(original.label);
		expect(copy.label).not.toBe(original.label);
	});

	it("renames data keys everywhere they are referenced", () => {
		const store = makeStore();
		store
			.getState()
			.upsertData({ key: "orders_packed", label: "Orders", value: 3, unit: "" }, "orders");
		const [entity] = store.getState().scene.entities;
		expect(store.getState().scene.data[0].key).toBe("orders_packed");
		expect(entity.label?.dataKeys).toEqual(["orders_packed"]);
		expect(entity.details.dataKeys).toEqual(["orders_packed"]);
	});

	it("removes deleted data keys from labels", () => {
		const store = makeStore();
		store.getState().removeData("orders");
		expect(store.getState().scene.entities[0].label?.dataKeys).toEqual([]);
	});

	it("loading a scene clears history and selection", () => {
		const store = makeStore();
		store.getState().select("w");
		store.getState().rotateEntity("w", 90);
		store.getState().loadScene(SceneSchema.parse({ version: 1 }));
		expect(store.getState()).toMatchObject({ past: [], future: [], selectedId: null });
	});
	it("draws a road point by point and selects it", () => {
		const store = makeStore();
		const s = () => store.getState();
		s().startDrawing("dirt");
		s().addDrawingPoint([0, 0]);
		s().addDrawingPoint([0, 0]); // duplicate click is ignored
		s().addDrawingPoint([4, 0]);
		s().addDrawingPoint([4, 4]);
		s().undoDrawingPoint();
		const id = s().finishDrawing();
		const road = s().scene.roads.find((r) => r.id === id);
		expect(road).toMatchObject({ style: "dirt", name: "Dirt path 1", closed: false });
		expect(road?.points).toEqual([
			[0, 0],
			[4, 0],
		]);
		expect(s().drawing).toBeNull();
		expect(s().selectedRoadId).toBe(id);
	});

	it("needs two points to finish, and three to close a loop", () => {
		const store = makeStore();
		const s = () => store.getState();
		s().startDrawing("asphalt");
		s().addDrawingPoint([0, 0]);
		expect(s().finishDrawing()).toBeNull();
		expect(s().scene.roads).toHaveLength(0);

		s().startDrawing("asphalt");
		s().addDrawingPoint([0, 0]);
		s().addDrawingPoint([4, 0]);
		const id = s().finishDrawing({ closed: true });
		expect(s().scene.roads.find((r) => r.id === id)?.closed).toBe(false);
	});

	it("edits road points and parks vehicles when their road is deleted", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addRoad({
			points: [
				[0, 0],
				[10, 0],
			],
		});
		const van = s().addEntity({ kind: "van", follow: { roadId: id } });
		s().insertRoadPoint(id, 1, [5, 2]);
		s().moveRoadPoint(id, 1, [5.25, 3]);
		expect(s().scene.roads[0].points[1]).toEqual([5.25, 3]);
		s().removeRoadPoint(id, 0);
		s().removeRoadPoint(id, 0); // a road keeps at least two points
		expect(s().scene.roads[0].points).toHaveLength(2);

		s().removeRoad(id);
		expect(s().scene.roads).toHaveLength(0);
		expect(s().scene.entities.find((e) => e.id === van)?.follow).toBeNull();
		s().undo();
		expect(s().scene.entities.find((e) => e.id === van)?.follow?.roadId).toBe(id);
	});

	it("keeps entity and road selection mutually exclusive", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addRoad({
			points: [
				[0, 0],
				[1, 0],
			],
		});
		s().select("w");
		expect(s().selectedRoadId).toBeNull();
		s().selectRoad(id);
		expect(s().selectedId).toBeNull();
	});
});
