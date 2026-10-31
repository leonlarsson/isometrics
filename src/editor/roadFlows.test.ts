import { describe, expect, it } from "vitest";

import { SceneSchema, WorldDataSchema } from "#/scene/schema";

import { drawRoadsForEachRow } from "./dataRows";
import { flowDirection, flowOffsets, roadAsDrawn, valuesOfRoad } from "./roadFlows";

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
	it("draws a road for each row between the objects it names, its vehicles from the amount", () => {
		const draft = scene();
		draft.entities[1].name = "";
		const drawn = drawRoadsForEachRow(draft, {
			table: data.tables[0],
			fromColumn: "from",
			toColumn: "to",
			amountColumn: "players",
			kind: "road_01",
			mostVehicles: 8,
		});
		expect(drawn.ids).toHaveLength(2);
		expect(drawn.unmatched).toEqual(["x"]);
		const [first, second] = draft.roads.slice(-2);
		expect(first.name).toBe("Hunt → tarkov");
		expect(first.dataRow).toEqual({ tableKey: "overlap", rowKey: "a-b" });
		// From the edge of one to the edge of the other.
		expect(first.points[0][0]).toBeGreaterThan(-10);
		expect(first.points[1][0]).toBeLessThan(0);
		expect(roadAsDrawn(first, valuesOfRoad(first, data)).flow.vehicleCountAlong).toBe(8);
		expect(roadAsDrawn(second, valuesOfRoad(second, data)).flow.vehicleCountAlong).toBe(2);
	});

	it("spreads vehicles evenly, the other way half a gap apart, and points arrows the bigger way", () => {
		expect(flowOffsets(4, 20)).toEqual([0, 5, 10, 15]);
		expect(flowOffsets(2, 20, true)).toEqual([5, 15]);
		expect(flowDirection({ vehicleCountAlong: 1, vehicleCountAgainst: 3 })).toBe(-1);
		expect(flowDirection({ vehicleCountAlong: 2, vehicleCountAgainst: 2 })).toBe(0);
	});
});
