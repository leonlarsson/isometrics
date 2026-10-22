import { describe, expect, it } from "vitest";

import { TEMPLATES } from "#/templates";

import { describeRepairs, parseOrRepairScene, repairScene } from "./repair";

const road = (overrides: Record<string, unknown> = {}) => ({
	id: "r1",
	points: [
		[0, 0],
		[5, 0],
		[5, 5],
	],
	...overrides,
});

describe("parseOrRepairScene", () => {
	it("leaves a valid world alone", () => {
		const scene = TEMPLATES[0].create();
		const result = parseOrRepairScene(JSON.parse(JSON.stringify(scene)));
		expect(result.report).toBeNull();
		expect(result.scene).toEqual(scene);
	});

	it("resets an invalid field to its default and keeps the item", () => {
		const { scene, report } = parseOrRepairScene({
			version: 1,
			roads: [road({ style: "cobblestone", width: 3 })],
		});
		expect(scene.roads[0]).toMatchObject({ id: "r1", style: "asphalt", width: 3 });
		expect(report?.fixed).toBe(1);
		expect(report?.removed.roads).toBe(0);
	});

	it("keeps the world's settings, turns included", () => {
		const { scene } = repairScene({
			version: 1,
			driving: "left",
			turns: "sharp",
			roads: [road({ style: "cobblestone" })],
		});
		expect(scene).toMatchObject({ driving: "left", turns: "sharp" });
	});

	it("drops one bad road point but keeps the road", () => {
		const { scene } = repairScene({
			version: 1,
			roads: [
				road({
					points: [
						[0, 0],
						[5, 0, 999],
						[5, 5],
					],
				}),
			],
		});
		expect(scene.roads[0].points).toEqual([
			[0, 0, 0],
			[5, 5, 0],
		]);
	});

	it("removes a road left with too few points", () => {
		const { scene, report } = repairScene({
			version: 1,
			roads: [
				road({
					points: [
						[0, 0],
						["x", 0],
					],
				}),
			],
		});
		expect(scene.roads).toEqual([]);
		expect(report.removed.roads).toBe(1);
	});

	it("removes items it can't repair and keeps the first of duplicate ids", () => {
		const { scene, report } = repairScene({
			version: 1,
			entities: [
				{ id: "a", kind: "house" },
				{ kind: "tree" },
				{ id: "a", kind: "car" },
				"not an object",
			],
		});
		expect(scene.entities.map((e) => [e.id, e.kind])).toEqual([["a", "house"]]);
		expect(report.removed.objects).toBe(3);
	});

	it("resets a broken nested value such as a label's card offset", () => {
		const { scene } = repairScene({
			version: 1,
			entities: [{ id: "a", kind: "house", label: { title: "Hi", offset: [1, 2] } }],
		});
		expect(scene.entities[0].label).toMatchObject({ title: "Hi", offset: [0, 2, 0] });
	});

	it("resets invalid scene settings", () => {
		const { scene, report } = repairScene({ version: 1, theme: "neon", ground: { width: -5 } });
		expect(scene.theme).toBe("system");
		expect(scene.ground.width).toBe(40);
		expect(report.fixed).toBe(2);
	});

	it("repairs worlds from a newer version", () => {
		const { scene, report } = parseOrRepairScene({ version: 99, roads: [road()] });
		expect(scene.roads).toHaveLength(1);
		expect(report?.newerVersion).toBe(true);
	});

	it("rejects things that aren't worlds", () => {
		expect(() => repairScene(null)).toThrow();
		expect(() => repairScene([])).toThrow();
		expect(() => repairScene({ hello: "world" })).toThrow(/doesn’t look like a world/);
	});
});

describe("describeRepairs", () => {
	it("says what was left out and reset", () => {
		const text = describeRepairs({
			removed: { objects: 2, roads: 1, areas: 0, values: 0 },
			fixed: 1,
			newerVersion: false,
			missingVersion: false,
		});
		expect(text).toBe(
			"2 objects and 1 road couldn’t be read and were left out. 1 smaller detail (like a colour or a road point) couldn’t be read and was reset or left out.",
		);
	});
});
