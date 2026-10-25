import { beforeEach, describe, expect, it } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { groupStart, transformSelected } from "./groupTransform";
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

	it("lifts objects and road points, never below the ground", () => {
		transformSelected({ lift: 2 });
		expect(entity("a")?.elevation).toBe(2);
		expect(road().points[0][2]).toBe(3);
		transformSelected({ lift: -10 });
		expect(entity("a")?.elevation).toBe(0);
		expect(road().points[1][2]).toBe(0);
	});
});
