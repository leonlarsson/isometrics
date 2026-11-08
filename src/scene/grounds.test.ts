import { describe, expect, it } from "vitest";

import { topsToStandOn } from "#/parts/standing";

import { GROUND_SHAPES } from "./groundShape";
import {
	areaBaseOf,
	groundAltitudeAt,
	groundAt,
	groundHeightAt,
	isOnLand,
	keepOnLand,
	newGroundPosition,
	thingsOnGround,
	worldExtentOf,
} from "./grounds";
import { upgradeLegacyIds } from "./legacy";
import { SceneSchema, type TSceneInput } from "./schema";
import { standingAltitudeOn } from "./standing";

const world = (input: Partial<TSceneInput> = {}) => SceneSchema.parse({ version: 1, ...input });

/** A world of a base ground and an island floating over its east side. */
const islands = () =>
	world({
		grounds: [
			{ id: "base", width: 40, depth: 30 },
			{ id: "isle", width: 10, depth: 10, position: [14, 0], altitude: 6, thickness: 3 },
			{ id: "far", width: 20, depth: 20, position: [60, 0] },
		],
	});

describe("a world's grounds (ADR-0155)", () => {
	it("has one ground in a world saved before there were several, as it was", () => {
		const upgraded = SceneSchema.parse(
			upgradeLegacyIds({ version: 1, ground: { width: 60, depth: 24, color: "#abcdef" } }),
		);
		expect(upgraded.grounds).toHaveLength(1);
		expect(upgraded.grounds[0]).toMatchObject({
			id: "ground",
			width: 60,
			depth: 24,
			position: [0, 0],
			altitude: 0,
			thickness: 1,
			colors: { surface: { color: "#abcdef" } },
		});
		expect(upgraded.keepsThingsOnGround).toBe(true);
	});

	it("measures the world as the rectangle round every ground, centred on 0, 0", () => {
		expect(worldExtentOf(world().grounds)).toEqual({ width: 40, depth: 30 });
		// The far ground reaches 70 east: the world is 140 wide, 30 deep.
		expect(worldExtentOf(islands().grounds)).toEqual({ width: 140, depth: 30 });
	});

	it("says which ground a point is on: the island over the base, the base under it for what stands low", () => {
		const { grounds } = islands();
		expect(groundAt(grounds, [14, 0])?.id).toBe("isle");
		expect(groundAltitudeAt(grounds, [14, 0])).toBe(6);
		// Something standing on the base ground under the island is the base's.
		expect(groundAt(grounds, [14, 0], 0)?.id).toBe("base");
		expect(groundAt(grounds, [-10, 0])?.id).toBe("base");
		expect(groundAt(grounds, [40, 0])).toBeNull();
		expect(groundAltitudeAt(grounds, [40, 0])).toBe(0);
	});

	it("keeps things on land, across the gap to the nearest ground's edge, unless the world lets them go anywhere", () => {
		const scene = islands();
		expect(isOnLand(scene, [60, 5])).toBe(true);
		expect(isOnLand(scene, [40, 0])).toBe(false);
		const kept = keepOnLand(scene, [44, 0]);
		expect(isOnLand(scene, kept)).toBe(true);
		expect(kept[0]).toBeCloseTo(50, 1);
		const free = { ...scene, keepsThingsOnGround: false };
		expect(keepOnLand(free, [44, 0])).toEqual([44, 0]);
		expect(isOnLand(free, [44, 0])).toBe(true);
	});

	it("keeps things on a shape, an L's cut-out corner included", () => {
		const lShape = world({
			grounds: [
				{
					id: "l",
					width: 40,
					depth: 30,
					...GROUND_SHAPES.find((s) => s.id === "lShape")?.make(40, 30),
				},
			],
		});
		expect(isOnLand(lShape, [0, 0])).toBe(false);
		expect(isOnLand(lShape, keepOnLand(lShape, [5, -5]))).toBe(true);
	});

	it("stands things on an island's top, and areas on the ground under them", () => {
		const scene = islands();
		const tops = topsToStandOn(scene);
		expect(standingAltitudeOn(tops, [14, 0])).toBe(6);
		expect(standingAltitudeOn(tops, [-10, 0])).toBe(0);
		const plateau = {
			id: "rock",
			kind: "raised_land_01" as const,
			points: [
				[12, -2],
				[16, -2],
				[16, 2],
				[12, 2],
			] as [number, number][],
			height: 2,
		};
		const withRock = world({ ...scene, areas: [plateau] });
		expect(areaBaseOf(withRock.areas[0], withRock.grounds)).toBe(6);
		expect(groundHeightAt(withRock, [14, 0])).toBe(8);
	});

	it("knows what stands on a ground: what's on the island moves with it, a bridge's far end stays", () => {
		const scene = world({
			...islands(),
			entities: [
				{ id: "on_isle", kind: "house_01", position: [14, 0], altitude: 6 },
				{ id: "under_isle", kind: "house_01", position: [14, 2], altitude: 0 },
				{ id: "on_base", kind: "house_01", position: [-10, 0] },
			],
			roads: [
				{
					id: "bridge",
					points: [
						[14, 3, 6],
						[30, 3, 6],
						[55, 3, 0],
					],
				},
			],
		});
		const on = thingsOnGround(scene, "isle");
		expect(on.entityIds).toEqual(["on_isle"]);
		expect(on.roadPoints).toEqual([{ roadId: "bridge", index: 0 }]);
		expect(on.wholeRoadIds).toEqual([]);
		expect(thingsOnGround(scene, "base").entityIds).toEqual(["under_isle", "on_base"]);
	});

	it("puts a new ground beside the others", () => {
		expect(newGroundPosition(world().grounds, 30, 30)).toEqual([41, 0]);
	});
});
