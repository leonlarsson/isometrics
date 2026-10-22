import { describe, expect, it } from "vitest";

import { sceneJsonSchema } from "./jsonSchema";

describe("sceneJsonSchema", () => {
	it("describes the scene document, with defaulted fields optional", () => {
		const schema = sceneJsonSchema();
		expect(schema.type).toBe("object");
		expect(schema.required).toEqual(["version"]);
		expect(Object.keys(schema.properties ?? {})).toEqual(
			expect.arrayContaining(["meta", "entities", "roads", "areas", "data"]),
		);
	});
});
