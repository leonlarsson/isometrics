import { describe, expect, it } from "vitest";

import { getPart, resolveProps } from "#/parts/registry";
import { wearsMood } from "#/scene/moods";
import type { TEntity } from "#/scene/schema";

import { createEmptyScene, TEMPLATES } from "./index";
import { createLanternBayScene } from "./lanternBay";

const templates = [
	...TEMPLATES.map((template) => [template.id, template.create] as const),
	["empty", createEmptyScene] as const,
];

/** An object's ground outline (its footprint, turned and scaled) and the heights it takes up. */
const bodyOf = (entity: TEntity) => {
	const part = getPart(entity.kind);
	if (!part) {
		return null;
	}
	const props = resolveProps(part, entity.props);
	const [width, depth] = part.footprint(props);
	const turn = (entity.rotation * Math.PI) / 180;
	// Vehicles face +X; a turn of r degrees about Y takes +X to (cos r, -sin r).
	const along: [number, number] = [Math.cos(turn), -Math.sin(turn)];
	const across: [number, number] = [Math.sin(turn), Math.cos(turn)];
	return {
		centre: entity.position,
		axes: [along, across] as const,
		halves: [(width * entity.scale) / 2, (depth * entity.scale) / 2] as const,
		bottom: entity.elevation,
		top: entity.elevation + part.height(props) * entity.scale,
	};
};

/** How far two outlines overlap, the least along any of their axes (0 or less: they don't). */
const overlapOf = (
	a: NonNullable<ReturnType<typeof bodyOf>>,
	b: NonNullable<ReturnType<typeof bodyOf>>,
) => {
	let least = Number.POSITIVE_INFINITY;
	for (const axis of [...a.axes, ...b.axes]) {
		const reach = (body: typeof a) =>
			body.halves[0] * Math.abs(body.axes[0][0] * axis[0] + body.axes[0][1] * axis[1]) +
			body.halves[1] * Math.abs(body.axes[1][0] * axis[0] + body.axes[1][1] * axis[1]);
		const apart = Math.abs(
			(b.centre[0] - a.centre[0]) * axis[0] + (b.centre[1] - a.centre[1]) * axis[1],
		);
		least = Math.min(least, reach(a) + reach(b) - apart);
	}
	return least;
};

describe("templates", () => {
	// Objects that stand still mustn't stand in each other (a pine inside a house, two roofs in
	// one place); vehicles on a route move, flat parts are meant to be stood on, and markers
	// (beacons, text) mark a spot, beside or over what's there.
	it.each(templates)("%s has no objects inside each other", (_, create) => {
		const standing = create().entities.filter((entity) => {
			const part = getPart(entity.kind);
			return !entity.follow && !entity.hidden && !part?.flat && part?.category !== "markers";
		});
		const clashes: string[] = [];
		standing.forEach((a, i) => {
			for (const b of standing.slice(i + 1)) {
				const one = bodyOf(a);
				const other = bodyOf(b);
				if (!one || !other || one.top <= other.bottom || other.top <= one.bottom) {
					continue;
				}
				const overlap = overlapOf(one, other);
				if (overlap > 0.05) {
					clashes.push(`${a.id} and ${b.id} (by ${overlap.toFixed(2)})`);
				}
			}
		});
		expect(clashes).toEqual([]);
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
