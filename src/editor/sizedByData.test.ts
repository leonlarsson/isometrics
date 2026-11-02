import { describe, expect, it } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { isSizedByData, selectedSizedByData } from "./sizedByData";

describe("objects sized by data", () => {
	const scene = SceneSchema.parse({
		version: 1,
		entities: [
			{ id: "a", kind: "house_01", data: { scale: { key: "row.sales" } } },
			{ id: "b", kind: "house_01" },
		],
	});

	it("are those whose size follows data, while the world's data is on", () => {
		expect(isSizedByData(scene.entities[0], scene)).toBe(true);
		expect(isSizedByData(scene.entities[1], scene)).toBe(false);
		const off = { ...scene, data: { ...scene.data, isOn: false } };
		expect(isSizedByData(scene.entities[0], off)).toBe(false);
	});

	it("are picked out of a selection", () => {
		const items = [
			{ kind: "entity" as const, id: "a" },
			{ kind: "entity" as const, id: "b" },
		];
		expect(selectedSizedByData({ scene, selectedItems: items }).map((entity) => entity.id)).toEqual(
			["a"],
		);
	});
});
