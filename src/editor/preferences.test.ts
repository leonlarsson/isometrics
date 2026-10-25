import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	DEFAULT_PREFERENCES,
	dampingFactorOf,
	overlayPlaceWith,
	overlayShownIn,
	parsePreferences,
} from "./preferences";
import { memoryStorage } from "./testStorage";

/** A fresh copy of the module, so nothing read by an earlier test is cached. */
const freshModule = async () => {
	vi.resetModules();
	return import("./preferences");
};

describe("preferences", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.stubGlobal("window", new EventTarget());
	});
	afterEach(() => vi.unstubAllGlobals());

	it("reads the settings, each one that can't be read at its default", () => {
		expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
		expect(parsePreferences("{nope")).toEqual(DEFAULT_PREFERENCES);
		expect(
			parsePreferences(JSON.stringify({ zoomSpeed: 2, orbitSpeed: "fast", smoothing: 9 })),
		).toEqual({ ...DEFAULT_PREFERENCES, zoomSpeed: 2 });
	});

	it("stores a change, keeping one made in another tab meanwhile", async () => {
		const { readPreferences, setPreference } = await freshModule();
		expect(readPreferences().invertZoom).toBe(false);
		localStorage.setItem("isometrics:preferences", JSON.stringify({ zoomSpeed: 2 }));
		setPreference("invertZoom", true);
		expect(readPreferences()).toEqual({ ...DEFAULT_PREFERENCES, zoomSpeed: 2, invertZoom: true });
		expect(JSON.parse(localStorage.getItem("isometrics:preferences") ?? "{}").invertZoom).toBe(
			true,
		);
	});

	it("turns smoothing into damping: none at 0, the usual at the default, more towards 1", () => {
		expect(dampingFactorOf(0)).toBeNull();
		expect(dampingFactorOf(DEFAULT_PREFERENCES.smoothing)).toBeCloseTo(0.12, 5);
		expect(dampingFactorOf(1)).toBeLessThan(0.12);
		expect(dampingFactorOf(0.1)).toBeGreaterThan(0.12);
	});

	it("reads an overlay's place, or its default when it can't", () => {
		expect(parsePreferences(JSON.stringify({ viewLabel: "both" })).viewLabel).toBe("both");
		expect(parsePreferences(JSON.stringify({ viewLabel: "sometimes" })).viewLabel).toBe("edit");
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
		const { readPreferences, setPreference, resetPreferences, preferencesChanged } =
			await freshModule();
		setPreference("orbitSpeed", 2);
		setPreference("viewLabel", "both");
		expect(preferencesChanged(readPreferences(), ["keyboardSpeed"])).toBe(false);
		expect(preferencesChanged(readPreferences(), ["orbitSpeed"])).toBe(true);
		resetPreferences(["orbitSpeed"]);
		expect(readPreferences().orbitSpeed).toBe(1);
		expect(readPreferences().viewLabel).toBe("both");
		resetPreferences();
		expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
		expect(preferencesChanged(readPreferences())).toBe(false);
	});
});
