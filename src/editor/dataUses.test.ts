import { describe, expect, it } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { dataUsesOf } from "./dataUses";

const scene = SceneSchema.parse({
	version: 1,
	data: { values: [{ key: "stock", value: 40 }] },
	entities: [
		{
			id: "depot",
			kind: "warehouse_01",
			name: "Depot",
			label: { title: "Depot", dataKeys: ["stock"] },
			colors: { walls: { data: { color: { key: "stock" } } } },
		},
		{
			id: "lamp",
			kind: "street_lamp_01",
			lights: { lamp: { data: { on: { key: "stock" }, strength: { key: "other" } } } },
		},
		{ id: "shed", kind: "warehouse_01" },
	],
	weather: { data: { rainAmount: { key: "stock" } } },
});

describe("dataUsesOf (data study)", () => {
	it("finds every card, light, colour and world setting that follows a value, and where to go", () => {
		expect(dataUsesOf(scene, "stock")).toEqual([
			{ thing: "Depot", setting: "card", item: { kind: "entity", id: "depot" }, tab: "label" },
			{
				thing: "Depot",
				setting: "colour Walls",
				item: { kind: "entity", id: "depot" },
				tab: "look",
			},
			{
				thing: "Street lamp 1",
				setting: "light Lamp: on and off",
				item: { kind: "entity", id: "lamp" },
				tab: "lights",
			},
			{ thing: "Weather", setting: "rain", item: null, tab: "weather" },
		]);
	});

	it("finds nothing for a value nothing follows", () => {
		expect(dataUsesOf(scene, "unused")).toEqual([]);
	});
});
