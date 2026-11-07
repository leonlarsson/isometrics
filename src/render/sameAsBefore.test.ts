import { describe, expect, it } from "vitest";

import type { IResolvedLight } from "#/parts/types";

import { forgetDrawnWith, sameAsBefore } from "./sameAsBefore";

const light = (fields: Partial<IResolvedLight> = {}): IResolvedLight => ({
	on: true,
	level: 1,
	color: "#ffd08a",
	reach: 1,
	litPaneShare: 0.6,
	paneWeight: 1,
	...fields,
});

const drawing = (lights: Record<string, IResolvedLight>, walls = "#d9a441") => ({
	colors: { walls, roof: "#4a4446" },
	transparency: { glass: 0 },
	lights,
});

describe("what a part is drawn with, kept while equal", () => {
	it("hands back the objects it was drawn with last while they're equal, so the part isn't drawn again", () => {
		const first = sameAsBefore("row", drawing({ windows: light() }));
		const again = sameAsBefore("row", drawing({ windows: light() }));
		expect(again.colors).toBe(first.colors);
		expect(again.transparency).toBe(first.transparency);
		expect(again.lights).toBe(first.lights);
		forgetDrawnWith("row");
	});

	it("takes what changed, and keeps the rest", () => {
		const first = sameAsBefore("row", drawing({ windows: light() }));
		const lit = sameAsBefore("row", drawing({ windows: light({ litPaneShare: 0.3 }) }));
		expect(lit.lights).not.toBe(first.lights);
		expect(lit.lights.windows.litPaneShare).toBe(0.3);
		expect(lit.colors).toBe(first.colors);
		const painted = sameAsBefore(
			"row",
			drawing({ windows: light({ litPaneShare: 0.3 }) }, "#b5533c"),
		);
		expect(painted.colors.walls).toBe("#b5533c");
		expect(painted.lights).toBe(lit.lights);
		// A light more or less is a change too.
		const more = sameAsBefore(
			"row",
			drawing({ windows: light({ litPaneShare: 0.3 }), shops: light() }),
		);
		expect(Object.keys(more.lights)).toEqual(["windows", "shops"]);
		forgetDrawnWith("row");
	});

	it("keeps each object's apart, and forgets an object that's gone", () => {
		const row = sameAsBefore("row", drawing({ windows: light() }));
		const other = sameAsBefore("other", drawing({ windows: light() }));
		expect(other.lights).not.toBe(row.lights);
		forgetDrawnWith("row");
		expect(sameAsBefore("row", drawing({ windows: light() })).lights).not.toBe(row.lights);
		forgetDrawnWith("row");
		forgetDrawnWith("other");
	});
});
