import { describe, expect, it } from "vitest";

import { repairWorld } from "#/parts/repairWorld";

import { cellOf } from "./rowData";
import { MOST_DEPTH, safeJson, UnsafeJsonError } from "./safeJson";

describe("untrusted JSON (ADR-0119)", () => {
	it("loses __proto__ keys at every depth, and keeps real data called constructor", () => {
		const input = JSON.parse(
			'{"a": {"__proto__": {"polluted": true}, "constructor": "Ferrari"}, "__proto__": {"x": 1}}',
		);
		const safe = safeJson(input) as { a: Record<string, unknown> };
		expect(Object.hasOwn(safe, "__proto__")).toBe(false);
		expect(Object.hasOwn(safe.a, "__proto__")).toBe(false);
		expect(safe.a.constructor).toBe("Ferrari");
		expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
	});

	it("refuses nesting deeper than any world", () => {
		let deep: unknown = 1;
		for (let i = 0; i <= MOST_DEPTH + 1; i++) {
			deep = [deep];
		}
		expect(() => safeJson(deep)).toThrow(UnsafeJsonError);
	});

	it("keeps a world that tries to reach a prototype through its records harmless", () => {
		const { scene } = repairWorld(
			JSON.parse(
				'{"version": 1, "entities": [{"id": "a", "kind": "house_01", "position": [0, 0], "colors": {"__proto__": {"color": "#ff0000"}}}]}',
			),
		);
		const colors = scene.entities[0].colors as Record<string, unknown>;
		expect(Object.getPrototypeOf(colors)).toBe(Object.prototype);
		expect(colors.color).toBeUndefined();
	});

	it("reads a row's own cells only", () => {
		const row = { team: "Ferrari" };
		expect(cellOf(row, "team")).toBe("Ferrari");
		expect(cellOf(row, "constructor")).toBeUndefined();
		expect(cellOf(row, "toString")).toBeUndefined();
	});
});
