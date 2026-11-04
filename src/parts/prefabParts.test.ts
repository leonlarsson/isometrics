import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { prefabBindingMapsOf, worldBindingMapsOf } from "#/scene/dataBindings";
import { parseOrRepairScene } from "#/scene/repair";
import { PREFAB_KIND_PREFIX, PrefabSchema, SceneSchema, type TSceneInput } from "#/scene/schema";
import { applyWorldPatch } from "#/scene/worldPatch";

import {
	describePrefab,
	measurePrefab,
	partIn,
	prefabName,
	prefabPartOf,
	setWorldPrefabs,
} from "./prefabParts";
import { getBasePart, getPart, PARTS, resolveProps } from "./registry";
import { repairWorld } from "./repairWorld";
import { validateWorld } from "./validateWorld";

/** A small design: two boxes side by side and a short fence in front, centred on the origin. */
const yard = PrefabSchema.parse({
	id: "prefab_yard",
	name: "Yard",
	entities: [
		{ id: "left", kind: "box_01", position: [-1, 0], props: { width: 2, depth: 2, height: 1 } },
		{ id: "right", kind: "box_01", position: [1, 0], props: { width: 2, depth: 2, height: 3 } },
	],
	fences: [
		{
			id: "front",
			kind: "picket_fence_01",
			points: [
				[-2, 1.5],
				[2, 1.5],
			],
		},
	],
});

const worldWith = (input: Partial<TSceneInput>) => SceneSchema.parse({ version: 1, ...input });

describe("prefab ids", () => {
	it("never meet a part kind", () => {
		for (const part of PARTS) {
			expect(part.kind.startsWith(PREFAB_KIND_PREFIX), part.kind).toBe(false);
		}
	});

	it("must start with prefab_", () => {
		expect(PrefabSchema.safeParse({ id: "yard" }).success).toBe(false);
		expect(PrefabSchema.safeParse({ id: "prefab_yard" }).success).toBe(true);
	});
});

describe("a prefab as a part (ADR-0134)", () => {
	it("measures the box round its pieces, centred on its origin, and its highest top", () => {
		const { footprint, height } = measurePrefab(yard, () => 1);
		expect(footprint).toEqual([4.4, 3.4]);
		expect(height).toBe(3);
	});

	it("measures a piece as it's turned and scaled", () => {
		const turned = PrefabSchema.parse({
			id: "prefab_turned",
			entities: [
				{
					id: "long",
					kind: "box_01",
					rotation: [0, 90, 0],
					scale: 2,
					altitude: 1,
					props: { width: 4, depth: 1, height: 1 },
				},
			],
		});
		const { footprint, height } = measurePrefab(turned);
		expect(footprint[0]).toBeCloseTo(2);
		expect(footprint[1]).toBeCloseTo(8);
		expect(height).toBe(3);
	});

	it("is made once per design, with its name, size and no props or colours of its own", () => {
		const part = prefabPartOf(yard);
		expect(prefabPartOf(yard)).toBe(part);
		expect(part).toMatchObject({ kind: "prefab_yard", name: "Yard", category: "prefabs" });
		expect(part.colors).toEqual([]);
		expect(part.fields).toEqual([]);
		expect(part.footprint(resolveProps(part, {}))[0]).toBeGreaterThan(4);
		// A changed design is a new object: a new part.
		expect(prefabPartOf({ ...yard, name: "Big yard" }).name).toBe("Big yard");
	});

	it("says what it is when it has no name or description", () => {
		const bare = PrefabSchema.parse({ id: "prefab_bare", entities: yard.entities });
		expect(prefabName(bare)).toBe("Prefab");
		expect(describePrefab(bare)).toBe("A prefab of 2 pieces");
	});

	it("can be stood on where its pieces can (ADR-0138), and nowhere else", () => {
		const plinth = PrefabSchema.parse({
			id: "prefab_plinth",
			entities: [
				{
					id: "top",
					kind: "box_01",
					altitude: 1,
					props: { width: 2, depth: 2, height: 1 },
				},
			],
		});
		const part = prefabPartOf(plinth);
		expect(part.topHeightAt?.({}, 0.5, 0.5)).toBe(2);
		expect(part.topHeightAt?.({}, 5, 5)).toBeNull();
		// Trees and the like can't be stood on, so neither can a prefab of them.
		const grove = PrefabSchema.parse({
			id: "prefab_grove",
			entities: [{ id: "t", kind: "round_tree_01" }],
		});
		expect(prefabPartOf(grove).topHeightAt).toBeUndefined();
	});

	it("follows data when a piece does", () => {
		const following = PrefabSchema.parse({
			id: "prefab_following",
			entities: [{ id: "a", kind: "box_01", data: { scale: { key: "visitors" } } }],
		});
		expect(prefabPartOf(following).readsData).toBe(true);
		expect(prefabPartOf(yard).readsData).toBe(false);
	});

	it("is found in a world that has it, and getPart finds the open world's", () => {
		expect(partIn("box_01", [])).toBe(getBasePart("box_01"));
		expect(partIn("prefab_yard", [yard])?.kind).toBe("prefab_yard");
		expect(partIn("prefab_yard", [])).toBeUndefined();

		setWorldPrefabs([yard]);
		expect(getPart("prefab_yard")?.name).toBe("Yard");
		expect(getBasePart("prefab_yard")).toBeUndefined();
		setWorldPrefabs([]);
		expect(getPart("prefab_yard")).toBeUndefined();
	});
});

describe("prefabs in the world format", () => {
	it("an old world opens unchanged, with no prefabs", () => {
		const text = readFileSync(
			new URL("../scene/fixtures/old-worlds/brightwater-d541cfa.json", import.meta.url),
			"utf8",
		);
		const { scene, report } = repairWorld(JSON.parse(text));
		expect(report).toBeNull();
		expect(scene.prefabs).toEqual([]);
	});

	it("a world with a prefab and copies round-trips with no repairs", () => {
		const world = worldWith({
			prefabs: [yard],
			entities: [
				{ id: "copy_1", kind: "prefab_yard", position: [5, 5] },
				{ id: "copy_2", kind: "prefab_yard", position: [-5, 5], rotation: [0, 45, 0] },
			],
		});
		const { scene, report } = repairWorld(JSON.parse(JSON.stringify(world)));
		expect(report).toBeNull();
		expect(scene).toEqual(world);
	});

	it("repairs a piece's bad field on its own, keeping the piece", () => {
		const { scene, report } = repairWorld({
			version: 1,
			prefabs: [
				{
					id: "prefab_yard",
					entities: [{ id: "a", kind: "box_01", scale: "huge" }],
				},
			],
		});
		expect(report?.fixed).toBeGreaterThan(0);
		expect(scene.prefabs[0].entities).toHaveLength(1);
		expect(scene.prefabs[0].entities[0].scale).toBe(1);
	});

	it("leaves out a piece that's a prefab: no nesting", () => {
		const { scene } = repairWorld({
			version: 1,
			prefabs: [
				{
					id: "prefab_outer",
					entities: [
						{ id: "a", kind: "box_01" },
						{ id: "b", kind: "prefab_inner" },
					],
				},
			],
		});
		expect(scene.prefabs[0].entities.map((piece) => piece.id)).toEqual(["a"]);
	});

	it("leaves out a prefab without a prefab_ id, saying so", () => {
		const { scene, report } = parseOrRepairScene({ version: 1, prefabs: [{ id: "yard" }] });
		expect(scene.prefabs).toEqual([]);
		expect(report?.removed.prefabs).toBe(1);
	});

	it("brings old names and shapes in pieces up to date, as the world's own", () => {
		const { scene } = repairWorld({
			version: 1,
			prefabs: [
				{
					id: "prefab_old",
					entities: [{ id: "a", kind: "house", elevation: 2, color: "#123456", locked: true }],
					fences: [
						{
							id: "f",
							style: "hedge_01",
							points: [
								[0, 0],
								[2, 0],
							],
						},
					],
				},
			],
		});
		const [piece] = scene.prefabs[0].entities;
		expect(piece).toMatchObject({ kind: "house_01", altitude: 2, isLocked: true });
		const main = getBasePart("house_01")?.colors.find((spec) => spec.legacy === "color");
		expect(main && piece.colors[main.id]?.color).toBe("#123456");
		expect(scene.prefabs[0].fences[0].kind).toBe("hedge_01");
	});

	it("is changed one prefab at a time by patches", () => {
		const world = worldWith({ prefabs: [yard] });
		const { world: patched, issues } = applyWorldPatch(world, {
			isPatch: true,
			prefabs: { change: [{ id: "prefab_yard", name: "Farmyard" }] },
		});
		expect(issues).toEqual([]);
		expect((patched.prefabs as { name: string }[])[0].name).toBe("Farmyard");
	});

	it("has its pieces' data bindings among the world's", () => {
		const following = PrefabSchema.parse({
			id: "prefab_following",
			entities: [{ id: "a", kind: "box_01", data: { scale: { key: "visitors" } } }],
			fences: [
				{
					id: "f",
					points: [
						[0, 0],
						[1, 0],
					],
					data: { builtShare: { key: "progress" } },
				},
			],
		});
		const keys = (maps: ReturnType<typeof prefabBindingMapsOf>) =>
			maps.flatMap((map) => Object.values(map).map((binding) => binding.key));
		expect(keys(prefabBindingMapsOf(following))).toEqual(["visitors", "progress"]);
		expect(keys(worldBindingMapsOf(worldWith({ prefabs: [following] })))).toEqual(
			expect.arrayContaining(["visitors", "progress"]),
		);
	});
});

describe("a prefab whose fence has a gate (ADR-0133, ADR-0134)", () => {
	const gated = PrefabSchema.parse({
		id: "prefab_paddock",
		name: "Paddock",
		fences: [
			{
				id: "rails",
				kind: "rail_fence_01",
				points: [
					[-3, 2],
					[3, 2],
				],
				gates: [{ spanIndex: 0, alongShare: 0.5, width: 1.5, data: { isOpen: { key: "open" } } }],
			},
		],
	});

	it("keeps the gate through a round trip, with no repairs", () => {
		const world = worldWith({ prefabs: [gated], entities: [{ id: "c", kind: "prefab_paddock" }] });
		const { scene, report } = repairWorld(JSON.parse(JSON.stringify(world)));
		expect(report).toBeNull();
		expect(scene.prefabs[0].fences[0].gates).toEqual(gated.fences[0].gates);
	});

	it("has the gate's binding among the world's, and follows data by it", () => {
		const keys = worldBindingMapsOf(worldWith({ prefabs: [gated] })).flatMap((map) =>
			Object.values(map).map((binding) => binding.key),
		);
		expect(keys).toContain("open");
		expect(prefabPartOf(gated).readsData).toBe(true);
	});

	it("leaves out a gate it can't read, as a world's fence does, keeping the fence", () => {
		const { scene } = repairWorld({
			version: 1,
			prefabs: [
				{
					id: "prefab_paddock",
					fences: [
						{
							id: "rails",
							points: [
								[0, 0],
								[4, 0],
							],
							gates: [{ width: "wide" }, { alongShare: 0.25 }],
						},
					],
				},
			],
		});
		expect(scene.prefabs[0].fences).toHaveLength(1);
		expect(scene.prefabs[0].fences[0].gates).toHaveLength(1);
		expect(scene.prefabs[0].fences[0].gates[0]).toMatchObject({ alongShare: 0.25 });
	});
});

describe("checking a world with prefabs (ADR-0117)", () => {
	it("knows copies of its prefabs, and warns about a piece whose part doesn't exist", () => {
		const result = validateWorld({
			version: 1,
			prefabs: [
				{
					id: "prefab_yard",
					entities: [
						{ id: "a", kind: "box_01" },
						{ id: "b", kind: "spaceship_09" },
					],
				},
			],
			entities: [{ id: "copy", kind: "prefab_yard" }],
		});
		expect(result.isValid).toBe(true);
		const where = result.warnings.map((warning) => warning.where);
		expect(where.some((at) => at.startsWith("entities[0]"))).toBe(false);
		expect(where).toContain('prefabs[0] "prefab_yard".entities[1] "b".kind');
	});
});
