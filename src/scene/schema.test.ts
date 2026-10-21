import { describe, expect, it } from "vitest";

import { TEMPLATES } from "#/templates";

import { parseScene } from "./migrate";
import { SceneSchema } from "./schema";

describe("SceneSchema", () => {
	it("fills defaults for a minimal scene", () => {
		const scene = SceneSchema.parse({ version: 1 });
		expect(scene.ground).toEqual({ width: 40, depth: 30, color: null });
		expect(scene.entities).toEqual([]);
		expect(scene.theme).toBe("system");
	});

	it("fills entity defaults", () => {
		const scene = SceneSchema.parse({ version: 1, entities: [{ id: "a", kind: "house" }] });
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
				{ id: "a", kind: "house" },
				{ id: "a", kind: "tree" },
			],
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid colours", () => {
		const result = SceneSchema.safeParse({
			version: 1,
			entities: [{ id: "a", kind: "house", color: "red" }],
		});
		expect(result.success).toBe(false);
	});

	it.each(TEMPLATES)("template $id is valid and round-trips through JSON", (template) => {
		const scene = template.create();
		expect(parseScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
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
