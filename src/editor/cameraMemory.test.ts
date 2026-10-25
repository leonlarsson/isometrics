import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneSchema } from "#/scene/schema";

import {
	adoptUnsavedView,
	forgetView,
	parseCameraMemory,
	rememberedView,
	rememberView,
	UNSAVED_WORLD,
} from "./cameraMemory";
import { createWorld, saveScene } from "./persistence";
import { memoryStorage } from "./testStorage";

const KEY = "isometrics:camera";

const pose = {
	target: [3, -2] as [number, number],
	azimuth: 120,
	elevation: 40,
	span: 18,
	projection: "orthographic" as const,
	fieldOfView: null,
	targetHeight: 0,
};

describe("cameraMemory", () => {
	beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
	afterEach(() => vi.unstubAllGlobals());

	it("reads each world's camera, or nothing when it's unreadable", () => {
		expect(parseCameraMemory(null)).toEqual({});
		expect(parseCameraMemory("{nope")).toEqual({});
		expect(parseCameraMemory("[1]")).toEqual({});
		expect(parseCameraMemory(JSON.stringify({ a: pose }))).toEqual({ a: pose });
	});

	it("keeps the readable entries when some aren't poses", () => {
		expect(
			parseCameraMemory(JSON.stringify({ a: pose, b: { span: "far" }, c: null, d: 4 })),
		).toEqual({ a: pose });
	});

	it("keeps the unsaved starter's camera until its first save, then under its id", () => {
		rememberView(UNSAVED_WORLD, pose);
		adoptUnsavedView("x");
		expect(rememberedView("x")).toEqual(pose);
		expect(rememberedView(UNSAVED_WORLD)).toBeNull();
		// The first save of the world adopts it.
		rememberView(UNSAVED_WORLD, { ...pose, span: 7 });
		saveScene(SceneSchema.parse({ version: 1 }));
		const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
		expect(Object.values(saved).map((p) => (p as typeof pose).span)).toContain(7);
		expect(rememberedView(UNSAVED_WORLD)).toBeNull();
		// A different world replacing the starter doesn't take its camera.
		rememberView(UNSAVED_WORLD, { ...pose, span: 9 });
		const other = createWorld(SceneSchema.parse({ version: 1 }));
		expect(rememberedView(other)).toBeNull();
		expect(rememberedView(UNSAVED_WORLD)).toBeNull();
	});

	it("remembers a camera per world, and forgets a deleted world's", () => {
		expect(rememberedView("a")).toBeNull();
		expect(rememberedView(null)).toBeNull();
		rememberView("a", pose);
		rememberView("b", { ...pose, span: 5 });
		expect(rememberedView("a")).toEqual(pose);
		expect(rememberedView("b")?.span).toBe(5);
		forgetView("a");
		expect(rememberedView("a")).toBeNull();
		expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toEqual({ b: { ...pose, span: 5 } });
	});

	it("doesn't overwrite a camera another tab stored meanwhile", () => {
		rememberView("a", pose);
		localStorage.setItem(KEY, JSON.stringify({ a: pose, other: pose }));
		rememberView("b", pose);
		expect(Object.keys(parseCameraMemory(localStorage.getItem(KEY))).sort()).toEqual([
			"a",
			"b",
			"other",
		]);
	});
});
