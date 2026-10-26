import { describe, expect, it } from "vitest";

import { getPart } from "#/parts/registry";
import { wearsMood } from "#/scene/moods";

import { createEmptyScene, TEMPLATES } from "./index";
import { createLanternBayScene } from "./lanternBay";

const templates = [
	...TEMPLATES.map((template) => [template.id, template.create] as const),
	["empty", createEmptyScene] as const,
];

describe("templates", () => {
	// A prop the part doesn't know is kept but never drawn: a renamed prop set under its old name,
	// or another part's prop (an oak given a sign's letterHeight).
	it.each(templates)("%s sets only props its parts know", (_, create) => {
		for (const entity of create().entities) {
			const part = getPart(entity.kind);
			expect(part, entity.id).toBeDefined();
			const known = Object.keys(part?.schema.parse({}) ?? {});
			for (const key of Object.keys(entity.props)) {
				expect(known, `${entity.id} (${entity.kind})`).toContain(key);
			}
		}
	});

	it.each(templates)("%s's viewpoints name moods it has", (_, create) => {
		const scene = create();
		const moods = new Set(scene.moods.map((mood) => mood.id));
		for (const viewpoint of scene.viewpoints) {
			if (viewpoint.moodId !== null) {
				expect(moods, viewpoint.id).toContain(viewpoint.moodId);
			}
		}
	});

	it("Lantern Bay opens wearing its mood The evening passes (ADR-0078)", () => {
		const scene = createLanternBayScene();
		const evening = scene.moods.find((mood) => mood.name === "The evening passes");
		expect(evening && wearsMood(scene, evening)).toBe(true);
	});
});
