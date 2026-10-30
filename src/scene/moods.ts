import type { Draft } from "immer";

import type { TMood, TScene } from "./schema";

/**
 * Moods (ADR-0078): named looks of a world, a snapshot of what makes its
 * look: the lighting (time of day included), the sky, the water, the weather
 * (ADR-0102) and the tilt-shift. Putting one on copies them back.
 */

/** The world's look now, as a mood called `name`. */
export const moodOf = (scene: TScene, id: string, name: string): TMood => ({
	id,
	name,
	lighting: structuredClone(scene.lighting),
	sky: structuredClone(scene.sky),
	water: structuredClone(scene.water),
	weather: structuredClone(scene.weather),
	tiltShift: structuredClone(scene.camera.tiltShift),
});

/** Puts `mood` on the world: its lighting, sky, water, weather and tilt-shift. */
export const putOnMood = (scene: Draft<TScene>, mood: TMood) => {
	scene.lighting = structuredClone(mood.lighting);
	scene.sky = structuredClone(mood.sky);
	scene.water = structuredClone(mood.water);
	scene.weather = structuredClone(mood.weather);
	scene.camera.tiltShift = structuredClone(mood.tiltShift);
};

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Whether the world looks exactly as `mood` has it now. */
export const wearsMood = (scene: TScene, mood: TMood) => {
	const now = moodOf(scene, mood.id, mood.name);
	return (
		sameJson(now.lighting, mood.lighting) &&
		sameJson(now.sky, mood.sky) &&
		sameJson(now.water, mood.water) &&
		sameJson(now.weather, mood.weather) &&
		sameJson(now.tiltShift, mood.tiltShift)
	);
};
