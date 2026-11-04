import { describe, expect, it } from "vitest";

import { MOST_RENDER_REAL_LIGHTS, realLightsForPicture } from "#/editor/graphics";
import type { IResolvedLight } from "#/parts/types";

import {
	edgeFade,
	lightsTheCardHolds,
	pickNearest,
	placeInView,
	realLightIntensity,
} from "./RealLights";

const light = (level: number, litPaneShare = 1): IResolvedLight => ({
	on: level > 0,
	level,
	color: "#ffffff",
	reach: 2,
	litPaneShare,
	paneWeight: 1,
});

describe("real night lights (ADR-0072)", () => {
	it("go to the best placed lit sources", () => {
		const at = [5, 1, 9, 3, 7];
		expect(pickNearest(at, 3, (x) => x)).toEqual([1, 3, 5]);
		expect(pickNearest(at, 10, (x) => x)).toEqual([1, 3, 5, 7, 9]);
		expect(pickNearest(at, 0, (x) => x)).toEqual([]);
		// Of equal distances the earlier wins; null leaves one out (a source that isn't lit).
		const ties = ["a", "b", "c", "d"];
		const distance = { a: 2, b: 1, c: 2, d: null };
		expect(pickNearest(ties, 2, (x) => distance[x as keyof typeof distance])).toEqual(["b", "a"]);
		expect(pickNearest(ties, 3, (x) => distance[x as keyof typeof distance])).toEqual([
			"b",
			"a",
			"c",
		]);
	});

	it("are as bright as the light is now, and windows as bright as their lit panes", () => {
		expect(realLightIntensity(light(0), "pool")).toBe(0);
		expect(realLightIntensity(light(2), "pool")).toBe(2 * realLightIntensity(light(1), "pool"));
		expect(realLightIntensity(light(1, 0.1), "windows")).toBeLessThan(
			realLightIntensity(light(1, 0.5), "windows"),
		);
	});
});

describe("choosing real lights by the picture (ADR-0144)", () => {
	const far = { x: 0.5, y: 0.5 };

	it("leave out lights that don't reach into the picture, and keep those that do", () => {
		expect(placeInView({ x: 0, y: 0 }, far)).toBe(0);
		// Off the right edge, its light short of it; then reaching over it.
		expect(placeInView({ x: 1.6, y: 0 }, far)).toBeNull();
		expect(placeInView({ x: 1.4, y: 0 }, far)).not.toBeNull();
		// Off a corner: its light has to reach the corner itself.
		expect(placeInView({ x: 1.4, y: 1.4 }, far)).toBeNull();
	});

	it("fill the frame, not a disc: the edges across and up are as far out, the corners not much more", () => {
		expect(placeInView({ x: 1, y: 0 }, far)).toBe(1);
		expect(placeInView({ x: 0, y: 1 }, far)).toBe(1);
		// A corner is less far out than a disc would put it (√2).
		expect(placeInView({ x: 1, y: 1 }, far)).toBeLessThan(1.2);
		expect(placeInView({ x: 0.5, y: 0.2 }, far)).toBeLessThan(
			placeInView({ x: 0.6, y: 0 }, far) ?? 0,
		);
	});

	it("fade the farthest picked lights out, so the lit part of the view has no hard edge", () => {
		// All in: every one full.
		expect(edgeFade([0, 0.2, 0.4], 3)).toEqual([1, 1, 1]);
		expect(edgeFade([], 3)).toEqual([]);
		// Five picked of more: full inside, fading across the outer third or so, all but dark at the
		// edge.
		const fades = edgeFade([0, 0.1, 0.6, 0.83, 0.99, 1], 5);
		expect(fades).toHaveLength(5);
		expect(fades.slice(0, 3)).toEqual([1, 1, 1]);
		expect(fades[3]).toBeGreaterThan(0.2);
		expect(fades[3]).toBeLessThan(0.8);
		expect(fades[4]).toBeLessThan(0.01);
		// Never brighter farther out.
		for (let i = 1; i < fades.length; i++) {
			expect(fades[i]).toBeLessThanOrEqual(fades[i - 1]);
		}
		// All at the same place: nothing to fade across, so all full.
		expect(edgeFade([0.3, 0.3, 0.3], 2)).toEqual([1, 1]);
	});

	it("change a light's strength smoothly as the view moves", () => {
		// Moving the cut-off a little moves every strength a little.
		const before = edgeFade([0, 0.6, 0.8, 1], 3);
		const after = edgeFade([0, 0.6, 0.8, 1.001], 3);
		before.forEach((fade, i) => {
			expect(Math.abs(fade - after[i])).toBeLessThan(0.01);
		});
	});

	it("give a still picture more lights, as the picture's size and the card allow", () => {
		// The live view's counts are as set, on any card.
		expect(lightsTheCardHolds(16, 224)).toBe(16);
		expect(lightsTheCardHolds(64, 1024)).toBe(64);
		// A picture's more, as far as the card's shaders have room for them, never fewer than 64.
		expect(lightsTheCardHolds(192, 1024)).toBe(192);
		expect(lightsTheCardHolds(192, 512)).toBe(64);
		expect(lightsTheCardHolds(192, 4096)).toBe(192);
		// The view's size, smoothed twice: the most. 4K smoothed twice (the browser's limit): 64.
		expect(realLightsForPicture(1920 * 1080 * 4)).toBe(MOST_RENDER_REAL_LIGHTS);
		expect(realLightsForPicture(2 ** 25)).toBe(64);
		expect(realLightsForPicture(2 ** 24)).toBe(128);
		expect(realLightsForPicture(0)).toBe(MOST_RENDER_REAL_LIGHTS);
	});
});
