import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataBindingSchema, SceneSchema, type TEntityLight, type TScene } from "#/scene/schema";

import { createEditorStore, unknownPartKinds } from "./store";

const makeStore = () =>
	createEditorStore(
		SceneSchema.parse({
			version: 1,
			data: [{ key: "orders", label: "Orders", value: 3 }],
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
		const textId = store
			.getState()
			.addEntity({ kind: "text_01", props: { text: "Orders", dataKey: "orders" } });
		store
			.getState()
			.upsertData({ key: "orders_packed", label: "Orders", value: 3, unit: "" }, "orders");
		const [entity] = store.getState().scene.entities;
		expect(store.getState().scene.data[0].key).toBe("orders_packed");
		expect(entity.label?.dataKeys).toEqual(["orders_packed"]);
		expect(entity.details.dataKeys).toEqual(["orders_packed"]);
		// A part's data key field (the text part's value) follows too.
		const text = store.getState().scene.entities.find((e) => e.id === textId);
		expect(text?.props.dataKey).toBe("orders_packed");
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
		expect(road).toMatchObject({ style: "dirt_path_01", name: "Dirt path 1", closed: false });
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
		const id = s().finishDrawing({ closed: true });
		expect(s().scene.roads.find((r) => r.id === id)?.closed).toBe(false);
	});

	it("sets one part prop and keeps every other stored prop, even unknown ones (ADR-0056)", () => {
		const store = makeStore();
		const s = () => store.getState();
		const id = s().addEntity({
			kind: "office_tower_01",
			props: { floors: 9, fromNewerVersion: "keep me", storeys: 4 },
		});
		s().setEntityProp(id, "floors", 12);
		expect(s().scene.entities.find((e) => e.id === id)?.props).toEqual({
			floors: 12,
			fromNewerVersion: "keep me",
			storeys: 4,
		});
		s().undo();
		expect(s().scene.entities.find((e) => e.id === id)?.props.floors).toBe(9);
	});

	it("sets one light's settings, turning an older world's single setting into each light's", () => {
		const store = makeStore();
		const s = () => store.getState();
		const lamp = s().addEntity({ kind: "street_lamp_01", lights: "off" });
		s().setEntityLight(lamp, "lamp", { color: "#ff0000" });
		expect(s().scene.entities.find((e) => e.id === lamp)?.lights).toEqual({
			lamp: expect.objectContaining({ mode: "off", color: "#ff0000", strength: null }),
		});
		// Back to the part's for everything: no entry left.
		s().setEntityLight(lamp, "lamp", { mode: null, color: null });
		expect(s().scene.entities.find((e) => e.id === lamp)?.lights).toEqual({});
	});

	it("renames or drops a data key in lights switched or dimmed by it", () => {
		const store = makeStore();
		const s = () => store.getState();
		const lamp = s().addEntity({ kind: "street_lamp_01" });
		const binding = DataBindingSchema.parse({ key: "orders" });
		s().setEntityLight(lamp, "lamp", { data: { on: binding, strength: { ...binding, full: 10 } } });
		s().setEntityColor(lamp, "post", { data: { color: binding } });
		s().upsertData({ key: "sales", label: "Orders", value: 3, unit: "" }, "orders");
		const entity = () => s().scene.entities.find((e) => e.id === lamp);
		const lights = () => entity()?.lights as Record<string, TEntityLight>;
		expect(lights().lamp.data).toEqual({
			on: { ...binding, key: "sales" },
			strength: { ...binding, key: "sales", full: 10 },
		});
		expect(entity()?.colors.post.data).toEqual({ color: { ...binding, key: "sales" } });
		// Deleting the value: those settings no longer follow data, and nothing else is left.
		s().removeData("sales");
		expect(lights()).toEqual({});
		expect(entity()?.colors).toEqual({});
	});

	it("sets an object's colours by id, taking over an older world's colour so Reset goes back to the part's", () => {
		const store = makeStore();
		const s = () => store.getState();
		const house = s().addEntity({ kind: "house_01", color: "#123456", accent: "#654321" });
		const entity = () => s().scene.entities.find((e) => e.id === house);
		s().setEntityColor(house, "roof", {
			data: { color: DataBindingSchema.parse({ key: "heat" }) },
		});
		// The old main colour is now the roof's setting; the accent (the door) is untouched.
		expect(entity()?.colors.roof.color).toBe("#123456");
		expect(entity()?.color).toBeNull();
		expect(entity()?.accent).toBe("#654321");
		s().setEntityColor(house, "roof", { color: null, data: { color: null } });
		expect(entity()?.colors).toEqual({});
		s().setEntityColor(house, "door", { color: null });
		expect(entity()?.accent).toBeNull();
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
			closed: true,
			points: [
				[0, 0],
				[4, 0],
				[4, 4],
			],
		});
		expect(s().splitRoad(id, 1)).toBe(id);
		const road = s().scene.roads[0];
		expect(road.closed).toBe(false);
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
		expect(road.closed).toBe(true);
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
		expect(area).toMatchObject({ type: "raised_land_01", name: "Raised land 1", height: 1.5 });
		expect(area?.points).toEqual([
			[0, 0],
			[4, 0],
			[4, 4],
		]);
		expect(s().selectedAreaId).toBe(id);
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
		const id = store
			.getState()
			.addEntity({ kind: "delivery_van_01", position: [4, -0.5], elevation: 0.2, rotation: 180 });
		store
			.getState()
			.setFollowOffer({ entityId: id, roadId, offset: 4, reverse: true, position: [4, -0.5] });

		store.getState().select("w");
		expect(store.getState().followOffer).toBeNull();

		store
			.getState()
			.setFollowOffer({ entityId: id, roadId, offset: 4, reverse: true, position: [4, -0.5] });
		store.getState().acceptFollowOffer();
		const van = store.getState().scene.entities.find((e) => e.id === id);
		expect(van?.follow).toMatchObject({ roadId, offset: 4, reverse: true, speed: 2 });
		expect(van?.elevation).toBe(0);
		expect(van?.rotation).toBe(0);
		expect(store.getState().followOffer).toBeNull();

		store.getState().undo();
		const parked = store.getState().scene.entities.find((e) => e.id === id);
		expect(parked?.follow).toBeNull();
		expect(parked?.rotation).toBe(180);
	});

	it("toggles the selection's visibility, shows everything again, and locks items", () => {
		const store = makeStore();
		store.getState().select("w");
		store.getState().toggleSelectedHidden();
		expect(store.getState().scene.entities[0].hidden).toBe(true);
		expect(store.getState().selectedId).toBe("w");
		store.getState().toggleSelectedHidden();
		expect(store.getState().scene.entities[0].hidden).toBe(false);

		store.getState().toggleSelectedHidden();
		store.getState().revealAll();
		expect(store.getState().scene.entities[0].hidden).toBe(false);

		const roadId = store.getState().addRoad({
			points: [
				[0, 0],
				[10, 0],
			],
		});
		store.getState().setItemFlag({ kind: "road", id: roadId }, "locked", true);
		expect(store.getState().scene.roads[0].locked).toBe(true);
		store.getState().undo();
		expect(store.getState().scene.roads[0].locked).toBe(false);
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
			perspective: false,
			fieldOfView: null,
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

	it("opens at the remembered camera, else the opening viewpoint, else the whole world", () => {
		const store = makeStore();
		const pose = {
			target: [4, 2] as [number, number],
			azimuth: 200,
			elevation: 50,
			span: 12,
			perspective: true,
			fieldOfView: null,
		};
		const nonce = store.getState().viewNonce;
		store.getState().showOpeningView(null);
		expect(store.getState().viewNonce).toBe(nonce + 1);
		expect(store.getState().flight).toBeNull();

		const opening = store.getState().addViewpoint(pose);
		store.getState().setOpeningViewpoint(opening);
		store.getState().showOpeningView(null);
		expect(store.getState().flight).toMatchObject({ pose: { span: 12 }, instant: true });
		expect(store.getState().perspective).toBe(true);
		expect(store.getState().activeViewpointId).toBe(opening);

		store.getState().showOpeningView({ ...pose, span: 30, perspective: false });
		expect(store.getState().flight).toMatchObject({ pose: { span: 30 }, instant: true });
		expect(store.getState().perspective).toBe(false);
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
