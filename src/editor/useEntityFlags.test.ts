import { describe, expect, it } from "vitest";

import type { ISceneItem } from "./framing";
import { ALONE, BOXED, concernedBy, flagsOf, LIST_HOVERED, SELECTED } from "./useEntityFlags";

const entity = (id: string): ISceneItem => ({ kind: "entity", id });

const state = ({
	selected = [] as string[],
	boxed = null as string[] | null,
	hovered = null as ISceneItem | null,
} = {}) => ({
	selectedItems: selected.map(entity),
	selectedId: selected[0] ?? null,
	boxDrag: boxed ? ({ items: boxed.map(entity) } as never) : null,
	hovered,
});

describe("an object's flags (useEntityFlags)", () => {
	it("says whether it's selected, alone, boxed or hovered in a list", () => {
		const one = state({ selected: ["a"], hovered: entity("b") });
		expect(flagsOf(one, "a")).toBe(SELECTED | ALONE);
		expect(flagsOf(one, "b")).toBe(LIST_HOVERED);
		expect(flagsOf(one, "c")).toBe(0);
		const two = state({ selected: ["a", "b"], boxed: ["c"] });
		expect(flagsOf(two, "a")).toBe(SELECTED);
		expect(flagsOf(two, "c")).toBe(BOXED);
		// A road selected or hovered isn't an object's.
		expect(flagsOf(state({ hovered: { kind: "road", id: "a" } }), "a")).toBe(0);
	});

	it("tells only the objects a change concerns: what was and is selected, boxed or hovered", () => {
		const clicked = concernedBy(state({ selected: ["a"] }), state({ selected: ["b"] }));
		expect([...clicked].sort()).toEqual(["a", "b"]);
		const added = concernedBy(state({ selected: ["a"] }), state({ selected: ["a", "c"] }));
		// The first is no longer alone.
		expect([...added].sort()).toEqual(["a", "c"]);
		const boxing = concernedBy(state(), state({ boxed: ["d", "e"], hovered: entity("f") }));
		expect([...boxing].sort()).toEqual(["d", "e", "f"]);
		expect([...concernedBy(null, state({ selected: ["a"] }))]).toEqual(["a"]);
	});
});
