import { describe, expect, it } from "vitest";

import { SceneSchema } from "./schema";
import { applyWorldPatch, describePatchChanges, isWorldPatch, mergePatch } from "./worldPatch";

const world = SceneSchema.parse({
	version: 1,
	meta: { title: "Harbour" },
	entities: [
		{ id: "lighthouse", kind: "lighthouse_01", name: "Lighthouse", position: [0, 0] },
		{ id: "old_shed", kind: "house_01", name: "Old shed", position: [4, 0] },
	],
	data: { values: [{ key: "boats", name: "Boats", value: 3 }] },
});

describe("world patches", () => {
	it("are told apart from worlds by isPatch", () => {
		expect(isWorldPatch({ isPatch: true })).toBe(true);
		expect(isWorldPatch({ version: 1 })).toBe(false);
	});

	it("merge as JSON Merge Patch: fields change, groups merge, lists are replaced, null removes", () => {
		expect(
			mergePatch({ a: 1, b: { c: 2, d: 3 }, e: [1, 2] }, { a: null, b: { c: 5 }, e: [9] }),
		).toEqual({ b: { c: 5, d: 3 }, e: [9] });
	});

	it("remove, change and add things by id, and merge settings", () => {
		const {
			world: patched,
			issues,
			changes,
		} = applyWorldPatch(world, {
			isPatch: true,
			lighting: { time: 19.5 },
			entities: {
				remove: ["old_shed"],
				change: [{ id: "lighthouse", scale: 1.6 }],
				add: [{ id: "boat_2", kind: "sailing_boat_01", name: "Boat 2", position: [12, 8] }],
			},
			data: { values: { change: [{ key: "boats", value: 4 }] } },
		});
		expect(issues).toEqual([]);
		const entities = patched.entities as { id: string; scale?: number }[];
		expect(entities.map((entity) => entity.id)).toEqual(["lighthouse", "boat_2"]);
		expect(entities[0].scale).toBe(1.6);
		expect((patched.lighting as { time: number }).time).toBe(19.5);
		expect((patched.data as { values: { value: number }[] }).values[0].value).toBe(4);
		// What isn't in the patch stays as it was.
		expect((patched.meta as { title: string }).title).toBe("Harbour");
		expect(describePatchChanges(changes)).toBe(
			"Changes Lighthouse (scale); adds Boat 2; removes Old shed; changes Boats (value); changes lighting (time).",
		);
	});

	it("say what's wrong, by place in the patch, and apply the rest", () => {
		const { world: patched, issues } = applyWorldPatch(world, {
			isPatch: true,
			entities: {
				change: [
					{ id: "nope", scale: 2 },
					{ id: "lighthouse", scale: 2 },
				],
				add: [{ id: "lighthouse", kind: "house_01", position: [1, 1] }],
				remove: ["ghost"],
			},
			roads: [],
			weather: 3,
			spaceships: { count: 2 },
		});
		const said = issues.map((issue) => `${issue.where}: ${issue.what}`).join("\n");
		expect(said).toContain('entities.change[0]: there\'s nothing with id "nope" to change');
		expect(said).toContain('entities.add[0]: id "lighthouse" is already there');
		expect(said).toContain('entities.remove[0]: there\'s nothing with id "ghost" to remove');
		expect(said).toContain("roads: a list in a patch is");
		expect(said).toContain("weather: the changes to weather");
		expect(said).toContain("spaceships: isn't part of a world");
		expect((patched.entities as { scale?: number }[])[0].scale).toBe(2);
	});
});

describe("big patches", () => {
	it("apply in about the time it takes to read them, not quadratic", () => {
		const count = 20_000;
		const big = SceneSchema.parse({
			version: 1,
			entities: Array.from({ length: count }, (_, i) => ({
				id: `e${i}`,
				kind: "house_01",
				position: [0, 0],
			})),
		});
		const started = performance.now();
		const { issues } = applyWorldPatch(big, {
			isPatch: true,
			entities: {
				remove: Array.from({ length: count / 2 }, (_, i) => `e${i}`),
				change: Array.from({ length: count / 4 }, (_, i) => ({
					id: `e${count / 2 + i}`,
					scale: 2,
				})),
				add: Array.from({ length: count }, (_, i) => ({
					id: `n${i}`,
					kind: "house_01",
					position: [0, 0],
				})),
			},
		});
		expect(issues).toEqual([]);
		expect(performance.now() - started).toBeLessThan(2000);
	});

	it("refuse nesting deep enough to overflow, and never touch a prototype", () => {
		let deep: Record<string, unknown> = {};
		const root = deep;
		for (let i = 0; i < 200; i++) {
			deep.a = {};
			deep = deep.a as Record<string, unknown>;
		}
		expect(() => applyWorldPatch(world, { isPatch: true, meta: root })).toThrow("nested");
		const polluting = JSON.parse('{"isPatch": true, "meta": {"__proto__": {"polluted": true}}}');
		const { world: patched } = applyWorldPatch(world, polluting);
		expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
		expect((patched.meta as { polluted?: boolean }).polluted).toBeUndefined();
	});
});
