import { beforeEach, describe, expect, it } from "vitest";

import { SceneSchema } from "#/scene/schema";

import {
	addGround,
	countGoingWith,
	moveGround,
	pickGround,
	removeGround,
	startGroundMove,
	useGroundEditing,
} from "./groundEditing";
import { useEditor } from "./store";

/** A base ground, and an island east of it with a house on it, a road bridging the two. */
const load = () => {
	useEditor.getState().loadScene(
		SceneSchema.parse({
			version: 1,
			grounds: [
				{ id: "base", width: 30, depth: 30 },
				{ id: "isle", width: 10, depth: 10, position: [30, 0] },
			],
			entities: [
				{ id: "on_isle", kind: "house_01", position: [30, 0] },
				{ id: "on_base", kind: "house_01", position: [-5, 0] },
			],
			areas: [
				{
					id: "lawn",
					kind: "grass_01",
					points: [
						[28, -2],
						[32, -2],
						[32, 2],
						[28, 2],
					],
				},
			],
			roads: [
				{
					id: "bridge",
					points: [
						[10, 4, 0],
						[29, 4, 0],
					],
				},
			],
			viewpoints: [{ id: "view_isle", name: "The island", target: [30, 0], span: 20 }],
		}),
	);
	useGroundEditing.setState({ pickedId: null, isOn: false, selected: [] });
};

const scene = () => useEditor.getState().scene;

describe("moving and removing grounds (ADR-0155)", () => {
	beforeEach(load);

	it("moves a ground with everything on it, up too, and stretches a bridge to it", () => {
		pickGround("isle");
		const move = startGroundMove();
		if (!move) {
			throw new Error("no move");
		}
		moveGround(move, [10, -5], 4, { coalesce: "test" });
		const now = scene();
		expect(now.grounds[1]).toMatchObject({ position: [40, -5], altitude: 4 });
		expect(now.entities.find((e) => e.id === "on_isle")).toMatchObject({
			position: [40, -5],
			altitude: 4,
		});
		// What's on the other ground stays.
		expect(now.entities.find((e) => e.id === "on_base")?.position).toEqual([-5, 0]);
		expect(now.areas[0].points[0]).toEqual([38, -7]);
		// The bridge: its end on the island went with it, up too; its start on the base stayed.
		expect(now.roads[0].points).toEqual([
			[10, 4, 0],
			[39, -1, 4],
		]);
		expect(now.viewpoints[0].target).toEqual([40, -5]);

		// Each step of a drag goes from where it started, and the whole drag is one undo step.
		moveGround(move, [2, 0], 0, { coalesce: "test" });
		expect(scene().grounds[1].position).toEqual([32, 0]);
		useEditor.getState().undo();
		expect(scene().grounds[1].position).toEqual([30, 0]);
		expect(scene().entities.find((e) => e.id === "on_isle")?.position).toEqual([30, 0]);
	});

	it("removes a ground with what stands wholly on it, in one undo step, and keeps the last one", () => {
		expect(countGoingWith(scene(), "isle")).toBe(2);
		removeGround("isle");
		expect(scene().grounds.map((g) => g.id)).toEqual(["base"]);
		expect(scene().entities.map((e) => e.id)).toEqual(["on_base"]);
		expect(scene().areas).toEqual([]);
		// The bridge reached the base too: it stays.
		expect(scene().roads).toHaveLength(1);
		removeGround("base");
		expect(scene().grounds).toHaveLength(1);
		useEditor.getState().undo();
		expect(scene().grounds).toHaveLength(2);
		expect(scene().entities).toHaveLength(2);
	});

	it("adds a ground beside the others, picked", () => {
		const id = addGround();
		const added = scene().grounds.find((g) => g.id === id);
		expect(added?.position[0]).toBeGreaterThan(35);
		expect(useGroundEditing.getState().pickedId).toBe(id);
	});
});
