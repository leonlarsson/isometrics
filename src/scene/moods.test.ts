import { produce } from "immer";
import { describe, expect, it } from "vitest";

import { moodOf, putOnMood, wearsMood } from "./moods";
import { SceneSchema } from "./schema";

const world = () => SceneSchema.parse({ version: 1 });

describe("moods (ADR-0078)", () => {
	it("are the world's look: put on, it looks as it did when saved", () => {
		const scene = produce(world(), (s) => {
			s.lighting.time = 18.3;
			s.sky.cloudCover = 0.7;
			s.water.rippleStrength = 0.1;
			s.camera.tiltShiftOn = true;
		});
		const golden = moodOf(scene, "golden", "Golden hour");
		expect(wearsMood(scene, golden)).toBe(true);

		const night = produce(scene, (s) => {
			s.lighting.time = 22;
			s.sky.cloudCover = 0;
			s.camera.tiltShiftOn = false;
		});
		expect(wearsMood(night, golden)).toBe(false);
		const back = produce(night, (s) => putOnMood(s, golden));
		expect(wearsMood(back, golden)).toBe(true);
		expect(back.lighting.time).toBe(18.3);
		expect(back.camera.tiltShiftOn).toBe(true);
	});

	it("leave the rest of the world alone", () => {
		const scene = produce(world(), (s) => {
			s.meta.title = "Harbour";
			s.camera.fieldOfView = 55;
		});
		const mood = moodOf(world(), "m", "Plain");
		const after = produce(scene, (s) => putOnMood(s, mood));
		expect(after.meta.title).toBe("Harbour");
		expect(after.camera.fieldOfView).toBe(55);
	});

	it("open in worlds saved without them, and a mood missing parts gets the defaults", () => {
		expect(world().moods).toEqual([]);
		expect(world().viewpoints).toEqual([]);
		const scene = SceneSchema.parse({ version: 1, moods: [{ id: "a", name: "A" }] });
		expect(scene.moods[0].lighting).toEqual(world().lighting);
		expect(scene.moods[0].camera.tiltShiftOn).toBe(false);
	});
});
