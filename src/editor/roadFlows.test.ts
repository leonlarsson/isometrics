import { describe, expect, it } from "vitest";

import { SceneSchema, WorldDataSchema } from "#/scene/schema";

import { drawRoadsForEachRow } from "./dataRows";
import {
	flowDirection,
	flowOffsets,
	roadAsDrawn,
	valuesOfRoad,
	vehiclesOnStream,
} from "./roadFlows";

const data = WorldDataSchema.parse({
	tables: [
		{
			key: "overlap",
			keyColumn: "pair",
			columns: [{ key: "pair" }, { key: "from" }, { key: "to" }, { key: "players" }],
			rows: [
				{ pair: "a-b", from: "Hunt", to: "Tarkov", players: 400 },
				{ pair: "b-c", from: "Tarkov", to: "Marathon", players: 100 },
				{ pair: "x", from: "Hunt", to: "Nowhere", players: 5 },
			],
		},
	],
});

const scene = () =>
	SceneSchema.parse({
		version: 1,
		data,
		entities: [
			{ id: "h", kind: "house_01", name: "Hunt", position: [-10, 0] },
			{ id: "t", kind: "house_01", name: "Escape from Tarkov", label: { title: "tarkov" } },
			{ id: "m", kind: "house_01", name: "marathon", position: [10, 0] },
		],
	});

describe("roads that show flows (ADR-0112)", () => {
	it("draws a road for each row between the objects it names, its width from the amount", () => {
		const draft = scene();
		draft.entities[1].name = "";
		const drawn = drawRoadsForEachRow(draft, {
			table: data.tables[0],
			fromColumn: "from",
			toColumn: "to",
			amountColumn: "players",
			kind: "road_01",
			widest: 4,
		});
		expect(drawn.ids).toHaveLength(2);
		expect(drawn.unmatched).toEqual(["x"]);
		const [first, second] = draft.roads.slice(-2);
		expect(first.name).toBe("Hunt → tarkov");
		expect(first.dataRow).toEqual({ tableKey: "overlap", rowKey: "a-b" });
		// From the edge of one to the edge of the other.
		expect(first.points[0][0]).toBeGreaterThan(-10);
		expect(first.points[1][0]).toBeLessThan(0);
		// Its width shows the amount: 400 of 400 is the widest, 100 a quarter of the way up
		expect(roadAsDrawn(first, valuesOfRoad(first, data)).width).toBe(4);
		// (0.6 + 0.25 × 3.4 = 1.45, to the width field's step of 0.1)
		expect(roadAsDrawn(second, valuesOfRoad(second, data)).width).toBeCloseTo(1.4, 5);
	});

	it("puts as many vehicles on a road as its density says for its length, never more than fit", () => {
		// 2 per 10 units on a 25-unit road: 5; 1-unit vehicles fit 15.
		expect(vehiclesOnStream({ vehicleDensity: 2 }, 3, 25, 1)).toBe(5);
		// No density: the count as set.
		expect(vehiclesOnStream({ vehicleDensity: null }, 3, 25, 1)).toBe(3);
		// A short road holds no more than fit a vehicle and a half apart.
		expect(vehiclesOnStream({ vehicleDensity: 6 }, 3, 6, 1.2)).toBe(3);
		// No vehicles that way, none from density either.
		expect(vehiclesOnStream({ vehicleDensity: 2 }, 0, 25, 1)).toBe(0);
	});

	it("spreads vehicles evenly, the other way half a gap apart, and points arrows the bigger way", () => {
		expect(flowOffsets(4, 20)).toEqual([0, 5, 10, 15]);
		expect(flowOffsets(2, 20, true)).toEqual([5, 15]);
		expect(flowDirection({ vehicleCountAlong: 1, vehicleCountAgainst: 3 })).toBe(-1);
		expect(flowDirection({ vehicleCountAlong: 2, vehicleCountAgainst: 2 })).toBe(0);
	});
});
