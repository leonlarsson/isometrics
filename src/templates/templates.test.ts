import { describe, expect, it } from "vitest";

import { getPart } from "#/parts/registry";

import { createEmptyScene, TEMPLATES } from "./index";

const templates = [
	...TEMPLATES.map((template) => [template.id, template.create] as const),
	["empty", createEmptyScene] as const,
];

describe("templates", () => {
	// A prop the part doesn't know is kept but never drawn: a renamed prop set under its old name,
	// or another part's prop (an oak given a sign's letterHeight).
	it.each(templates)("%s sets only props its parts know", (_, create) => {
		for (const entity of create().entities) {
			const part = getPart(entity.kind);
			expect(part, entity.id).toBeDefined();
			const known = Object.keys(part?.schema.parse({}) ?? {});
			for (const key of Object.keys(entity.props)) {
				expect(known, `${entity.id} (${entity.kind})`).toContain(key);
			}
		}
	});
});
