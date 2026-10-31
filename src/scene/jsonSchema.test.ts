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

	it("describes every field, and requires only the fields listed here (ADR-0056)", () => {
		// Required = no default: a world saved before such a field existed couldn't be read.
		// Only identities and contents belong here; anything new gets a default instead.
		const allowedRequired = [
			"version",
			"entities.id",
			"entities.kind",
			"entities.follow.roadId",
			"entities.dataRow.tableKey",
			"entities.dataRow.rowKey",
			"roads.id",
			"roads.points",
			"roads.dataRow.tableKey",
			"roads.dataRow.rowKey",
			"areas.id",
			"areas.points",
			"fences.id",
			"fences.points",
			"data.sources.id",
			"data.sources.kind",
			"data.tables.columns.key",
			"data.tables.key",
			"data.tables.source.sourceId",
			"data.values.history.at",
			"data.values.history.value",
			"data.values.key",
			"data.values.source.sourceId",
			"data.values.value",
			"data.values.threshold.line",
			"data.tables.columns.threshold.line",
			"data.tables.history.at",
			"data.tables.history.rows",
			"viewpoints.id",
			"moods.id",
		];
		const required: string[] = [];
		const undescribed: string[] = [];
		const walk = (node: unknown, path: string) => {
			if (typeof node !== "object" || node === null) {
				return;
			}
			const schema = node as {
				properties?: Record<string, { description?: string }>;
				required?: string[];
				items?: unknown;
				anyOf?: unknown[];
			};
			for (const [key, child] of Object.entries(schema.properties ?? {})) {
				const field = path ? `${path}.${key}` : key;
				if (schema.required?.includes(key)) {
					required.push(field);
				}
				if (!child.description) {
					undescribed.push(field);
				}
				walk(child, field);
			}
			walk(schema.items, path);
			for (const option of schema.anyOf ?? []) {
				walk(option, path);
			}
		};
		walk(sceneJsonSchema(), "");
		expect(undescribed, "fields without a .describe()").toEqual([]);
		expect(required.sort(), "required fields (add a default instead)").toEqual(
			allowedRequired.sort(),
		);
	});
});
