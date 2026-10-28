import { beforeEach, describe, expect, it } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { groupStart, transformSelected, transformSelectedPoints } from "./groupTransform";
import { useEditor } from "./store";

const load = () => {
	useEditor.getState().loadScene(
		SceneSchema.parse({
			version: 1,
			ground: { width: 20, depth: 20 },
			entities: [
				{ id: "a", kind: "house_01", position: [-2, 0], rotation: 0, scale: 1 },
				{ id: "b", kind: "house_01", position: [2, 0], rotation: 90, scale: 2 },
				{ id: "fixed", kind: "house_01", position: [0, 4], locked: true },
				{ id: "car", kind: "car_01", follow: { roadId: "r" } },
			],
			roads: [
				{
					id: "r",
					points: [
						[0, -2, 1],
						[0, 2, 0, 3],
					],
				},
			],
		}),
	);
	useEditor.getState().selectItems([
		{ kind: "entity", id: "a" },
		{ kind: "entity", id: "b" },
		{ kind: "entity", id: "fixed" },
		{ kind: "entity", id: "car" },
		{ kind: "road", id: "r" },
	]);
};

const entity = (id: string) => useEditor.getState().scene.entities.find((e) => e.id === id);
const road = () => useEditor.getState().scene.roads[0];

describe("group transforms (ADR-0064)", () => {
	beforeEach(load);

	it("leaves locked things out and turns around the middle of what moves", () => {
		const start = groupStart();
		expect(start?.entities.map((e) => e.id)).toEqual(["a", "b"]);
		expect(start?.drivers.map((e) => e.id)).toEqual(["car"]);
		expect(start?.center).toEqual([0, 0, 0]);
	});

	it("moves everything by the same amount, as one undo step", () => {
		const before = useEditor.getState().past.length;
		transformSelected({ offset: [1, 2] });
		expect(entity("a")?.position).toEqual([-1, 2]);
		expect(entity("b")?.position).toEqual([3, 2]);
		expect(entity("fixed")?.position).toEqual([0, 4]);
		expect(road().points).toEqual([
			[1, 0, 1],
			[1, 4, 0, 3],
		]);
		expect(useEditor.getState().past.length).toBe(before + 1);
	});

	it("keeps a moved group on the ground as a whole", () => {
		transformSelected({ offset: [50, 0] });
		// The rightmost spot (b at x 2) stops at the edge (10); the layout stays.
		expect(entity("b")?.position[0]).toBe(10);
		expect(entity("a")?.position[0]).toBe(6);
	});

	it("turns positions and headings around the centre", () => {
		transformSelected({ turn: 90 });
		// Counter-clockwise seen from above: +X goes to -Z.
		expect(entity("b")?.position.map((v) => v + 0)).toEqual([0, -2]);
		expect(entity("b")?.rotation).toBe(180);
		expect(entity("a")?.position.map((v) => v + 0)).toEqual([0, 2]);
		expect(entity("a")?.rotation).toBe(90);
		expect(entity("car")?.rotation).toBe(0);
	});

	it("resizes sizes and spacing together, within every object's limits", () => {
		transformSelected({ ratio: 2 });
		expect(entity("a")?.position).toEqual([-4, 0]);
		expect(entity("a")?.scale).toBe(2);
		expect(entity("b")?.scale).toBe(4);
		expect(entity("car")?.scale).toBe(2);
		transformSelected({ ratio: 100 });
		// b (4) reaches the largest size first; a keeps its proportion to it.
		expect(entity("b")?.scale).toBe(10);
		expect(entity("a")?.scale).toBe(5);
	});

	it("lifts objects and road points; objects may sink into the ground, roads not (ADR-0097)", () => {
		transformSelected({ lift: 2 });
		expect(entity("a")?.elevation).toBe(2);
		expect(road().points[0][2]).toBe(3);
		transformSelected({ lift: -10 });
		expect(entity("a")?.elevation).toBe(-8);
		expect(road().points[1][2]).toBe(0);
		transformSelected({ lift: -100 });
		expect(entity("a")?.elevation).toBe(-30);
	});
});

describe("moving several points (ADR-0065)", () => {
	beforeEach(() => {
		useEditor.getState().loadScene(
			SceneSchema.parse({
				version: 1,
				ground: { width: 20, depth: 20 },
				roads: [
					{
						id: "r",
						points: [
							[0, 0, 1],
							[2, 0, 0, 3],
							[4, 0],
						],
					},
				],
			}),
		);
		useEditor.getState().selectRoadPoint("r", 0);
		useEditor.getState().selectPoints([0, 1]);
	});

	it("moves and lifts only the selected points, keeping widths, as one step", () => {
		const before = useEditor.getState().past.length;
		transformSelectedPoints({ offset: [1, 2], lift: 1 });
		expect(road().points).toEqual([
			[1, 2, 2],
			[3, 2, 1, 3],
			[4, 0, 0],
		]);
		expect(useEditor.getState().past.length).toBe(before + 1);
	});

	it("keeps them on the ground together", () => {
		transformSelectedPoints({ offset: [50, 0] });
		expect(road().points[1][0]).toBe(10);
		expect(road().points[0][0]).toBe(8);
	});
});

describe("area corners with their own heights (ADR-0096)", () => {
	const area = () => useEditor.getState().scene.areas[0];

	beforeEach(() => {
		useEditor.getState().loadScene(
			SceneSchema.parse({
				version: 1,
				ground: { width: 20, depth: 20 },
				areas: [
					{
						id: "hill",
						height: 1,
						points: [
							[0, 0],
							[4, 0, 2],
							[4, 4],
							[0, 4],
						],
					},
				],
			}),
		);
	});

	it("lifts the selected corners, never below the ground, keeping the others flat", () => {
		useEditor.getState().selectAreaPoint("hill", 0);
		useEditor.getState().selectPoints([0, 1]);
		transformSelectedPoints({ offset: [1, 0], lift: -2 });
		expect(area().points).toEqual([
			[1, 0, -1],
			[5, 0],
			[4, 4],
			[0, 4],
		]);
	});

	it("raises a whole area, its corners' own heights on top", () => {
		useEditor.getState().selectItems([{ kind: "area", id: "hill" }]);
		transformSelected({ offset: [1, 1], lift: 0.5 });
		expect(area().height).toBe(1.5);
		expect(area().points[1]).toEqual([5, 1, 2]);
		expect(area().points[0]).toEqual([1, 1]);
	});
});

describe("objects stand on the ground under them (ADR-0098)", () => {
	beforeEach(() => {
		useEditor.getState().loadScene(
			SceneSchema.parse({
				version: 1,
				ground: { width: 40, depth: 40 },
				areas: [
					{
						id: "plateau",
						type: "raised_land_01",
						height: 2,
						points: [
							[4, -4],
							[12, -4],
							[12, 4],
							[4, 4],
						],
					},
				],
				entities: [
					{ id: "house", kind: "house_01", position: [0, 0] },
					{ id: "sign", kind: "house_01", position: [0, 6], elevation: 1 },
					{ id: "onTop", kind: "house_01", position: [8, 0], elevation: 2 },
				],
			}),
		);
	});

	it("placed freely, climbs onto raised land and keeps a lift of its own", () => {
		const store = useEditor.getState();
		const freely = { followGround: true };
		store.moveEntity("house", [6, 0], undefined, freely);
		expect(entity("house")?.elevation).toBe(2);
		store.moveEntity("house", [-6, 0], undefined, freely);
		expect(entity("house")?.elevation).toBe(0);
		store.moveEntity("sign", [8, 2], undefined, freely);
		expect(entity("sign")?.elevation).toBe(3);
	});

	it("moved exactly (an axis, a typed distance, the keys), keeps its height", () => {
		useEditor.getState().moveEntity("house", [6, 0]);
		expect(entity("house")?.elevation).toBe(0);
	});

	it("lands new objects on the ground where they're put", () => {
		const id = useEditor.getState().addEntity({ kind: "house_01", position: [10, 0] });
		expect(entity(id)?.elevation).toBe(2);
	});

	it("placed freely as a group, each lands on the ground there", () => {
		useEditor.getState().selectItems([
			{ kind: "entity", id: "house" },
			{ kind: "entity", id: "sign" },
		]);
		transformSelected({ offset: [8, -3], followGround: true });
		expect(entity("house")?.elevation).toBe(2);
		expect(entity("sign")?.elevation).toBe(3);
	});

	it("moves with the land it stands on, lifted once", () => {
		useEditor.getState().selectItems([
			{ kind: "area", id: "plateau" },
			{ kind: "entity", id: "onTop" },
		]);
		transformSelected({ offset: [-10, 0], lift: 1 });
		expect(useEditor.getState().scene.areas[0].height).toBe(3);
		expect(entity("onTop")?.elevation).toBe(3);
		expect(entity("onTop")?.position).toEqual([-2, 0]);
	});
});
