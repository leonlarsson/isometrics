import { describe, expect, it } from "vitest";
import { z } from "zod";

import { PARTS, resolveProps, type TAnyPart } from "./registry";
import { definePart } from "./types";

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
				} else if (field.type === "color") {
					// Null until set: it shows the field's default colour (ADR-0027).
					expect(value, `field "${field.key}"`).toBeNull();
					expect(field.default, `field "${field.key}"`).toMatch(/^#[0-9a-fA-F]{6}$/);
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
	defaultColor: "#ffffff",
	defaultAccent: "#000000",
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
