import { describe, expect, it } from "vitest";

import { readWorld } from "#/parts/readWorld";
import { PARTS } from "#/parts/registry";
import { createEmptyScene } from "#/templates";

import { aiPrompt, EXAMPLE_WORLD, MOST_DATA_CHARACTERS, worldFromAnswer } from "./aiPrompt";

const ORIGIN = "https://example.test";

describe("the prompt for your own AI", () => {
	it("teaches with an example world that opens with no repairs", () => {
		const { report } = readWorld(structuredClone(EXAMPLE_WORLD));
		expect(report).toBeNull();
	});

	it("says what they want in their words, with their data and every part kind", () => {
		const prompt = aiPrompt({
			description: "A harbour at dusk\nwith a lighthouse",
			data: "shop,sales\nNorth,12000",
			world: null,
			origin: ORIGIN,
		});
		expect(prompt).toContain("> A harbour at dusk\n> with a lighthouse");
		expect(prompt).toContain("North,12000");
		expect(prompt).toContain(`${ORIGIN}/schema.json`);
		for (const part of PARTS) {
			expect(prompt).toContain(`\`${part.kind}\``);
		}
		expect(prompt).not.toContain("## The world now");
	});

	it("asks for a plain world when there's no data, and carries the world to change", () => {
		expect(aiPrompt({ description: "", data: "", world: null, origin: ORIGIN })).toContain(
			'"isOn": false',
		);
		const world = createEmptyScene({ title: "Mine" });
		const changing = aiPrompt({ description: "More trees", data: "", world, origin: ORIGIN });
		expect(changing).toContain("## The world now");
		expect(changing).toContain('"title":"Mine"');
	});

	it("cuts data too long for a chat, saying so", () => {
		const prompt = aiPrompt({
			description: "",
			data: "x".repeat(MOST_DATA_CHARACTERS + 10),
			world: null,
			origin: ORIGIN,
		});
		expect(prompt).toContain("10 more characters weren't included");
	});
});

describe("reading what the AI answered", () => {
	it("finds the world in fences or among words", () => {
		expect(worldFromAnswer('Here it is:\n```json\n{"version": 1}\n```\nEnjoy!')).toEqual({
			version: 1,
		});
		expect(worldFromAnswer('Sure! {"version": 1, "meta": {"title": "A"}} Hope it helps')).toEqual({
			version: 1,
			meta: { title: "A" },
		});
	});

	it("says what's wrong when there's no world or it's cut off", () => {
		expect(() => worldFromAnswer("")).toThrow("Nothing pasted");
		expect(() => worldFromAnswer("I can't do that")).toThrow("no world");
		expect(() => worldFromAnswer('{"version": 1, "meta": {')).toThrow("cut off");
	});
});
