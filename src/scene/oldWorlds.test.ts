import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveColors } from "#/parts/colorModel";
import { readWorld } from "#/parts/readWorld";
import { getPart, resolveProps } from "#/parts/registry";

import { AREA_KIND_LABELS } from "./areas";
import { ROAD_KIND_LABELS } from "./roads";
import { scenePalettes } from "./theme";

/**
 * Worlds saved by earlier versions of the app (ADR-0056): each file is a
 * template exactly as that commit's code produced it, named
 * `<template>-<commit>.json`. Add one with every change to the world format
 * (`pnpm fixture:old-world <commit> <template>`); never edit them.
 */
const FOLDER = new URL("./fixtures/old-worlds/", import.meta.url);

interface IRawWorld {
	entities?: {
		kind: string;
		props?: Record<string, unknown>;
		color?: string | null;
		accent?: string | null;
		colors?: Record<string, { color?: string | null }>;
	}[];
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
		const { scene, report } = readWorld(JSON.parse(text));

		expect(report, "it needed repairs").toBeNull();
		expect(scene.entities).toHaveLength(raw.entities?.length ?? 0);
		expect(scene.roads).toHaveLength(raw.roads?.length ?? 0);
		expect(scene.areas).toHaveLength(raw.areas?.length ?? 0);
		expect(scene.data).toHaveLength(raw.data?.length ?? 0);
		expect(scene.viewpoints).toHaveLength(raw.viewpoints?.length ?? 0);

		scene.roads.forEach((road, i) => {
			expect(ROAD_KIND_LABELS, `road ${road.id}`).toHaveProperty(road.kind);
			expect(road.points, `road ${road.id}`).toHaveLength(raw.roads?.[i].points.length ?? 0);
		});
		scene.areas.forEach((area, i) => {
			expect(AREA_KIND_LABELS, `area ${area.id}`).toHaveProperty(area.kind);
			expect(area.points, `area ${area.id}`).toHaveLength(raw.areas?.[i].points.length ?? 0);
		});
	});

	it.each(worlds)("%s keeps every object's part and props", (_, text) => {
		const raw = JSON.parse(text) as IRawWorld;
		const { scene } = readWorld(JSON.parse(text));

		scene.entities.forEach((entity, i) => {
			const part = getPart(entity.kind);
			expect(part, `object ${entity.id} (${raw.entities?.[i].kind})`).toBeDefined();
			if (!part) {
				return;
			}
			const resolved = resolveProps(part, entity.props) as Record<string, unknown>;
			const renamed: Readonly<Record<string, string>> = part.renamedProps ?? {};
			const rawProps = raw.entities?.[i].props ?? {};
			for (const [key, value] of Object.entries(rawProps)) {
				// Folded into the object's scale (ADR-0104): readWorld's own test checks the scale.
				if (part.foldedIntoScale?.includes(key)) {
					continue;
				}
				// Renamed: kept under the new name. A world holding the new name too keeps that one.
				const current = renamed[key] ?? key;
				if (current !== key && current in rawProps) {
					continue;
				}
				expect(entity.props[current], `object ${entity.id} keeps "${key}"`).toEqual(value);
				// Removed on purpose: the value stays in the world, unused.
				if (part.removedProps?.includes(key)) {
					continue;
				}
				expect(
					resolved,
					`${part.kind} no longer has the prop "${key}": if it was renamed, add it to the part's renamedProps; if it was removed on purpose, to removedProps`,
				).toHaveProperty(current);
				expect(resolved[current], `object ${entity.id}, prop "${key}"`).toEqual(value);
			}
		});
	});

	it.each(worlds)("%s keeps every object's colours", (_, text) => {
		const raw = JSON.parse(text) as IRawWorld;
		const { scene } = readWorld(JSON.parse(text));
		const palette = scenePalettes.light;

		scene.entities.forEach((entity, i) => {
			const part = getPart(entity.kind);
			const before = raw.entities?.[i];
			if (!part || !before) {
				return;
			}
			const colors = resolveColors(part, entity, palette);
			for (const spec of part.colors) {
				const stored =
					before.colors?.[spec.id]?.color ?? (spec.legacy ? before[spec.legacy] : null);
				if (stored) {
					expect(colors[spec.id], `object ${entity.id}, colour ${spec.id}`).toBe(stored);
				}
			}
		});
	});
});
