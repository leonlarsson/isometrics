import { describe, expect, it } from "vitest";

import { worldJsonSchema } from "./jsonSchema";
import { PARTS } from "./registry";

interface IEntitySchema {
	properties: { kind: { oneOf: { const: string; description: string }[] } };
	allOf: {
		if: { properties: { kind: { const: string } } };
		then: { properties: { props: { properties: Record<string, { description?: string }> } } };
	}[];
}

const entitySchema = () =>
	(worldJsonSchema().properties as { entities: { items: IEntitySchema } }).entities.items;

describe("worldJsonSchema", () => {
	it("lists every part kind with a description", () => {
		const kinds = entitySchema().properties.kind.oneOf;
		expect(kinds.map((k) => k.const)).toEqual(PARTS.map((part) => part.kind));
		const van = kinds.find((k) => k.const === "delivery_van_01");
		expect(van?.description).toMatch(/Delivery van/);
		expect(van?.description).toMatch(/drive along a road/);
	});

	it("describes each kind's props, labelled like the inspector", () => {
		const tower = entitySchema().allOf.find(
			(rule) => rule.if.properties.kind.const === "office_tower_01",
		);
		expect(tower?.then.properties.props.properties.floors?.description).toBe("Floors");
	});

	it("explains the format", () => {
		expect(worldJsonSchema().description).toMatch(/counter-clockwise/);
	});

	it("describes the scene's fields", () => {
		const schema = worldJsonSchema() as unknown as {
			properties: {
				roads: { items: { properties: { points: { description?: string } } } };
				entities: { items: { properties: { rotation: { description?: string } } } };
			};
		};
		expect(schema.properties.entities.items.properties.rotation.description).toMatch(
			/counter-clockwise/,
		);
		expect(schema.properties.roads.items.properties.points.description).toMatch(/drawing order/);
	});

	it("lists each kind's lights with their ids and defaults, and shows how to set and bind them", () => {
		const schema = worldJsonSchema() as {
			description: string;
			properties: Record<string, unknown>;
		};
		const text = JSON.stringify(schema);
		expect(text).toContain(
			"headlights (Headlights, beam, colour the theme's lamplight, strength 1, reach 2.4, on after dark only while driving, comes on at once)",
		);
		expect(text).toContain(
			"lamp (Lamp, pool, colour #ffe8a3, strength 1, reach 2.3, on after dark, comes on at once)",
		);
		expect(schema.description).toContain('"data": { "on": { "key": "alert" }');
		expect(schema.description).toContain("key is the key of an entry in the world's data");
	});

	it("lists each kind's colours with their ids and defaults, and shows how to set and bind them", () => {
		const schema = worldJsonSchema() as { description: string };
		const text = JSON.stringify(schema);
		expect(text).toContain(
			"Colours (settings in colors, by id): roof (Roof, default #f07b4f); door (Door, default #6b4a3a)",
		);
		expect(schema.description).toContain('"colors": { "roof": { "color": "#c0392b" } }');
		expect(schema.description).toContain('"lowColor": "#2bb58c"');
	});
});
