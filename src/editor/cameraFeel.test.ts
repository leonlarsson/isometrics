import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	DEFAULT_CAMERA_FEEL,
	dampingFactorOf,
	overlayPlaceWith,
	overlayShownIn,
	parseCameraFeel,
} from "./cameraFeel";
import { memoryStorage } from "./testStorage";

/** A fresh copy of the module, so nothing read by an earlier test is cached. */
const freshModule = async () => {
	vi.resetModules();
	return import("./cameraFeel");
};

describe("cameraFeel", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.stubGlobal("window", new EventTarget());
	});
	afterEach(() => vi.unstubAllGlobals());

	it("reads the settings, each one that can't be read at its default", () => {
		expect(parseCameraFeel(null)).toEqual(DEFAULT_CAMERA_FEEL);
		expect(parseCameraFeel("{nope")).toEqual(DEFAULT_CAMERA_FEEL);
		expect(
			parseCameraFeel(JSON.stringify({ zoomSpeed: 2, orbitSpeed: "fast", smoothing: 9 })),
		).toEqual({ ...DEFAULT_CAMERA_FEEL, zoomSpeed: 2 });
	});

	it("stores a change, keeping one made in another tab meanwhile", async () => {
		const { readCameraFeel, setCameraFeel } = await freshModule();
		expect(readCameraFeel().invertZoom).toBe(false);
		localStorage.setItem("isometrics:camera-feel", JSON.stringify({ zoomSpeed: 2 }));
		setCameraFeel("invertZoom", true);
		expect(readCameraFeel()).toEqual({ ...DEFAULT_CAMERA_FEEL, zoomSpeed: 2, invertZoom: true });
		expect(JSON.parse(localStorage.getItem("isometrics:camera-feel") ?? "{}").invertZoom).toBe(
			true,
		);
	});

	it("turns smoothing into damping: none at 0, the usual at the default, more towards 1", () => {
		expect(dampingFactorOf(0)).toBeNull();
		expect(dampingFactorOf(DEFAULT_CAMERA_FEEL.smoothing)).toBeCloseTo(0.12, 5);
		expect(dampingFactorOf(1)).toBeLessThan(0.12);
		expect(dampingFactorOf(0.1)).toBeGreaterThan(0.12);
	});

	it("reads overlays saved as on or off: on was Edit mode", () => {
		const feel = parseCameraFeel(JSON.stringify({ navigationGizmo: false, compositionGrid: true }));
		expect(feel.navigationGizmo).toBe("off");
		expect(feel.compositionGrid).toBe("edit");
		expect(parseCameraFeel(JSON.stringify({ viewLabel: "both" })).viewLabel).toBe("both");
		expect(parseCameraFeel(JSON.stringify({ viewLabel: "sometimes" })).viewLabel).toBe("edit");
	});

	it("turns an overlay on or off in one mode, keeping the other", () => {
		expect(overlayPlaceWith("edit", "view", true)).toBe("both");
		expect(overlayPlaceWith("both", "edit", false)).toBe("view");
		expect(overlayPlaceWith("view", "view", false)).toBe("off");
		expect(overlayPlaceWith("off", "edit", true)).toBe("edit");
		expect(overlayShownIn("both", "view")).toBe(true);
		expect(overlayShownIn("edit", "view")).toBe(false);
	});

	it("resets one page's preferences, or all of them", async () => {
		const { readCameraFeel, setCameraFeel, resetCameraFeel, cameraFeelChanged } =
			await freshModule();
		setCameraFeel("orbitSpeed", 2);
		setCameraFeel("viewLabel", "both");
		expect(cameraFeelChanged(readCameraFeel(), ["keyboardSpeed"])).toBe(false);
		expect(cameraFeelChanged(readCameraFeel(), ["orbitSpeed"])).toBe(true);
		resetCameraFeel(["orbitSpeed"]);
		expect(readCameraFeel().orbitSpeed).toBe(1);
		expect(readCameraFeel().viewLabel).toBe("both");
		resetCameraFeel();
		expect(readCameraFeel()).toEqual(DEFAULT_CAMERA_FEEL);
		expect(cameraFeelChanged(readCameraFeel())).toBe(false);
	});
});
