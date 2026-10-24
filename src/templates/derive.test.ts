import { describe, expect, it } from "vitest";

import { createBrightwaterScene } from "./brightwater";
import { deriveTemplate } from "./derive";

describe("deriveTemplate", () => {
	const atDusk = deriveTemplate(createBrightwaterScene, (scene) => {
		scene.meta.title = "Brightwater at dusk";
		scene.lighting.timeSource = "cycle";
		scene.lighting.time = 17.5;
	});

	it("is the base world with only what it changes changed", () => {
		const base = createBrightwaterScene();
		const derived = atDusk();
		expect(derived.meta.title).toBe("Brightwater at dusk");
		expect(derived.lighting).toEqual({ ...base.lighting, timeSource: "cycle", time: 17.5 });
		expect({ ...derived, meta: base.meta, lighting: base.lighting }).toEqual(base);
	});

	it("builds a fresh world each time and leaves the base alone", () => {
		expect(atDusk()).not.toBe(atDusk());
		expect(createBrightwaterScene().meta.title).toBe("Brightwater");
	});

	it("checks the result like any world", () => {
		const broken = deriveTemplate(createBrightwaterScene, (scene) => {
			scene.lighting.dayLength = -1;
		});
		expect(() => broken()).toThrow();
	});
});
