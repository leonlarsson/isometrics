import { beforeEach, describe, expect, it } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { pasteText, selectedThingsText } from "./clipboard";
import { useEditor } from "./store";
import {
	keepsOpenWorld,
	labelWithReason,
	OWN_WORLD,
	whyNoWorkshop,
	whyNoWorldAction,
	workshopOf,
} from "./whatIsOpen";
import {
	centredPieces,
	confirmLeavingWorkshop,
	designOf,
	editPrefab,
	leaveWorkshopFirst,
	leaveWorkshopWithoutSaving,
	makeNewPrefab,
	makePrefabFromSelection,
	newPrefabName,
	renamePrefabInWorkshop,
	saveWorkshop,
	workshopWorldOf,
} from "./workshop";

const world = () =>
	SceneSchema.parse({
		version: 1,
		meta: { title: "Farm" },
		grounds: [{ id: "ground", width: 60, depth: 60 }],
		lighting: { time: 19 },
		data: { values: [{ key: "hay", value: 3 }] },
		viewpoints: [{ id: "v" }],
		entities: [
			{ id: "a", kind: "box_01", position: [10, 10], altitude: 1 },
			{ id: "b", kind: "box_01", position: [12, 10], altitude: 1 },
			{ id: "far", kind: "house_01", position: [-20, -20] },
		],
		fences: [
			{
				id: "f",
				points: [
					[10, 12, 0],
					[12, 12, 0],
				],
			},
		],
	});

const s = () => useEditor.getState();

describe("the Workshop's world (ADR-0134)", () => {
	it("has the theme and data of the world it's for, a studio's light, a ground sized to the pieces, and nothing else", () => {
		const from = world();
		const workshop = workshopWorldOf(from, { entities: [], fences: [] });
		expect(workshop.grounds[0]).toMatchObject({ width: 16, depth: 16 });
		// A plain daylight of its own, whatever the hour in the world; the world's theme.
		expect(workshop.lighting.time).toBeNull();
		expect(workshop.theme).toBe(from.theme);
		expect(workshop.data).toEqual(from.data);
		expect(workshop.viewpoints).toEqual([]);
		expect(workshop.prefabs).toEqual([]);
		const big = workshopWorldOf(from, {
			entities: [
				SceneSchema.parse({
					version: 1,
					entities: [{ id: "x", kind: "box_01", props: { width: 30, depth: 2, height: 1 } }],
				}).entities[0],
			],
			fences: [],
		});
		expect(big.grounds[0].width).toBe(38);
		expect(big.grounds[0].depth).toBe(16);
	});

	it("keeps a design round its middle, its lowest piece at altitude 0", () => {
		const from = world();
		const { pieces, middle, low } = centredPieces({
			entities: from.entities.slice(0, 2),
			fences: from.fences,
		});
		expect(middle).toEqual([11, 10.75]);
		expect(low).toBe(0);
		expect(pieces.entities.map((piece) => piece.position)).toEqual([
			[-1, -0.75],
			[1, -0.75],
		]);
		const design = designOf(
			{ entities: from.entities.slice(0, 2), fences: [] },
			{ id: "prefab_x", name: "X", description: "" },
		);
		expect(design.entities.map((piece) => piece.altitude)).toEqual([0, 0]);
	});

	it("names new prefabs apart", () => {
		expect(newPrefabName([])).toBe("Prefab");
		expect(newPrefabName([{ name: "Prefab" }, { name: "" }])).toBe("Prefab 2");
	});

	it("isn't kept as a world, and can't be opened from a preview or inside itself", () => {
		const workshop = { from: { scene: world(), past: [], future: [], view: null } };
		const inside = {
			...OWN_WORLD,
			workshop: {
				...workshop,
				prefabId: null,
				replaces: null,
				name: "",
				description: "",
				showsGround: false,
			},
		};
		expect(keepsOpenWorld(inside)).toBe(false);
		expect(whyNoWorkshop(OWN_WORLD)).toBeNull();
		expect(whyNoWorkshop(inside)).toBe("not inside the Workshop");
		expect(
			whyNoWorkshop({ ...OWN_WORLD, preview: { from: "shared", id: "x", expiresAt: null } }),
		).toBe("keep a copy first");
	});
});

describe("making and changing prefabs in the Workshop (ADR-0134)", () => {
	beforeEach(() => {
		s().loadScene(world());
		s().commit((scene) => {
			scene.meta.subtitle = "An edit before, to undo";
		});
	});

	it("from a selection: saved as one step, a copy in the selection's place", () => {
		s().selectItems([
			{ kind: "entity", id: "a" },
			{ kind: "entity", id: "b" },
			{ kind: "fence", id: "f" },
		]);
		const before = s().scene;
		const history = s().past.length;
		makePrefabFromSelection(null);
		expect(workshopOf(s().whatIsOpen)).not.toBeNull();
		expect(s().scene.entities).toHaveLength(2);
		expect(s().scene.fences).toHaveLength(1);
		expect(s().past).toEqual([]);
		renamePrefabInWorkshop("Pens");
		saveWorkshop();

		const { scene, past, whatIsOpen } = s();
		expect(whatIsOpen).toEqual(OWN_WORLD);
		expect(past.length).toBe(history + 1);
		expect(scene.prefabs).toHaveLength(1);
		const [prefab] = scene.prefabs;
		expect(prefab).toMatchObject({ name: "Pens" });
		expect(prefab.id.startsWith("prefab_")).toBe(true);
		expect(scene.entities.map((e) => e.id)).not.toContain("a");
		expect(scene.fences).toEqual([]);
		const copy = scene.entities.find((e) => e.kind === prefab.id);
		expect(copy).toMatchObject({ position: [11, 10.75], altitude: 0 });

		s().undo();
		expect(s().scene).toBe(before);
	});

	it("from nothing: a copy where one is looking, selected", () => {
		makeNewPrefab(null);
		expect(s().scene.entities).toEqual([]);
		s().addEntity({ kind: "box_01", name: "", position: [3, 3] });
		saveWorkshop();
		const [prefab] = s().scene.prefabs;
		const copy = s().scene.entities.find((e) => e.kind === prefab.id);
		expect(copy).toBeDefined();
		expect(s().selectedId).toBe(copy?.id);
		expect(prefab.entities[0].position).toEqual([0, 0]);
	});

	it("Edit in the Workshop changes the design, and so every copy, as one step", () => {
		makeNewPrefab(null);
		s().addEntity({ kind: "box_01", name: "", position: [0, 0] });
		saveWorkshop();
		const [prefab] = s().scene.prefabs;
		s().addEntity({ kind: prefab.id, name: "", position: [-5, 5] });
		const copies = s().scene.entities.filter((e) => e.kind === prefab.id).length;
		const history = s().past.length;

		editPrefab(prefab.id, null);
		expect(s().scene.entities).toHaveLength(1);
		s().addEntity({ kind: "ball_01", name: "", position: [2, 0] });
		saveWorkshop();
		expect(s().past.length).toBe(history + 1);
		expect(s().scene.prefabs[0].id).toBe(prefab.id);
		expect(s().scene.prefabs[0].entities.map((piece) => piece.kind)).toEqual(["box_01", "ball_01"]);
		expect(s().scene.entities.filter((e) => e.kind === prefab.id)).toHaveLength(copies);
	});

	it("Leave without saving goes back to the world as it was, with its history", () => {
		const { scene, past } = s();
		makeNewPrefab(null);
		s().addEntity({ kind: "box_01", name: "", position: [0, 0] });
		leaveWorkshopWithoutSaving();
		expect(s().scene).toBe(scene);
		expect(s().past).toEqual(past);
		expect(s().whatIsOpen).toEqual(OWN_WORLD);
	});

	it("doesn't take a prefab's copy inside the Workshop, even pasted", () => {
		makeNewPrefab(null);
		s().addEntity({ kind: "box_01", name: "", position: [0, 0] });
		saveWorkshop();
		s().selectItems(
			s()
				.scene.entities.filter((e) => e.kind.startsWith("prefab_"))
				.map((e) => ({ kind: "entity" as const, id: e.id })),
		);
		const text = selectedThingsText();
		makeNewPrefab(null);
		pasteText(text ?? "");
		expect(s().scene.entities).toEqual([]);
		leaveWorkshopWithoutSaving();
	});

	it("greys out acting on the open world as a world while it's the Workshop's", () => {
		expect(whyNoWorldAction(s().whatIsOpen)).toBeNull();
		makeNewPrefab(null);
		expect(whyNoWorldAction(s().whatIsOpen)).toBe("not in the Workshop");
		expect(labelWithReason("Save to file", whyNoWorldAction(s().whatIsOpen))).toBe(
			"Save to file (not in the Workshop)",
		);
		leaveWorkshopWithoutSaving();
	});

	it("leaving any other way asks first once something was built, then carries on", () => {
		const done: string[] = [];
		makeNewPrefab(null);
		// Nothing built: straight out.
		leaveWorkshopFirst(() => done.push("empty"));
		expect(workshopOf(s().whatIsOpen)).toBeNull();
		expect(done).toEqual(["empty"]);

		makeNewPrefab(null);
		s().addEntity({ kind: "box_01", name: "", position: [0, 0] });
		leaveWorkshopFirst(() => done.push("built"));
		// Asked: still in the Workshop until the answer.
		expect(workshopOf(s().whatIsOpen)).not.toBeNull();
		expect(s().workshopLeaving).not.toBeNull();
		confirmLeavingWorkshop();
		expect(workshopOf(s().whatIsOpen)).toBeNull();
		expect(s().workshopLeaving).toBeNull();
		expect(done).toEqual(["empty", "built"]);
	});

	it("isn't opened from a preview", () => {
		s().loadScene(world(), { preview: { from: "shared", id: "x", expiresAt: null } });
		makeNewPrefab(null);
		expect(workshopOf(s().whatIsOpen)).toBeNull();
	});
});
