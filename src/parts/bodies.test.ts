import { describe, expect, it } from "vitest";

import { EntitySchema } from "#/scene/schema";

import { objectsInEachOther } from "./bodies";

const house = (id: string, position: [number, number], more: Record<string, unknown> = {}) =>
	EntitySchema.parse({ id, kind: "house_01", position, ...more });

describe("objects inside each other", () => {
	it("finds each pair once, in the world's order, however they're spread west to east", () => {
		const entities = [
			house("east", [10, 0]),
			house("west", [-10, 0]),
			house("east_too", [11, 0.5]),
			// A wide one reaching from the west to the middle.
			house("long", [-5, 0], { scale: 4 }),
		];
		expect(
			objectsInEachOther(entities).map(({ a, b, overlap }) => [a.id, b.id, overlap > 0.05]),
		).toEqual([
			["east", "east_too", true],
			["west", "long", true],
		]);
	});

	it("passes over ones side by side, and stops at the most asked for", () => {
		// Side by side, each 2.7 × 2.6: 2.8 apart along x, so they don't touch.
		expect(objectsInEachOther([house("a", [0, 0]), house("b", [2.8, 0])])).toEqual([]);
		const crowd = Array.from({ length: 50 }, (_, i) => house(`h${i}`, [0, 0]));
		expect(objectsInEachOther(crowd, undefined, 3)).toHaveLength(3);
	});
});
