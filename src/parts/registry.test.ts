import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PARTS, resolveProps, type TAnyPart } from "./registry";
import { definePart, LIGHT_SHAPES_WITH_REACH } from "./types";

/**
 * Guards for adding or changing a part prop (ADR-0056): worlds saved before a
 * prop existed have no value for it, so every prop needs a default, and every
 * inspector field must point at a prop whose default it can show.
 */
describe("every part", () => {
	it.each(PARTS.map((part) => [part.kind, part] as const))(
		"%s has a default for every prop",
		(_, part) => {
			expect(() => part.schema.parse({})).not.toThrow();
		},
	);

	it.each(PARTS.map((part) => [part.kind, part] as const))(
		"%s's inspector fields name props with defaults the fields can show",
		(_, part) => {
			const defaults = part.schema.parse({}) as Record<string, unknown>;
			for (const field of part.fields) {
				expect(defaults, `field "${field.key}"`).toHaveProperty(field.key);
				const value = defaults[field.key];
				if (field.type === "number") {
					expect(value, `field "${field.key}"`).toBeGreaterThanOrEqual(field.min);
					expect(value, `field "${field.key}"`).toBeLessThanOrEqual(field.max);
				} else if (field.type === "select") {
					expect(
						field.options.map((option) => option.value),
						`field "${field.key}"`,
					).toContain(value);
				} else if (field.type === "boolean") {
					expect(typeof value, `field "${field.key}"`).toBe("boolean");
				} else {
					expect(typeof value, `field "${field.key}"`).toBe("string");
				}
			}
		},
	);

	it.each(PARTS.map((part) => [part.kind, part] as const))(
		"%s's renamed props point at current props, and renamed or removed ones aren't current",
		(_, part) => {
			const defaults = part.schema.parse({}) as Record<string, unknown>;
			for (const [from, to] of Object.entries(part.renamedProps ?? {})) {
				expect(defaults, `renamed "${from}"`).toHaveProperty(to);
				expect(defaults, `renamed "${from}"`).not.toHaveProperty(from);
			}
			for (const removed of part.removedProps ?? []) {
				expect(defaults, `removed "${removed}"`).not.toHaveProperty(removed);
			}
		},
	);
});

describe("every part's lights (ADR-0058)", () => {
	it.each(PARTS.filter((part) => part.lights).map((part) => [part.kind, part] as const))(
		"%s's lights have unique ids, names, known shapes and a reach where they light the ground",
		(_, part) => {
			const lights = part.lights ?? [];
			expect(new Set(lights.map((light) => light.id)).size).toBe(lights.length);
			for (const light of lights) {
				expect(light.id, `light ${light.id}`).toMatch(/^[a-z][a-zA-Z0-9]*$/);
				expect(light.name.length, `light ${light.id}`).toBeGreaterThan(0);
				expect(["lens", "beam", "pool", "windows", "glow"]).toContain(light.shape);
				if (LIGHT_SHAPES_WITH_REACH.includes(light.shape)) {
					expect(light.reach, `light ${light.id}`).toBeGreaterThan(0);
				}
			}
			for (const [from, to] of Object.entries(part.renamedLights ?? {})) {
				expect(
					lights.map((light) => light.id),
					`renamed light ${from}`,
				).toContain(to);
				expect(
					lights.map((light) => light.id),
					`renamed light ${from}`,
				).not.toContain(from);
			}
		},
	);
});

describe("every part's colours (ADR-0060)", () => {
	it.each(PARTS.map((part) => [part.kind, part] as const))(
		"%s has at least one colour, with unique ids and names, and older worlds' color and accent each read by one",
		(_, part) => {
			const ids = part.colors.map((color) => color.id);
			expect(ids.length).toBeGreaterThan(0);
			expect(new Set(ids).size).toBe(ids.length);
			for (const color of part.colors) {
				expect(color.id, `colour ${color.id}`).toMatch(/^[a-z][a-zA-Z0-9]*$/);
				expect(color.name.length, `colour ${color.id}`).toBeGreaterThan(0);
			}
			// Older worlds (and AIs writing the old form) put a colour in color, a second in accent.
			const legacy = part.colors.map((color) => color.legacy);
			expect(legacy.filter((field) => field === "color")).toHaveLength(1);
			expect(legacy.filter((field) => field === "accent")).toHaveLength(
				part.colors.length > 1 ? 1 : 0,
			);
		},
	);
});

/** A stand-in part with a few kinds of props, one of them renamed. */
const tower = definePart({
	kind: "test_tower_01",
	name: "Test tower",
	category: "buildings",
	description: "A part for tests",
	schema: z.object({
		floors: z.number().int().min(1).max(40).default(6),
		roof: z.enum(["flat", "pointed"]).default("flat"),
		balconies: z.boolean().default(false),
	}),
	renamedProps: { storeys: "floors" },
	fields: [],
	colors: [{ id: "walls", name: "Walls", default: "#ffffff", legacy: "color" }],
	footprint: () => [1, 1],
	height: () => 1,
	Component: () => null,
}) as TAnyPart;

describe("resolveProps", () => {
	it("gives a missing prop its default, as for a world saved before the prop existed", () => {
		expect(resolveProps(tower, { floors: 12, roof: "pointed" })).toEqual({
			floors: 12,
			roof: "pointed",
			balconies: false,
		});
	});

	it("resets only an invalid prop and keeps the rest", () => {
		expect(resolveProps(tower, { floors: 999, roof: "pointed", balconies: true })).toEqual({
			floors: 6,
			roof: "pointed",
			balconies: true,
		});
	});

	it("leaves out props the part doesn't know", () => {
		expect(resolveProps(tower, { floors: 3, chimney: true })).toEqual({
			floors: 3,
			roof: "flat",
			balconies: false,
		});
	});

	it("reads a renamed prop under its new name, unless the new name is set too", () => {
		expect(resolveProps(tower, { storeys: 9 })).toMatchObject({ floors: 9 });
		expect(resolveProps(tower, { storeys: 9, floors: 4 })).toMatchObject({ floors: 4 });
	});
});
