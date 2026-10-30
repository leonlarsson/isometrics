import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	AreaSchema,
	DataBindingSchema,
	MoodSchema,
	SceneSchema,
	type TEntityLight,
	type TScene,
} from "#/scene/schema";

import { resetPreferences, setPreference } from "./preferences";
import { createEditorStore, selectMovesAsGroup, unknownPartKinds } from "./store";

const makeStore = () =>
	createEditorStore(
		SceneSchema.parse({
			version: 1,
			data: { values: [{ key: "orders", name: "Orders", value: 3 }] },
			entities: [
				{
					id: "w",
					kind: "warehouse_01",
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
		const id = store.getState().addEntity({ kind: "house_01", position: [2, 3] });
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

	it("keeps a gesture in one undo step however long it pauses", () => {
		const store = makeStore();
		const { moveEntity } = store.getState();
		moveEntity("w", [1, 0], { coalesce: "gizmo:1", gesture: true });
		vi.advanceTimersByTime(5000);
		moveEntity("w", [2, 0], { coalesce: "gizmo:1", gesture: true });
		expect(store.getState().past).toHaveLength(1);

		store.getState().undo();
		expect(store.getState().scene.entities[0].position).toEqual([0, 0]);
	});

	it("cancels a gesture without leaving an undo step behind", () => {
		const store = makeStore();
		store.getState().moveEntity("w", [1, 0]);
		const before = store.getState().scene;
		store.getState().moveEntity("w", [2, 0], { coalesce: "gizmo:2", gesture: true });
		store.getState().moveEntity("w", [3, 0], { coalesce: "gizmo:2", gesture: true });

		store.getState().revertTo(before);
		expect(store.getState().scene).toBe(before);
		expect(store.getState().past).toHaveLength(1);

		// Reverting to the current scene (a gesture that never moved) changes nothing.
		store.getState().revertTo(before);
		expect(store.getState().past).toHaveLength(1);
	});

	it("tracks a keyboard transform's axis and typed value", () => {
		const store = makeStore();
		store.getState().startTransform("grab");
		store.getState().updateTransform({ axis: "x", typed: "2.5" });
		expect(store.getState().transform).toEqual({ mode: "grab", axis: "x", typed: "2.5" });
		store.getState().setMode("view");
		expect(store.getState().transform).toBeNull();
	});

	it("does not record no-op commits", () => {
		const store = makeStore();
		store.getState().commit(() => {});
		expect(store.getState().past).toHaveLength(0);
	});

	it("rotates within 0–360", () => {
		const store = makeStore();
		store.getState().rotateEntity("w", -15);
		expect(store.getState().scene.entities[0].rotation[1]).toBe(345);
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
		const textId = store
			.getState()
			.addEntity({ kind: "text_01", props: { text: "Orders", dataKey: "orders" } });
		store
			.getState()
			.upsertData({ key: "orders_packed", name: "Orders", value: 3, unit: "" }, "orders");
		const [entity] = store.getState().scene.entities;
		expect(store.getState().scene.data.values[0].key).toBe("orders_packed");
		expect(entity.label?.dataKeys).toEqual(["orders_packed"]);
		expect(entity.details.dataKeys).toEqual(["orders_packed"]);
		// A part's data key field (the text part's value) follows too.
		const text = store.getState().scene.entities.find((e) => e.id === textId);
		expect(text?.props.dataKey).toBe("orders_packed");
	});

	it("renames and removes the data key the time of day comes from, in moods too", () => {
		const store = makeStore();
		store.getState().upsertData({ key: "hour", name: "Hour", value: 18, unit: "" });
		store.getState().commit((scene) => {
			scene.lighting.timeSource = "data";
			scene.lighting.data.time = DataBindingSchema.parse({ key: "hour" });
			scene.moods.push(
				MoodSchema.parse({ id: "m", lighting: { data: { time: { key: "hour" } } } }),
			);
			scene.areas.push(
				AreaSchema.parse({
					id: "zone",
					points: [
						[0, 0],
						[2, 0],
						[2, 2],
					],
					colors: { surface: { data: { color: { key: "hour" } } } },
				}),
			);
		});
		store.getState().upsertData({ key: "local_hour", name: "Hour", value: 18, unit: "" }, "hour");
		const { scene } = store.getState();
		expect(scene.lighting.data.time?.key).toBe("local_hour");
		expect(scene.moods[0].lighting.data.time?.key).toBe("local_hour");
		expect(scene.areas[0].colors.surface.data.color?.key).toBe("local_hour");

		store.getState().removeData("local_hour");
		const after = store.getState().scene;
		expect(after.lighting.data).toEqual({});
		expect(after.moods[0].lighting.data).toEqual({});
		// Nothing left that differs from the area kind's colour: no entry at all.
		expect(after.areas[0].colors).toEqual({});
	});

	it("removes deleted data keys from labels and parts", () => {
		const store = makeStore();
		const textId = store
			.getState()
			.addEntity({ kind: "text_01", props: { text: "Orders", dataKey: "orders" } });
		store.getState().removeData("orders");
		const { entities } = store.getState().scene;
		const text = entities.find((e) => e.id === textId);
		expect(entities[0].label?.dataKeys).toEqual([]);
		expect(text?.props.dataKey).toBe("");
		expect(text?.props.text).toBe("Orders");
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
		s().startDrawing("dirt_path_01");
		s().addDrawingPoint([0, 0]);
		s().addDrawingPoint([0, 0]); // duplicate click is ignored
		s().addDrawingPoint([4, 0]);
		s().addDrawingPoint([4, 4]);
		s().undoDrawingPoint();
		const id = s().finishDrawing();
		const road = s().scene.roads.find((r) => r.id === id);
		expect(road).toMatchObject({ kind: "dirt_path_01", name: "Dirt path 1", loops: false });
		expect(road?.points).toEqual([
			[0, 0, 0],
			[4, 0, 0],
		]);
		expect(s().drawing).toBeNull();
		expect(s().selectedRoadId).toBe(id);
	});

	it("needs two points to finish, and three to close a loop", () => {
		const store = makeStore();
		const s = () => store.getState();
		s().startDrawing("road_01");
		s().addDrawingPoint([0, 0]);
		expect(s().finishDrawing()).toBeNull();
		expect(s().scene.roads).toHaveLength(0);

		s().startDrawing("road_01");
		s().addDrawingPoint([0, 0]);
		s().addDrawingPoint([4, 0]);
		const id = s().finishDrawing({ loops: true });
		expect(s().scene.roads.find((r) => r.id === id)?.loops).toBe(false);
	});

	it("sets one part prop and keeps every other stored prop, even unknown ones (ADR-0056)", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addEntity({
			kind: "office_tower_01",
			props: { floorCount: 9, fromNewerVersion: "keep me", storeys: 4 },
		});
		s().setEntityProp(id, "floorCount", 12);
		expect(s().scene.entities.find((e) => e.id === id)?.props).toEqual({
			floorCount: 12,
			fromNewerVersion: "keep me",
			storeys: 4,
		});
		s().undo();
		expect(s().scene.entities.find((e) => e.id === id)?.props.floorCount).toBe(9);
	});

	it("sets one light's settings, and leaves none once they're all the part's again", () => {
		const store = makeStore();
		const s = () => store.getState();
		const lamp = s().addEntity({ kind: "street_lamp_01" });
		s().setEntityLight(lamp, "lamp", { whenOn: "off", color: "#ff0000" });
		expect(s().scene.entities.find((e) => e.id === lamp)?.lights).toEqual({
			lamp: expect.objectContaining({ whenOn: "off", color: "#ff0000", strength: null }),
		});
		// Back to the part's for everything: no entry left.
		s().setEntityLight(lamp, "lamp", { whenOn: null, color: null });
		expect(s().scene.entities.find((e) => e.id === lamp)?.lights).toEqual({});
	});

	it("renames or drops a data key in lights switched or dimmed by it", () => {
		const store = makeStore();
		const s = () => store.getState();
		const lamp = s().addEntity({ kind: "street_lamp_01" });
		const binding = DataBindingSchema.parse({ key: "orders" });
		s().setEntityLight(lamp, "lamp", {
			data: { on: binding, strength: { ...binding, valueAtFull: 10 } },
		});
		s().setEntityColor(lamp, "post", { data: { color: binding } });
		s().upsertData({ key: "sales", name: "Orders", value: 3, unit: "" }, "orders");
		const entity = () => s().scene.entities.find((e) => e.id === lamp);
		const lights = () => entity()?.lights as Record<string, TEntityLight>;
		expect(lights().lamp.data).toEqual({
			on: { ...binding, key: "sales" },
			strength: { ...binding, key: "sales", valueAtFull: 10 },
		});
		expect(entity()?.colors.post.data).toEqual({ color: { ...binding, key: "sales" } });
		// Deleting the value: those settings no longer follow data, and nothing else is left.
		s().removeData("sales");
		expect(lights()).toEqual({});
		expect(entity()?.colors).toEqual({});
	});

	it("sets an object's colours by id, and leaves none once they're the part's again", () => {
		const store = makeStore();
		const s = () => store.getState();
		const house = s().addEntity({ kind: "house_01" });
		const entity = () => s().scene.entities.find((e) => e.id === house);
		s().setEntityColor(house, "roof", {
			color: "#123456",
			data: { color: DataBindingSchema.parse({ key: "heat" }) },
		});
		expect(entity()?.colors.roof).toMatchObject({
			color: "#123456",
			data: { color: { key: "heat" } },
		});
		s().setEntityColor(house, "roof", { color: null, data: { color: null } });
		expect(entity()?.colors).toEqual({});
	});

	it("opens the selection's tabs: the one you were on, Object from a world tab, Shape for a point", () => {
		const store = makeStore();
		const s = () => store.getState();
		const road = s().addRoad({
			points: [
				[0, 0],
				[10, 0],
			],
		});
		s().clearSelection();
		expect(s().tab).toBe("object");

		s().setTab("sky");
		s().select("w");
		expect(s().tab).toBe("object");

		s().setTab("look");
		s().selectRoad(road);
		expect(s().tab).toBe("look");

		s().selectRoadPoint(road, 1);
		expect(s().tab).toBe("shape");
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
		const van = s().addEntity({ kind: "delivery_van_01", follow: { roadId: id } });
		s().insertRoadPoint(id, 1, [5, 2, 0]);
		s().moveRoadPoint(id, 1, [5.25, 3]);
		expect(s().scene.roads[0].points[1]).toEqual([5.25, 3, 0]);
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
	const straightRoad = (s: () => ReturnType<ReturnType<typeof makeStore>["getState"]>) =>
		s().addRoad({
			name: "Main",
			points: [
				[0, 0],
				[5, 0],
				[10, 0],
				[15, 0],
			],
		});

	it("sets point heights and keeps them when the point moves", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = straightRoad(s);
		s().setRoadPointHeight(id, 1, 2.5);
		s().moveRoadPoint(id, 1, [5, 1]);
		expect(s().scene.roads[0].points[1]).toEqual([5, 1, 2.5]);
		s().setRoadPointHeight(id, 1, -3);
		expect(s().scene.roads[0].points[1][2]).toBe(0);
	});

	it("splits an open road into two that share the cut point", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = straightRoad(s);
		const van = s().addEntity({ kind: "delivery_van_01", follow: { roadId: id } });
		const second = s().splitRoad(id, 2);
		const [a, b] = s().scene.roads;
		expect(a.id).toBe(id);
		expect(b.id).toBe(second);
		expect(b.name).toBe("Main (2)");
		expect(a.points.at(-1)).toEqual([10, 0, 0]);
		expect(b.points[0]).toEqual([10, 0, 0]);
		expect(s().scene.entities.find((e) => e.id === van)?.follow?.roadId).toBe(id);
		expect(s().splitRoad(id, 0)).toBeNull(); // can't cut at an end
	});

	it("opens a loop at the cut point", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addRoad({
			loops: true,
			points: [
				[0, 0],
				[4, 0],
				[4, 4],
			],
		});
		expect(s().splitRoad(id, 1)).toBe(id);
		const road = s().scene.roads[0];
		expect(road.loops).toBe(false);
		expect(road.points.map((p) => [p[0], p[1]])).toEqual([
			[4, 0],
			[4, 4],
			[0, 0],
			[4, 0],
		]);
	});

	it("joins two roads end to end and moves vehicles onto the result", () => {
		const store = makeStore();
		const s = () => store.getState();
		const a = s().addRoad({
			points: [
				[0, 0],
				[5, 0],
			],
		});
		const b = s().addRoad({
			points: [
				[10, 0],
				[5, 0],
			],
		});
		const van = s().addEntity({ kind: "delivery_van_01", follow: { roadId: b } });
		s().joinRoads(a, "end", b, "end");
		expect(s().scene.roads).toHaveLength(1);
		expect(s().scene.roads[0].points.map((p) => p[0])).toEqual([0, 5, 10]);
		expect(s().scene.entities.find((e) => e.id === van)?.follow?.roadId).toBe(a);
		s().undo();
		expect(s().scene.roads).toHaveLength(2);
	});

	it("joining a road's own ends closes the loop", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addRoad({
			points: [
				[0, 0],
				[4, 0],
				[4, 4],
				[0, 0],
			],
		});
		s().joinRoads(id, "start", id, "end");
		const road = s().scene.roads[0];
		expect(road.loops).toBe(true);
		expect(road.points).toHaveLength(3); // the shared point appears once
	});

	it("continues drawing from either end of a road", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addRoad({
			points: [
				[0, 0, 1],
				[5, 0, 2],
			],
		});
		s().continueDrawing(id, "start");
		s().addDrawingPoint([-5, 0]);
		expect(s().finishDrawing()).toBe(id);
		expect(s().scene.roads).toHaveLength(1);
		// Reversed so the new point follows the old start, at the old start's height.
		expect(s().scene.roads[0].points).toEqual([
			[5, 0, 2],
			[0, 0, 1],
			[-5, 0, 1],
		]);
	});

	it("draws an area from three or more corners and selects it", () => {
		const store = makeStore();
		const s = () => store.getState();
		s().startAreaDrawing("water_01");
		s().addDrawingPoint([0, 0]);
		s().addDrawingPoint([4, 0]);
		expect(s().finishDrawing()).toBeNull(); // two corners aren't an area
		expect(s().scene.areas).toHaveLength(0);

		s().startAreaDrawing("raised_land_01");
		s().addDrawingPoint([0, 0]);
		s().addDrawingPoint([4, 0]);
		s().addDrawingPoint([4, 4]);
		const id = s().finishDrawing();
		const area = s().scene.areas.find((a) => a.id === id);
		expect(area).toMatchObject({ kind: "raised_land_01", name: "Raised land 1", height: 1.5 });
		expect(area?.points).toEqual([
			[0, 0],
			[4, 0],
			[4, 4],
		]);
		expect(s().selectedAreaId).toBe(id);
	});

	it("draws a fence, edits its points like a road's, and keeps at least two (ADR-0103)", () => {
		const store = makeStore();
		const s = () => store.getState();
		s().startFenceDrawing("hedge_01");
		s().addDrawingPoint([0, 0]);
		s().addDrawingPoint([4, 0]);
		s().addDrawingPoint([4, 4]);
		const id = s().finishDrawing();
		const fence = () => s().scene.fences.find((f) => f.id === id);
		expect(fence()).toMatchObject({ kind: "hedge_01", name: "Hedge 1", loops: false });
		expect(fence()?.points).toEqual([
			[0, 0, 0],
			[4, 0, 0],
			[4, 4, 0],
		]);
		expect(s().selectedFenceId).toBe(id);
		expect(s().selectedItems).toEqual([{ kind: "fence", id }]);

		if (!id) {
			throw new Error("no fence");
		}
		s().setFencePointLift(id, 1, 1.5);
		s().moveFencePoint(id, 1, [5, 1]);
		expect(fence()?.points[1]).toEqual([5, 1, 1.5]);
		s().insertFencePoint(id, 1, [2, 0, 0]);
		expect(fence()?.points).toHaveLength(4);

		// Split in the middle: two fences sharing the point, the second one selected.
		const second = s().splitFence(id, 1);
		expect(s().scene.fences).toHaveLength(2);
		expect(s().selectedFenceId).toBe(second);
		expect(fence()?.points).toHaveLength(2);

		s().removeFencePoint(id, 0);
		expect(fence()?.points).toHaveLength(2);

		s().selectFencePoint(id, 0);
		s().togglePoint(1);
		s().removeSelectedPoints();
		expect(fence()?.points).toHaveLength(2);

		s().selectFence(id);
		s().removeSelected();
		expect(s().scene.fences).toHaveLength(1);
		s().undo();
		expect(s().scene.fences).toHaveLength(2);
	});

	it("shares out how much is built when a fence is split, and keeps its way when continued", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addFence({
			points: [
				[0, 0],
				[4, 0],
				[8, 0],
			],
			builtShare: 0.25,
		});
		const second = s().splitFence(id, 1);
		expect(s().scene.fences.find((f) => f.id === id)?.builtShare).toBe(0.5);
		expect(s().scene.fences.find((f) => f.id === second)?.builtShare).toBe(0);

		s().continueFenceDrawing(id, "start");
		s().addDrawingPoint([-4, 0]);
		s().finishDrawing();
		// The new point goes before its start, the rest the way it was drawn.
		expect(s().scene.fences.find((f) => f.id === id)?.points).toEqual([
			[-4, 0, 0],
			[0, 0, 0],
			[4, 0, 0],
		]);
	});

	it("copies fences a step over, and follows data renames into their bindings", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addFence({
			kind: "chain_link_fence_01",
			points: [
				[0, 0],
				[4, 0, 1],
			],
			data: { builtShare: DataBindingSchema.parse({ key: "orders", valueAtFull: 10 }) },
			colors: {
				mesh: {
					color: null,
					transparency: null,
					data: { color: DataBindingSchema.parse({ key: "orders" }) },
				},
			},
		});
		s().duplicateSelected();
		const copy = s().scene.fences.find((f) => f.id !== id);
		expect(copy?.points).toEqual([
			[1, 1, 0],
			[5, 1, 1],
		]);
		expect(s().selectedFenceId).toBe(copy?.id);

		s().upsertData({ key: "parcels", name: "Orders", value: 3, unit: "" }, "orders");
		const original = s().scene.fences.find((f) => f.id === id);
		expect(original?.data.builtShare?.key).toBe("parcels");
		expect(original?.colors.mesh?.data.color?.key).toBe("parcels");
		s().removeData("parcels");
		expect(s().scene.fences.find((f) => f.id === id)?.data).toEqual({});
		expect(s().scene.fences.find((f) => f.id === id)?.colors).toEqual({});
	});

	it("edits area corners, keeps at least three, and undoes", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addArea({
			points: [
				[0, 0],
				[4, 0],
				[4, 4],
			],
		});
		s().insertAreaPoint(id, 1, [2, -1]);
		s().moveAreaPoint(id, 1, [2, -2]);
		expect(s().scene.areas[0].points[1]).toEqual([2, -2]);
		s().removeAreaPoint(id, 0);
		s().removeAreaPoint(id, 0); // already at three corners
		expect(s().scene.areas[0].points).toHaveLength(3);
		s().removeArea(id);
		expect(s().scene.areas).toHaveLength(0);
		s().undo();
		expect(s().scene.areas).toHaveLength(1);
	});

	it("gives area corners heights of their own, kept when moved and eased in when added", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addArea({
			points: [
				[0, 0],
				[4, 0],
				[4, 4],
			],
		});
		s().setAreaCornerHeight(id, 1, 2);
		expect(s().scene.areas[0].points[1]).toEqual([4, 0, 2]);
		s().moveAreaPoint(id, 1, [5, 0]);
		expect(s().scene.areas[0].points[1]).toEqual([5, 0, 2]);
		// Between a corner at 0 and one at 2.
		s().insertAreaPoint(id, 1, [2, 0]);
		expect(s().scene.areas[0].points[1]).toEqual([2, 0, 1]);
		// Back to the area's own height: no lift of its own.
		s().setAreaCornerHeight(id, 2, 0);
		expect(s().scene.areas[0].points[2]).toEqual([5, 0]);
		// Water stays level.
		s().updateArea(id, (area) => {
			area.kind = "water_01";
		});
		s().setAreaCornerHeight(id, 0, 3);
		expect(s().scene.areas[0].points[0]).toEqual([0, 0]);
	});

	it("keeps area, road and entity selection mutually exclusive", () => {
		const store = makeStore();
		const s = () => store.getState();
		const area = s().addArea({
			points: [
				[0, 0],
				[1, 0],
				[1, 1],
			],
		});
		s().selectAreaPoint(area, 2);
		expect(s()).toMatchObject({ selectedAreaId: area, selectedPointIndex: 2, selectedId: null });
		s().select("w");
		expect(s()).toMatchObject({ selectedAreaId: null, selectedPointIndex: null, selectedId: "w" });
	});

	it("keeps a point's own width when it's moved or raised, and can set or clear it", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addRoad({
			points: [
				[0, 0],
				[10, 0],
			],
		});
		s().setRoadPointWidth(id, 1, 3);
		s().moveRoadPoint(id, 1, [12, 1]);
		s().setRoadPointHeight(id, 1, 2);
		expect(s().scene.roads[0].points[1]).toEqual([12, 1, 2, 3]);
		s().setRoadPointWidth(id, 1, 100);
		expect(s().scene.roads[0].points[1][3]).toBe(20);
		s().setRoadPointWidth(id, 1, null);
		expect(s().scene.roads[0].points[1]).toEqual([12, 1, 2]);
	});

	it("gives an inserted point the width between its neighbours", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addRoad({
			width: 2,
			points: [
				[0, 0, 0, 4],
				[10, 0],
			],
		});
		s().insertRoadPoint(id, 1, [5, 0, 0]);
		expect(s().scene.roads[0].points[1]).toEqual([5, 0, 0, 3]);
	});

	it("keeps the absorbed road's width when joining roads of different widths", () => {
		const store = makeStore();
		const s = () => store.getState();
		const a = s().addRoad({
			width: 2,
			points: [
				[0, 0],
				[5, 0],
			],
		});
		const b = s().addRoad({
			width: 4,
			points: [
				[5, 0],
				[10, 0],
			],
		});
		s().joinRoads(a, "end", b, "start");
		expect(s().scene.roads[0].points).toEqual([
			[0, 0, 0],
			[5, 0, 0],
			[10, 0, 0, 4],
		]);
	});

	it("makes an offered vehicle drive along the road as one undo step", () => {
		const store = makeStore();
		const roadId = store.getState().addRoad({
			points: [
				[0, 0],
				[10, 0],
			],
		});
		const id = store.getState().addEntity({
			kind: "delivery_van_01",
			position: [4, -0.5],
			altitude: 0.2,
			rotation: [0, 180, 0],
		});
		store.getState().setFollowOffer({
			entityId: id,
			roadId,
			startDistance: 4,
			drivesTheOtherWay: true,
			position: [4, -0.5],
		});

		store.getState().select("w");
		expect(store.getState().followOffer).toBeNull();

		store.getState().setFollowOffer({
			entityId: id,
			roadId,
			startDistance: 4,
			drivesTheOtherWay: true,
			position: [4, -0.5],
		});
		store.getState().acceptFollowOffer();
		const van = store.getState().scene.entities.find((e) => e.id === id);
		expect(van?.follow).toMatchObject({
			roadId,
			startDistance: 4,
			drivesTheOtherWay: true,
			speed: 2,
		});
		expect(van?.altitude).toBe(0);
		expect(van?.rotation).toEqual([0, 0, 0]);
		expect(store.getState().followOffer).toBeNull();

		store.getState().undo();
		const parked = store.getState().scene.entities.find((e) => e.id === id);
		expect(parked?.follow).toBeNull();
		expect(parked?.rotation[1]).toBe(180);
	});

	it("toggles the selection's visibility, shows everything again, and locks items", () => {
		const store = makeStore();
		store.getState().select("w");
		store.getState().toggleSelectedHidden();
		expect(store.getState().scene.entities[0].isHidden).toBe(true);
		expect(store.getState().selectedId).toBe("w");
		store.getState().toggleSelectedHidden();
		expect(store.getState().scene.entities[0].isHidden).toBe(false);

		store.getState().toggleSelectedHidden();
		store.getState().revealAll();
		expect(store.getState().scene.entities[0].isHidden).toBe(false);

		const roadId = store.getState().addRoad({
			points: [
				[0, 0],
				[10, 0],
			],
		});
		store.getState().setItemFlag({ kind: "road", id: roadId }, "isLocked", true);
		expect(store.getState().scene.roads[0].isLocked).toBe(true);
		store.getState().undo();
		expect(store.getState().scene.roads[0].isLocked).toBe(false);
	});

	it("frames the selection, and re-centres on the whole ground", () => {
		const store = makeStore();
		store.getState().select("w");
		store.getState().frameSelection();
		expect(store.getState().frameBox?.center[0]).toBe(0);
		const nonce = store.getState().viewNonce;
		store.getState().resetView();
		expect(store.getState().frameBox).toBeNull();
		expect(store.getState().viewNonce).toBe(nonce + 1);
	});

	it("adds, reorders and removes viewpoints", () => {
		const store = makeStore();
		const pose = {
			target: [0, 0] as [number, number],
			azimuth: 315,
			elevation: 32.5,
			span: 40,
			projection: "orthographic" as const,
			fieldOfView: null,
			targetAltitude: 0,
		};
		const a = store.getState().addViewpoint(pose);
		const b = store.getState().addViewpoint({ ...pose, span: 20 });
		const c = store.getState().addViewpoint({ ...pose, span: 10 });
		store.getState().moveViewpoint(c, 0);
		expect(store.getState().scene.viewpoints.map((v) => v.id)).toEqual([c, a, b]);
		store.getState().undo();
		expect(store.getState().scene.viewpoints.map((v) => v.id)).toEqual([a, b, c]);
		store.getState().removeViewpoint(b);
		expect(store.getState().scene.viewpoints.map((v) => v.id)).toEqual([a, c]);
	});

	it("resets the camera and its settings, but not the turntable or tilt-shift", () => {
		const store = makeStore();
		store.getState().commit((scene) => {
			scene.camera.fieldOfView = 90;
			scene.camera.highestElevation = 60;
			scene.camera.keepsOverGround = false;
			scene.camera.turntable.isOn = true;
			scene.camera.tiltShift.isOn = true;
			scene.camera.tiltShift.blurStrength = 0.9;
		});
		store.getState().toggleProjection();
		const nonce = store.getState().viewNonce;
		store.getState().resetCamera();
		const { camera } = store.getState().scene;
		expect(camera).toMatchObject({ fieldOfView: 40, highestElevation: 87, keepsOverGround: true });
		expect(camera.turntable.isOn).toBe(true);
		expect(camera.tiltShift).toMatchObject({ isOn: true, blurStrength: 0.9 });
		expect(store.getState().projection).toBe("orthographic");
		expect(store.getState().viewNonce).toBe(nonce + 1);
		store.getState().undo();
		expect(store.getState().scene.camera.fieldOfView).toBe(90);
	});

	it("opens at the remembered camera, else the opening viewpoint, else the whole world", () => {
		const store = makeStore();
		const pose = {
			target: [4, 2] as [number, number],
			azimuth: 200,
			elevation: 50,
			span: 12,
			projection: "perspective" as const,
			fieldOfView: null,
			targetAltitude: 0,
		};
		const nonce = store.getState().viewNonce;
		store.getState().showOpeningView(null);
		expect(store.getState().viewNonce).toBe(nonce + 1);
		expect(store.getState().flight).toBeNull();

		const opening = store.getState().addViewpoint(pose);
		store.getState().setOpeningViewpoint(opening);
		store.getState().showOpeningView(null);
		expect(store.getState().flight).toMatchObject({ pose: { span: 12 }, instant: true });
		expect(store.getState().projection).toBe("perspective");
		expect(store.getState().activeViewpointId).toBe(opening);

		store.getState().showOpeningView({ ...pose, span: 30, projection: "orthographic" as const });
		expect(store.getState().flight).toMatchObject({ pose: { span: 30 }, instant: true });
		expect(store.getState().projection).toBe("orthographic");
		expect(store.getState().activeViewpointId).toBeNull();

		// Re-centring glides back to the opening viewpoint.
		store.getState().resetView();
		expect(store.getState().flight).toMatchObject({ pose: { span: 12 }, instant: false });

		// Deleting it makes the world open whole again.
		store.getState().removeViewpoint(opening);
		expect(store.getState().scene.camera.openingViewpointId).toBeNull();
		const before = store.getState().viewNonce;
		store.getState().resetView();
		expect(store.getState().viewNonce).toBe(before + 1);

		// The whole world opens in the projection the world says.
		store.getState().commit((scene) => {
			scene.camera.openingProjection = "perspective";
		});
		store.getState().setProjection("orthographic");
		store.getState().resetView();
		expect(store.getState().projection).toBe("perspective");
	});
});

describe("unknownPartKinds", () => {
	it("lists kinds no part has, most common first", () => {
		const entities = [
			{ kind: "house_01" },
			{ kind: "tower" },
			{ kind: "house" },
			{ kind: "house" },
		] as TScene["entities"];
		expect(unknownPartKinds({ entities })).toEqual([
			["house", 2],
			["tower", 1],
		]);
	});
});

describe("selecting several things (ADR-0064)", () => {
	const groupStore = () =>
		createEditorStore(
			SceneSchema.parse({
				version: 1,
				entities: [
					{ id: "a", kind: "house_01", position: [0, 0] },
					{ id: "b", kind: "house_01", position: [4, 0] },
					{ id: "car", kind: "car_01", follow: { roadId: "r" } },
				],
				roads: [
					{
						id: "r",
						points: [
							[0, 5],
							[10, 5],
						],
					},
				],
				areas: [
					{
						id: "lake",
						kind: "water_01",
						points: [
							[0, 0],
							[2, 0],
							[2, 2],
						],
					},
				],
			}),
		);

	it("selecting one thing selects only it, and the list follows", () => {
		const store = groupStore();
		store.getState().select("a");
		expect(store.getState().selectedItems).toEqual([{ kind: "entity", id: "a" }]);
		store.getState().selectRoad("r");
		expect(store.getState().selectedItems).toEqual([{ kind: "road", id: "r" }]);
		store.getState().clearSelection();
		expect(store.getState().selectedItems).toEqual([]);
	});

	it("toggling adds things (the last is active) and takes them out", () => {
		const store = groupStore();
		store.getState().select("a");
		store.getState().toggleSelected({ kind: "road", id: "r" });
		expect(store.getState().selectedItems).toHaveLength(2);
		expect(store.getState().selectedRoadId).toBe("r");
		expect(store.getState().selectedId).toBeNull();

		store.getState().toggleSelected({ kind: "road", id: "r" });
		expect(store.getState().selectedItems).toEqual([{ kind: "entity", id: "a" }]);
		expect(store.getState().selectedId).toBe("a");

		store.getState().toggleSelected({ kind: "entity", id: "a" });
		expect(store.getState().selectedItems).toEqual([]);
		expect(store.getState().selectedId).toBeNull();
	});

	it("a click on one of several selects only it", () => {
		const store = groupStore();
		store.getState().selectItems([
			{ kind: "entity", id: "a" },
			{ kind: "entity", id: "b" },
		]);
		store.getState().select("a");
		expect(store.getState().selectedItems).toEqual([{ kind: "entity", id: "a" }]);
	});

	it("deletes everything selected in one undo step, parking vehicles on a deleted road", () => {
		const store = groupStore();
		store.getState().selectItems([
			{ kind: "entity", id: "a" },
			{ kind: "road", id: "r" },
			{ kind: "area", id: "lake" },
		]);
		store.getState().removeSelected();
		const { scene } = store.getState();
		expect(scene.entities.map((e) => e.id)).toEqual(["b", "car"]);
		expect(scene.roads).toHaveLength(0);
		expect(scene.areas).toHaveLength(0);
		expect(scene.entities.find((e) => e.id === "car")?.follow).toBeNull();
		expect(store.getState().selectedItems).toEqual([]);

		store.getState().undo();
		expect(store.getState().scene.entities).toHaveLength(3);
		expect(store.getState().scene.roads).toHaveLength(1);
	});

	it("keeps the selected things that still exist after undo", () => {
		const store = groupStore();
		const id = store.getState().addEntity({ kind: "house_01", position: [8, 8] });
		store.getState().selectItems([
			{ kind: "entity", id: "a" },
			{ kind: "entity", id },
		]);
		store.getState().undo();
		expect(store.getState().selectedItems).toEqual([{ kind: "entity", id: "a" }]);
		expect(store.getState().selectedId).toBe("a");
	});

	it("duplicates a group, and copied vehicles drive the copied road", () => {
		const store = groupStore();
		store.getState().selectItems([
			{ kind: "road", id: "r" },
			{ kind: "entity", id: "car" },
			{ kind: "entity", id: "a" },
		]);
		store.getState().duplicateSelected();
		const { scene, selectedItems } = store.getState();
		expect(scene.entities).toHaveLength(5);
		expect(scene.roads).toHaveLength(2);
		const road = scene.roads[1];
		expect(road.points[0].slice(0, 2)).toEqual([1, 6]);
		const car = scene.entities.find((e) => e.kind === "car_01" && e.id !== "car");
		expect(car?.follow?.roadId).toBe(road.id);
		expect(car?.follow?.startDistance).toBe(0);
		expect(selectedItems).toHaveLength(3);
		expect(selectedItems.some((item) => item.id === "a")).toBe(false);
		expect(store.getState().past).toHaveLength(1);
	});

	it("hides and locks everything selected in one step", () => {
		const store = groupStore();
		store.getState().selectItems([
			{ kind: "entity", id: "a" },
			{ kind: "area", id: "lake" },
		]);
		store.getState().toggleSelectedHidden();
		expect(store.getState().scene.entities[0].isHidden).toBe(true);
		expect(store.getState().scene.areas[0].isHidden).toBe(true);
		expect(store.getState().scene.entities[1].isHidden).toBe(false);
		store.getState().setSelectedFlag("isLocked", true);
		expect(store.getState().scene.areas[0].isLocked).toBe(true);
		expect(store.getState().past).toHaveLength(2);
	});

	it("right-clicking one of several keeps the selection", () => {
		const store = groupStore();
		const group = [
			{ kind: "entity", id: "a" },
			{ kind: "entity", id: "b" },
		] as const;
		store.getState().selectItems([...group]);
		store.getState().openContextMenu({ kind: "entity", id: "a" }, { x: 0, y: 0 });
		expect(store.getState().selectedItems).toHaveLength(2);
		store.getState().openContextMenu({ kind: "road", id: "r" }, { x: 0, y: 0 });
		expect(store.getState().selectedItems).toEqual([{ kind: "road", id: "r" }]);
	});
});

describe("selecting several points (ADR-0065)", () => {
	const pointStore = () =>
		createEditorStore(
			SceneSchema.parse({
				version: 1,
				roads: [
					{
						id: "r",
						points: [
							[0, 0],
							[2, 0],
							[4, 0],
							[6, 0],
						],
					},
				],
				areas: [
					{
						id: "lake",
						kind: "water_01",
						points: [
							[0, 0],
							[2, 0],
							[2, 2],
							[0, 2],
						],
					},
				],
			}),
		);

	it("toggles points of the selected road, the last one active", () => {
		const store = pointStore();
		store.getState().selectRoadPoint("r", 1);
		store.getState().togglePoint(3);
		expect(store.getState().selectedPointIndices).toEqual([1, 3]);
		expect(store.getState().selectedPointIndex).toBe(3);
		store.getState().togglePoint(3);
		expect(store.getState().selectedPointIndices).toEqual([1]);
		expect(store.getState().selectedPointIndex).toBe(1);
		// Selecting one point on its own collapses the list.
		store.getState().togglePoint(2);
		store.getState().selectRoadPoint("r", 0);
		expect(store.getState().selectedPointIndices).toEqual([0]);
		store.getState().selectRoad(null);
		expect(store.getState().selectedPointIndices).toEqual([]);
	});

	it("deletes the selected points in one step, keeping a road at two points", () => {
		const store = pointStore();
		store.getState().selectRoadPoint("r", 0);
		store.getState().selectPoints([0, 2]);
		store.getState().removeSelectedPoints();
		expect(store.getState().scene.roads[0].points.map((p) => p[0])).toEqual([2, 6]);
		expect(store.getState().selectedPointIndices).toEqual([]);
		expect(store.getState().past).toHaveLength(1);

		store.getState().selectRoadPoint("r", 0);
		store.getState().selectPoints([0, 1]);
		store.getState().removeSelectedPoints();
		expect(store.getState().scene.roads[0].points).toHaveLength(2);
	});

	it("deletes corners, keeping an area at three", () => {
		const store = pointStore();
		store.getState().selectAreaPoint("lake", 0);
		store.getState().selectPoints([0, 1]);
		store.getState().removeSelectedPoints();
		expect(store.getState().scene.areas[0].points).toHaveLength(4);
		store.getState().selectPoints([1]);
		store.getState().removeSelectedPoints();
		expect(store.getState().scene.areas[0].points).toHaveLength(3);
	});

	it("keeps the selected points that still exist after undo", () => {
		const store = pointStore();
		store.getState().selectRoadPoint("r", 1);
		store.getState().selectPoints([1, 3]);
		store.getState().insertRoadPoint("r", 4, [8, 0, 0]);
		store.getState().undo();
		expect(store.getState().selectedPointIndices).toEqual([1, 3]);
	});
});

describe("what moves as a group (ADR-0066)", () => {
	it("is several things, or a whole road or area with none of its points selected", () => {
		const store = makeStore();
		const roadId = store.getState().addRoad({
			points: [
				[0, 0],
				[4, 0],
			],
		});
		expect(selectMovesAsGroup(store.getState())).toBe(true);
		store.getState().selectRoadPoint(roadId, 0);
		expect(selectMovesAsGroup(store.getState())).toBe(false);
		store.getState().select("w");
		expect(selectMovesAsGroup(store.getState())).toBe(false);
		store.getState().toggleSelected({ kind: "road", id: roadId });
		expect(selectMovesAsGroup(store.getState())).toBe(true);
	});
});

describe("duplicating and moving (ADR-0067)", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("Shift+D copies in place and picks the copy up; cancelling goes back to before it", () => {
		const store = makeStore();
		store.getState().select("w");
		const before = store.getState().scene;
		store.getState().duplicateAndGrab();
		const { scene, transform, selectedItems } = store.getState();
		expect(scene.entities).toHaveLength(2);
		expect(scene.entities[1].position).toEqual(scene.entities[0].position);
		expect(selectedItems).toEqual([{ kind: "entity", id: scene.entities[1].id }]);
		expect(transform?.mode).toBe("grab");
		expect(transform?.undo?.scene).toBe(before);
		expect(transform?.undo?.items).toEqual([{ kind: "entity", id: "w" }]);

		// The move shares the copy's undo step.
		vi.advanceTimersByTime(5000);
		store.getState().moveEntity(scene.entities[1].id, [5, 5], {
			coalesce: transform?.token,
			gesture: true,
		});
		expect(store.getState().past).toHaveLength(1);
		store.getState().revertTo(before);
		expect(store.getState().scene.entities).toHaveLength(1);
		expect(store.getState().past).toHaveLength(0);
	});
});

describe("copying from a single object's gizmo (ADR-0067)", () => {
	it("leaves an identical copy behind under the name, and the moving one is the copy", () => {
		const store = makeStore();
		store.getState().updateEntity("w", (e) => {
			e.name = "Depot";
		});
		store.getState().select("w");
		store.getState().duplicateSelected({ step: 0, leaveBehind: true });
		const [original, copy] = store.getState().scene.entities;
		expect(store.getState().selectedId).toBe("w");
		expect(original.name).toBe("Depot copy");
		expect(copy.name).toBe("Depot");
		expect(copy.position).toEqual(original.position);
	});
});

describe("names of copies (ADR-0068)", () => {
	afterEach(() => resetPreferences());

	const named = () => {
		const store = makeStore();
		store.getState().updateEntity("w", (e) => {
			e.name = "Depot";
			if (e.label) {
				e.label.title = "Depot";
			}
		});
		return store;
	};

	it("adds “copy” by default, and a card titled with the name follows", () => {
		const store = named();
		const first = store.getState().duplicateEntity("w");
		const copy = store.getState().scene.entities.find((e) => e.id === first);
		expect(copy?.name).toBe("Depot copy");
		expect(copy?.label?.title).toBe("Depot copy");
	});

	it("numbers them when the preference says so", () => {
		setPreference("namesOfCopies", "numbered");
		const store = named();
		store.getState().duplicateEntity("w");
		store.getState().select("w");
		store.getState().duplicateSelected();
		expect(store.getState().scene.entities.map((e) => e.name)).toEqual([
			"Depot",
			"Depot 2",
			"Depot 3",
		]);
	});

	it("keeps a card's own title, and unnamed copies unnamed", () => {
		const store = makeStore();
		store.getState().duplicateEntity("w");
		const [original, copy] = store.getState().scene.entities;
		expect(copy.name).toBe("");
		expect(copy.label?.title).toBe(original.label?.title);
	});
});
