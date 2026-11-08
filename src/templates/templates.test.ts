import { describe, expect, it } from "vitest";

import { bodiesOf, OVERLAP_TOLERANCE, objectsInEachOther } from "#/parts/bodies";
import { getPart } from "#/parts/registry";
import { wearsMood } from "#/scene/moods";

import { createEmptyScene, TEMPLATES, templateById } from "./index";
import { createLanternBayScene } from "./lanternBay";

const templates = [
	...TEMPLATES.map((template) => [template.id, template.create] as const),
	["empty", createEmptyScene] as const,
];

describe("template ids (ADR-0126)", () => {
	it("are words joined by hyphens, as they're seen and typed in addresses", () => {
		for (const { id } of TEMPLATES) {
			expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
		}
	});

	it("find a template by its id only", () => {
		expect(templateById("lantern-bay")?.id).toBe("lantern-bay");
		expect(templateById("lantern_bay")).toBeUndefined();
		expect(templateById("nowhere")).toBeUndefined();
	});
});

describe("data in new worlds (ADR-0127)", () => {
	it("a new world starts without data", () => {
		expect(createEmptyScene().data.enabled).toBe(false);
	});

	it.each(TEMPLATES.map((template) => [template.id, template.create] as const))(
		"%s uses data exactly when it has some",
		(_, create) => {
			const { data } = create();
			const hasData = data.values.length + data.tables.length + data.sources.length > 0;
			expect(data.enabled).toBe(hasData);
		},
	);
});

describe("templates", () => {
	// Objects that stand still mustn't stand in each other (a pine inside a house, two roofs in
	// one place). What's left out, and why, is `takesUpRoom` (parts/bodies.ts): the same check
	// warns of it in a world being checked (ADR-0117).
	it.each(templates)("%s has no objects inside each other", (_, create) => {
		const clashes = objectsInEachOther(create().entities).map(
			({ a, b, overlap }) => `${a.id} and ${b.id} (by ${overlap.toFixed(2)})`,
		);
		expect(clashes).toEqual([]);
	});

	// Nothing that stands may hang over the ground's edge, floating on nothing.
	it.each(templates)("%s has no objects off the ground", (_, create) => {
		const scene = create();
		const half = [scene.grounds[0].width / 2, scene.grounds[0].depth / 2];
		const off: string[] = [];
		for (const entity of scene.entities) {
			const part = getPart(entity.kind);
			if (entity.follow || entity.isHidden || part?.category === "markers") {
				continue;
			}
			for (const body of bodiesOf(entity)) {
				// How far the outline reaches along x and z from its centre.
				const reach = (axis: 0 | 1) =>
					body.halves[0] * Math.abs(body.axes[0][axis]) +
					body.halves[1] * Math.abs(body.axes[1][axis]);
				const over = Math.max(
					Math.abs(body.centre[0]) + reach(0) - half[0],
					Math.abs(body.centre[1]) + reach(1) - half[1],
				);
				if (over > OVERLAP_TOLERANCE) {
					off.push(`${entity.id} (by ${over.toFixed(2)})`);
				}
			}
		}
		expect(off).toEqual([]);
	});

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
