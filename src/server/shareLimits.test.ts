import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { compactWorld } from "#/parts/compactWorld";
import { repairWorld } from "#/parts/repairWorld";
import { TEMPLATES } from "#/templates";

import {
	MOST_LIST_LENGTH,
	MOST_SHARED_WORLD_BYTES,
	sizeInWords,
	tooLongIn,
	tooManyInPrefab,
	tooManyInWorld,
} from "./shareLimits";

const OLD_WORLDS = new URL("../scene/fixtures/old-worlds/", import.meta.url);

describe("what a share can hold (ADR-0145)", () => {
	it("leave every template and old world well inside the limits", () => {
		const worlds = [
			...TEMPLATES.map((template) => ({ name: template.id, world: template.create() as unknown })),
			...readdirSync(OLD_WORLDS).map((file) => ({
				name: file,
				world: JSON.parse(readFileSync(new URL(file, OLD_WORLDS), "utf8")) as unknown,
			})),
		];
		expect(worlds.length).toBeGreaterThan(10);
		for (const { name, world } of worlds) {
			expect(tooLongIn(world), name).toBeNull();
			expect(tooManyInWorld(world), name).toBeNull();
			const { scene } = repairWorld(world);
			const kept = JSON.stringify(compactWorld(scene));
			// Stockholm, the biggest, is about a third of what may be kept.
			expect(kept.length, name).toBeLessThan(MOST_SHARED_WORLD_BYTES / 2.5);
		}
	});

	it("find the first text or key over 2,000 characters, by its path", () => {
		expect(tooLongIn({ a: [{ b: "x".repeat(2000) }] })).toBeNull();
		expect(tooLongIn({ a: [{}, { b: "x".repeat(2001) }] })).toEqual({
			where: "a[1].b",
			what: "a text of 2,001 characters: at most 2,000 can be shared",
		});
		expect(tooLongIn({ a: { ["k".repeat(2001)]: 1 } })?.where).toBe("a");
		expect(tooLongIn("x".repeat(2001))?.where).toBe("(the whole thing)");
	});

	it("find a list longer than any a share needs", () => {
		expect(tooLongIn({ points: new Array(MOST_LIST_LENGTH).fill(0) })).toBeNull();
		expect(tooLongIn({ points: new Array(MOST_LIST_LENGTH + 1).fill(0) })?.what).toMatch(
			/a list of 20,001/,
		);
	});

	it("count a world's things, a patch's additions and a prefab's pieces", () => {
		expect(tooManyInWorld({ roads: new Array(1001).fill({}) })?.where).toBe("roads");
		expect(tooManyInWorld({ areas: { add: new Array(1001).fill({}) } })?.where).toBe("areas");
		expect(tooManyInWorld({ fences: new Array(1000).fill({}) })).toBeNull();
		expect(tooManyInWorld({ prefabs: [{}, { entities: new Array(2001).fill({}) }] })?.where).toBe(
			"prefabs[1].entities",
		);
		expect(
			tooManyInWorld({
				data: {
					tables: [{ rows: new Array(15_000).fill({}), history: [{ rows: new Array(5001) }] }],
				},
			})?.what,
		).toMatch(/20,001 rows in all/);
		expect(tooManyInPrefab({ fences: new Array(201).fill({}) })?.where).toBe("fences");
		expect(tooManyInWorld("not a world")).toBeNull();
	});

	it("say sizes in words", () => {
		expect(sizeInWords(1_500_000)).toBe("1.5 MB");
		expect(sizeInWords(518_958)).toBe("519 kB");
		expect(sizeInWords(300_000)).toBe("300 kB");
	});
});
