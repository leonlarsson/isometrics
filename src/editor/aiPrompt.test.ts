import { describe, expect, it } from "vitest";

import { worldPatchJsonSchema } from "#/parts/jsonSchema";
import { PARTS } from "#/parts/registry";
import { repairWorld } from "#/parts/repairWorld";
import { validatePatch } from "#/parts/validateWorld";
import { SceneSchema } from "#/scene/schema";
import { createEmptyScene } from "#/templates";

import {
	aiPrompt,
	EXAMPLE_PATCH,
	EXAMPLE_WORLD,
	MOST_DATA_CHARACTERS,
	worldFromAnswer,
} from "./aiPrompt";

const ORIGIN = "https://example.test";

describe("the prompt for your own AI", () => {
	it("teaches with an example world that opens with no repairs", () => {
		const { report } = repairWorld(structuredClone(EXAMPLE_WORLD));
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
		expect(prompt).toContain(`${ORIGIN}/api/worlds/schema`);
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
		// A change answers with a patch (ADR-0118).
		expect(changing).toContain('"isPatch": true');
		expect(changing).toContain("Never send a whole list");
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

describe("the example patch (ADR-0118)", () => {
	it("applies cleanly to a world with the ids it names", () => {
		const world = SceneSchema.parse({
			version: 1,
			entities: [
				{ id: "lighthouse", kind: "lighthouse_01", position: [0, 0] },
				{ id: "old_shed", kind: "house_01", position: [4, 0] },
			],
			data: { values: [{ key: "boats", value: 3 }] },
		});
		const check = validatePatch(world, structuredClone(EXAMPLE_PATCH));
		expect(check.problems).toEqual([]);
		expect(check.warnings).toEqual([]);
	});

	it("uses only fields the patch format has", () => {
		const fields = Object.keys(worldPatchJsonSchema().properties);
		for (const key of Object.keys(EXAMPLE_PATCH)) {
			expect(fields).toContain(key);
		}
	});
});

describe("handing a world over as a link (ADR-0120)", () => {
	it("puts the link in the prompt instead of the world, and offers answering with a link", () => {
		const world = createEmptyScene({ title: "Mine" });
		const prompt = aiPrompt({
			description: "More trees",
			data: "",
			world,
			origin: ORIGIN,
			worldUrl: `${ORIGIN}/api/user-worlds/abcdefghijklmnopqrstuv`,
		});
		expect(prompt).toContain(`It's at ${ORIGIN}/api/user-worlds/abcdefghijklmnopqrstuv`);
		expect(prompt).not.toContain('"title":"Mine"');
		expect(prompt).toContain(
			`POST it (the world or the patch, as JSON) to ${ORIGIN}/api/user-worlds`,
		);
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
