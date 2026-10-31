import { describe, expect, it } from "vitest";

import type { TScene } from "#/scene/schema";
import { createEmptyScene, TEMPLATES } from "#/templates";

import { compactWorld } from "./compactWorld";
import { readWorld } from "./readWorld";
import { getPart, resolveProps } from "./registry";

/** Objects' props as their parts draw them: a prop left out is its default. */
const asDrawn = (scene: TScene) => ({
	...scene,
	entities: scene.entities.map((entity) => {
		const part = getPart(entity.kind);
		return part ? { ...entity, props: resolveProps(part, entity.props) } : entity;
	}),
});

const worlds = [
	...TEMPLATES.map((template) => [template.id, template.create] as const),
	["empty", createEmptyScene] as const,
];

describe("a world with its defaults left out", () => {
	it.each(worlds)("%s reads back as it was, with no repairs", (_, create) => {
		const scene = create();
		const { scene: back, report } = readWorld(JSON.parse(JSON.stringify(compactWorld(scene))));
		expect(report).toBeNull();
		expect(asDrawn(back)).toEqual(asDrawn(scene));
	});

	it("is a fraction of the size", () => {
		const scene = TEMPLATES[0].create();
		const full = JSON.stringify(scene).length;
		const compact = JSON.stringify(compactWorld(scene)).length;
		expect(compact).toBeLessThan(full * 0.6);
	});
});
