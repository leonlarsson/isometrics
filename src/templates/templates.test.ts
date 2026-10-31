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

/**
 * An object's bodies: ground outlines (a footprint, turned and scaled) and the heights each
 * takes up. One, or two for parts wider overhead than at their foot (`overhang`, a parasol):
 * the foot from the ground, the rest of the footprint from where it begins.
 */
const bodiesOf = (entity: TEntity) => {
	const part = getPart(entity.kind);
	if (!part) {
		return [];
	}
	const props = resolveProps(part, entity.props);
	const turn = (entity.rotation[1] * Math.PI) / 180;
	// Vehicles face +X; a turn of r degrees about Y takes +X to (cos r, -sin r).
	const along: [number, number] = [Math.cos(turn), -Math.sin(turn)];
	const across: [number, number] = [Math.sin(turn), Math.cos(turn)];
	const top = entity.altitude + part.height(props) * entity.scale;
	const body = ([width, depth]: [number, number], bottom: number) => ({
		centre: entity.position,
		axes: [along, across] as const,
		halves: [(width * entity.scale) / 2, (depth * entity.scale) / 2] as const,
		bottom,
		top,
	});
	const overhang = part.overhang?.(props);
	return overhang
		? [
				body(overhang.foot, entity.altitude),
				body(part.footprint(props), entity.altitude + overhang.from * entity.scale),
			]
		: [body(part.footprint(props), entity.altitude)];
};

/** How far two outlines overlap, the least along any of their axes (0 or less: they don't). */
type TBody = ReturnType<typeof bodiesOf>[number];

const overlapOf = (a: TBody, b: TBody) => {
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
			return !entity.follow && !entity.isHidden && !part?.flat && part?.category !== "markers";
		});
		const clashes: string[] = [];
		standing.forEach((a, i) => {
			for (const b of standing.slice(i + 1)) {
				// The most any body of one overlaps any body of the other, where their heights meet.
				const overlap = Math.max(
					0,
					...bodiesOf(a).flatMap((one) =>
						bodiesOf(b)
							.filter((other) => one.top > other.bottom && other.top > one.bottom)
							.map((other) => overlapOf(one, other)),
					),
				);
				if (overlap > 0.05) {
					clashes.push(`${a.id} and ${b.id} (by ${overlap.toFixed(2)})`);
				}
			}
		});
		expect(clashes).toEqual([]);
	});

	// Nothing that stands may hang over the ground's edge, floating on nothing.
	it.each(templates)("%s has no objects off the ground", (_, create) => {
		const scene = create();
		const half = [scene.ground.width / 2, scene.ground.depth / 2];
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
				if (over > 0.05) {
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
