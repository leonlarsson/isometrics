import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getPart, resolveProps } from "#/parts/registry";

import { AREA_TYPE_LABELS } from "./areas";
import { parseOrRepairScene } from "./repair";
import { ROAD_STYLE_LABELS } from "./roads";

/**
 * Worlds saved by earlier versions of the app (ADR-0056): each file is a
 * template exactly as that commit's code produced it, named
 * `<template>-<commit>.json`. Add one with every change to the world format
 * (`pnpm fixture:old-world <commit> <template>`); never edit them.
 */
const FOLDER = new URL("./fixtures/old-worlds/", import.meta.url);

interface IRawWorld {
	entities?: { kind: string; props?: Record<string, unknown> }[];
	roads?: { points: unknown[] }[];
	areas?: { points: unknown[] }[];
	data?: unknown[];
	viewpoints?: unknown[];
}

const worlds = readdirSync(FOLDER)
	.filter((name) => name.endsWith(".json"))
	.sort()
	.map((name) => [name, readFileSync(new URL(name, FOLDER), "utf8")] as const);

describe("worlds saved by earlier versions", () => {
	it("are there", () => {
		expect(worlds.length).toBeGreaterThan(0);
	});

	it.each(worlds)("%s opens as it was, with nothing repaired or lost", (_, text) => {
		const raw = JSON.parse(text) as IRawWorld;
		const { scene, report } = parseOrRepairScene(JSON.parse(text));

		expect(report, "it needed repairs").toBeNull();
		expect(scene.entities).toHaveLength(raw.entities?.length ?? 0);
		expect(scene.roads).toHaveLength(raw.roads?.length ?? 0);
		expect(scene.areas).toHaveLength(raw.areas?.length ?? 0);
		expect(scene.data).toHaveLength(raw.data?.length ?? 0);
		expect(scene.viewpoints).toHaveLength(raw.viewpoints?.length ?? 0);

		scene.roads.forEach((road, i) => {
			expect(ROAD_STYLE_LABELS, `road ${road.id}`).toHaveProperty(road.style);
			expect(road.points, `road ${road.id}`).toHaveLength(raw.roads?.[i].points.length ?? 0);
		});
		scene.areas.forEach((area, i) => {
			expect(AREA_TYPE_LABELS, `area ${area.id}`).toHaveProperty(area.type);
			expect(area.points, `area ${area.id}`).toHaveLength(raw.areas?.[i].points.length ?? 0);
		});
	});

	it.each(worlds)("%s keeps every object's part and props", (_, text) => {
		const raw = JSON.parse(text) as IRawWorld;
		const { scene } = parseOrRepairScene(JSON.parse(text));

		scene.entities.forEach((entity, i) => {
			const part = getPart(entity.kind);
			expect(part, `object ${entity.id} (${raw.entities?.[i].kind})`).toBeDefined();
			if (!part) {
				return;
			}
			const resolved = resolveProps(part, entity.props) as Record<string, unknown>;
			const renamed = part.renamedProps ?? {};
			for (const [key, value] of Object.entries(raw.entities?.[i].props ?? {})) {
				expect(entity.props[key], `object ${entity.id} keeps "${key}"`).toEqual(value);
				// Removed on purpose: the value stays in the world, unused.
				if (part.removedProps?.includes(key)) {
					continue;
				}
				const current = renamed[key] ?? key;
				expect(
					resolved,
					`${part.kind} no longer has the prop "${key}": if it was renamed, add it to the part's renamedProps; if it was removed on purpose, to removedProps`,
				).toHaveProperty(current);
				expect(resolved[current], `object ${entity.id}, prop "${key}"`).toEqual(value);
			}
		});
	});
});
