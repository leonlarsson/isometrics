import { describe, expect, it } from "vitest";

import { createEmptyScene, TEMPLATES } from "#/templates";

import { parseScene } from "./migrate";
import { RoadPointSchema, SceneSchema } from "./schema";

describe("SceneSchema", () => {
	it("fills defaults for a minimal scene", () => {
		const scene = SceneSchema.parse({ version: 1 });
		expect(scene.ground).toEqual({ width: 40, depth: 30, color: null });
		expect(scene.entities).toEqual([]);
		expect(scene.theme).toBe("system");
	});

	it("fills entity defaults", () => {
		const scene = SceneSchema.parse({ version: 1, entities: [{ id: "a", kind: "house_01" }] });
		expect(scene.entities[0]).toMatchObject({
			position: [0, 0],
			rotation: 0,
			scale: 1,
			color: null,
			label: null,
			follow: null,
			locked: false,
		});
	});

	it("rejects duplicate entity ids", () => {
		const result = SceneSchema.safeParse({
			version: 1,
			entities: [
				{ id: "a", kind: "house_01" },
				{ id: "a", kind: "round_tree_01" },
			],
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid colours", () => {
		const result = SceneSchema.safeParse({
			version: 1,
			entities: [{ id: "a", kind: "house_01", color: "red" }],
		});
		expect(result.success).toBe(false);
	});

	it.each(TEMPLATES)("template $id is valid and round-trips through JSON", (template) => {
		const scene = template.create();
		expect(parseScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
	});

	it("creates an empty world with bare ground", () => {
		const scene = createEmptyScene();
		expect(parseScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
		expect([scene.entities, scene.roads, scene.areas, scene.data]).toEqual([[], [], [], []]);
	});

	it("creates an empty world with the chosen settings", () => {
		const scene = createEmptyScene({
			title: "Harbour",
			ground: { width: 60, depth: 24 },
			theme: "dark",
			drivingSide: "left",
		});
		expect(scene.meta.title).toBe("Harbour");
		expect(scene.ground).toEqual({ width: 60, depth: 24, color: null });
		expect([scene.theme, scene.drivingSide]).toEqual(["dark", "left"]);
	});
});

describe("parseScene", () => {
	it("rejects non-objects and missing versions", () => {
		expect(() => parseScene(null)).toThrow();
		expect(() => parseScene({})).toThrow(/version/);
	});

	it("rejects scenes from a newer app version", () => {
		expect(() => parseScene({ version: 999 })).toThrow(/newer/);
	});
});

describe("RoadPointSchema", () => {
	it("accepts [x, z], [x, z, height] and [x, z, height, width]", () => {
		expect(RoadPointSchema.parse([1, 2])).toEqual([1, 2, 0]);
		expect(RoadPointSchema.parse([1, 2, 3])).toEqual([1, 2, 3]);
		expect(RoadPointSchema.parse([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
	});

	it("rejects widths outside the road limits", () => {
		expect(RoadPointSchema.safeParse([1, 2, 3, 0.1]).success).toBe(false);
		expect(RoadPointSchema.safeParse([1, 2, 3, 25]).success).toBe(false);
	});
});
