import { describe, expect, it } from "vitest";

import { getPart, PARTS } from "#/parts/registry";

import {
	LEGACY_AREA_TYPES,
	LEGACY_PART_KINDS,
	LEGACY_ROAD_STYLES,
	upgradeLegacyIds,
} from "./legacy";
import { parseScene } from "./migrate";
import { parseOrRepairScene } from "./repair";
import { AreaTypeSchema, RoadStyleSchema } from "./schema";

const oldWorld = () => ({
	version: 1,
	entities: [
		{ id: "e1", kind: "tower", position: [0, 0] },
		{ id: "e2", kind: "van", position: [4, 0] },
		{ id: "e3", kind: "house_01", position: [8, 0] },
	],
	roads: [
		{
			id: "r1",
			style: "hidden",
			points: [
				[0, 0],
				[5, 0],
			],
		},
	],
	areas: [
		{
			id: "a1",
			type: "water",
			points: [
				[0, 0],
				[4, 0],
				[4, 4],
			],
		},
	],
});

/** Every id in use, per kind of thing, with its table of old ids. */
const CURRENT = [
	{ what: "part kind", ids: PARTS.map((part) => part.kind), legacy: LEGACY_PART_KINDS },
	{ what: "road style", ids: RoadStyleSchema.options, legacy: LEGACY_ROAD_STYLES },
	{ what: "area type", ids: AreaTypeSchema.options, legacy: LEGACY_AREA_TYPES },
];

describe("current ids", () => {
	it("are snake_case with a two-digit variant number (ADR-0050)", () => {
		for (const { what, ids } of CURRENT) {
			for (const id of ids) {
				expect(id, `${what} ${id}`).toMatch(/^[a-z]+(?:_[a-z]+)*_\d{2}$/);
			}
		}
	});

	it("are never an old id, so an old world can't be upgraded into the wrong thing", () => {
		for (const { what, ids, legacy } of CURRENT) {
			for (const id of ids) {
				expect(Object.hasOwn(legacy, id), `${what} ${id} is also an old id`).toBe(false);
			}
		}
	});
});

describe("legacy ids", () => {
	it("map to ids that exist", () => {
		for (const kind of Object.values(LEGACY_PART_KINDS)) {
			expect(getPart(kind), kind).toBeDefined();
		}
		for (const style of Object.values(LEGACY_ROAD_STYLES)) {
			expect(RoadStyleSchema.safeParse(style).success, style).toBe(true);
		}
		for (const type of Object.values(LEGACY_AREA_TYPES)) {
			expect(AreaTypeSchema.safeParse(type).success, type).toBe(true);
		}
	});

	it("are upgraded when a world is parsed, without repairs", () => {
		const { scene, report } = parseOrRepairScene(oldWorld());
		expect(report).toBeNull();
		expect(scene.entities.map((entity) => entity.kind)).toEqual([
			"office_tower_01",
			"delivery_van_01",
			"house_01",
		]);
		expect(scene.roads[0].style).toBe("hidden_route_01");
		expect(scene.areas[0].type).toBe("water_01");
	});

	it("are upgraded in a world that needs repairing for another reason", () => {
		const world = { ...oldWorld(), driving: "sideways" };
		const { scene, report } = parseOrRepairScene(world);
		expect(report?.fixed).toBe(1);
		expect(scene.entities[0].kind).toBe("office_tower_01");
		expect(scene.roads[0].style).toBe("hidden_route_01");
		expect(scene.areas[0].type).toBe("water_01");
	});

	it("leave the input untouched, so it can be kept as a backup", () => {
		const world = oldWorld();
		const before = structuredClone(world);
		parseScene(world);
		expect(world).toEqual(before);
	});

	it("leave a world without old ids as it is", () => {
		const world = { version: 1, entities: [{ id: "e1", kind: "house_01" }] };
		expect(upgradeLegacyIds(world)).toBe(world);
	});

	it("don't treat inherited object keys as old ids", () => {
		const world = { version: 1, entities: [{ id: "e1", kind: "toString" }] };
		expect(upgradeLegacyIds(world)).toBe(world);
	});
});
