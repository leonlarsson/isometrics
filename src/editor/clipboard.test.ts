import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { pasteSettings, pasteText, readClip, selectedThingsText, settingsOf } from "./clipboard";
import { resetPreferences, setPreference } from "./preferences";
import { useEditor } from "./store";

const load = () => {
	useEditor.getState().loadScene(
		SceneSchema.parse({
			version: 1,
			ground: { width: 40, depth: 40 },
			data: [{ key: "alert", value: 1 }],
			entities: [
				{
					id: "a",
					kind: "street_lamp_01",
					position: [0, 0],
					lights: {
						lamp: { whenOn: "schedule", schedule: [{ from: 18, until: 23 }], strength: 2 },
					},
					colors: { post: { color: "#ff0000" } },
				},
				{ id: "b", kind: "street_lamp_01", position: [2, 0] },
				{ id: "c", kind: "light_01", position: [4, 0] },
				{ id: "d", kind: "house_01", position: [6, 0] },
				{ id: "car", kind: "car_01", follow: { roadId: "r" } },
			],
			roads: [
				{
					id: "r",
					points: [
						[0, 5],
						[10, 5],
					],
				},
			],
		}),
	);
};

const entity = (id: string) => useEditor.getState().scene.entities.find((e) => e.id === id);
const select = (...ids: string[]) =>
	useEditor.getState().selectItems(ids.map((id) => ({ kind: "entity" as const, id })));

describe("copying and pasting settings (ADR-0068)", () => {
	beforeEach(load);

	it("pastes a light onto the same light, and onto another part's only light of that shape", () => {
		const copied = settingsOf(entity("a")!, "light", "lamp");
		select("b", "c", "d");
		const before = useEditor.getState().past.length;
		pasteSettings(copied!);
		const lights = (id: string) =>
			entity(id)?.lights as Record<string, { strength: number | null }>;
		expect(lights("b").lamp.strength).toBe(2);
		expect(lights("c").light.strength).toBe(2);
		// The house has no pool light: untouched.
		expect(entity("d")?.lights).toEqual({});
		expect(useEditor.getState().past.length).toBe(before + 1);
	});

	it("pastes only the schedule when asked", () => {
		const copied = settingsOf(entity("a")!, "light", "lamp");
		select("b");
		pasteSettings(copied!, { lightId: "lamp", scheduleOnly: true });
		const lamp = (entity("b")!.lights as Record<string, Record<string, unknown>>).lamp;
		expect(lamp.whenOn).toBe("schedule");
		expect(lamp.schedule).toEqual([{ from: 18, until: 23 }]);
		expect(lamp.strength).toBeNull();
	});

	it("pastes colours by id, and a shape only onto the same part", () => {
		select("b", "d");
		pasteSettings(settingsOf(entity("a")!, "colors")!);
		expect(entity("b")?.colors.post.color).toBe("#ff0000");
		expect(entity("d")?.colors).toEqual({});

		useEditor.getState().setEntityProp("a", "height", 5);
		select("b", "c");
		pasteSettings(settingsOf(entity("a")!, "shape")!);
		expect(entity("b")?.props.height).toBe(5);
		expect(entity("c")?.props.height).toBeUndefined();
	});

	it("reads only what this app wrote, checked by the schemas", () => {
		expect(readClip("hello")).toBeNull();
		expect(
			readClip(JSON.stringify({ app: "isometrics", type: "settings", settings: { kind: "nope" } })),
		).toBeNull();
		expect(
			readClip(JSON.stringify({ app: "isometrics", type: "things", entities: [] }))?.type,
		).toBe("things");
	});
});

describe("copying and pasting things (ADR-0068)", () => {
	beforeEach(load);

	it("pastes copies with new ids, a step over while the originals are here, selected, in one step", () => {
		useEditor.getState().selectItems([
			{ kind: "road", id: "r" },
			{ kind: "entity", id: "car" },
			{ kind: "entity", id: "a" },
		]);
		const text = selectedThingsText();
		const before = useEditor.getState().past.length;
		pasteText(text!);
		const { scene, selectedItems, past } = useEditor.getState();
		expect(scene.entities).toHaveLength(7);
		expect(scene.roads).toHaveLength(2);
		const road = scene.roads[1];
		expect(road.id).not.toBe("r");
		expect(road.points[0].slice(0, 2)).toEqual([1, 6]);
		const car = scene.entities.find((e) => e.kind === "car_01" && e.id !== "car");
		expect(car?.follow?.roadId).toBe(road.id);
		expect(selectedItems).toHaveLength(3);
		expect(past.length).toBe(before + 1);
	});

	it("into another world: in place, and a vehicle whose road isn't there parks", () => {
		useEditor.getState().selectItems([{ kind: "entity", id: "car" }]);
		const text = selectedThingsText();
		useEditor.getState().loadScene(SceneSchema.parse({ version: 1 }));
		pasteText(text!);
		const [car] = useEditor.getState().scene.entities;
		expect(car.follow).toBeNull();
		expect(car.position).toEqual([0, 0]);
	});

	it("centres them on a point (the ground's Paste here), kept on the ground", () => {
		select("a", "b");
		pasteText(selectedThingsText()!, { at: [19, 10] });
		const pasted = useEditor
			.getState()
			.scene.entities.slice(-2)
			.map((e) => e.position);
		expect(pasted).toEqual([
			[18, 10],
			[20, 10],
		]);
	});
});

describe("names of pasted things (ADR-0068)", () => {
	beforeEach(load);
	afterEach(() => resetPreferences());

	const copyRingRoad = () => {
		useEditor.getState().updateRoad("r", (road) => {
			road.name = "Ring road";
		});
		useEditor.getState().selectItems([{ kind: "road", id: "r" }]);
		return selectedThingsText()!;
	};
	const roadNames = () => useEditor.getState().scene.roads.map((road) => road.name);

	it("adds “copy” where the name is taken, keeps it where it's free", () => {
		const text = copyRingRoad();
		pasteText(text);
		expect(roadNames()).toEqual(["Ring road", "Ring road copy"]);
		useEditor.getState().loadScene(SceneSchema.parse({ version: 1 }));
		pasteText(text);
		expect(roadNames()).toEqual(["Ring road"]);
	});

	it("numbers them when the preference says so", () => {
		setPreference("namesOfCopies", "numbered");
		const text = copyRingRoad();
		pasteText(text);
		pasteText(text);
		expect(roadNames()).toEqual(["Ring road", "Ring road 2", "Ring road 3"]);
	});
});
