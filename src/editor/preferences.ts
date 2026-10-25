import { useSyncExternalStore } from "react";
import { z } from "zod";

import { APP_NAME } from "#/lib/app";

/**
 * Preferences, per browser: what's in the Preferences dialog. How the camera
 * moves for you (camera control, speeds, inverted zoom, smoothing, glides),
 * where the overlays show, and how copies are named. Personal, like the panel sizes, so they apply
 * to every world here and are never saved with one.
 * See docs/adr/0062-camera-settings.md.
 *
 * When the settings change: nothing is migrated. A setting that can't be read
 * goes back to its default; the others are kept.
 */
const KEY = `${APP_NAME.toLowerCase()}:preferences`;

/** Where an overlay shows: nowhere, in one mode, or in both. */
export const OVERLAY_PLACES = ["off", "edit", "view", "both"] as const;
export type TOverlayPlace = (typeof OVERLAY_PLACES)[number];

const OverlayPlaceSchema = z.enum(OVERLAY_PLACES);

export const PreferencesSchema = z.object({
	/**
	 * simple: the camera stays above the world, within the world's zoom and tilt limits;
	 * free: orbit anywhere, as in Blender (under the ground, straight up, any zoom).
	 */
	cameraControl: z.enum(["simple", "free"]).catch("simple"),
	/** Turning and tilting by dragging, a two-finger twist or Shift+arrows, × the usual speed. */
	orbitSpeed: z.number().min(0.2).max(3).catch(1),
	/** Zooming with the wheel, the middle button, a pinch or + and −, × the usual speed. */
	zoomSpeed: z.number().min(0.2).max(3).catch(1),
	/** Scrolling up zooms out instead of in. */
	invertZoom: z.boolean().catch(false),
	/** How long the camera keeps gliding after a move: 0 stops at once, 1 drifts a long way. */
	smoothing: z.number().min(0).max(1).catch(0.6),
	/** Seconds a glide to a viewpoint takes; 0 jumps there. */
	glideSeconds: z.number().min(0).max(3).catch(0.8),
	/** Panning with the arrow keys (and W A S D in View mode), × the usual speed. */
	keyboardSpeed: z.number().min(0.2).max(3).catch(1),
	/** A rule-of-thirds grid over the view, for lining up viewpoints. */
	compositionGrid: OverlayPlaceSchema.catch("off"),
	/** The compass in the view's corner: shows which way it looks, click or drag to turn. */
	navigationGizmo: OverlayPlaceSchema.catch("edit"),
	/** A line in the view's corner saying what the camera shows. */
	viewLabel: OverlayPlaceSchema.catch("edit"),
	/** Saved viewpoints drawn in the world, as small cameras with what they see. */
	viewpointsInWorld: OverlayPlaceSchema.catch("off"),
	/**
	 * What a copy of a named thing is called (ADR-0068): "Tower copy", or numbered, "Tower 2",
	 * "Tower 3"…
	 */
	copyNames: z.enum(["copy", "numbered"]).catch("copy"),
});

export type TPreferences = z.output<typeof PreferencesSchema>;

/** Every setting at its default. */
export const DEFAULT_PREFERENCES: TPreferences = PreferencesSchema.parse({});

/** Stored settings, each one that can't be read at its default. */
export const parsePreferences = (raw: string | null): TPreferences => {
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		return PreferencesSchema.parse(typeof value === "object" && value !== null ? value : {});
	} catch {
		return DEFAULT_PREFERENCES;
	}
};

/**
 * OrbitControls' damping for a smoothing: none at 0, its usual 0.12 at the
 * default 0.6, and a long drift towards 1.
 */
export const dampingFactorOf = (smoothing: number) =>
	smoothing <= 0 ? null : 0.3 * (0.12 / 0.3) ** (smoothing / 0.6);

const read = () => {
	try {
		return parsePreferences(localStorage.getItem(KEY));
	} catch {
		return DEFAULT_PREFERENCES;
	}
};

let preferences: TPreferences | null = null;
const listeners = new Set<() => void>();

/** The settings, read from storage once, then kept up to date. */
export const readPreferences = () => {
	preferences ??= read();
	return preferences;
};

const notify = () => {
	for (const listener of listeners) {
		listener();
	}
};

export const setPreference = <K extends keyof TPreferences>(key: K, value: TPreferences[K]) => {
	// From the stored settings, so a change in another tab of the app since isn't overwritten.
	preferences = { ...read(), [key]: value };
	try {
		localStorage.setItem(KEY, JSON.stringify(preferences));
	} catch {
		// Storage unavailable (private mode etc.): it's remembered until the page closes.
	}
	notify();
};

/** Every setting back to its default. */
/** Every setting back to its default, or only `keys`. */
export const resetPreferences = (keys?: readonly (keyof TPreferences)[]) => {
	if (keys) {
		const next = { ...read() };
		for (const key of keys) {
			Object.assign(next, { [key]: DEFAULT_PREFERENCES[key] });
		}
		preferences = next;
		try {
			localStorage.setItem(KEY, JSON.stringify(next));
		} catch {
			// Storage unavailable: the defaults hold until the page closes.
		}
		notify();
		return;
	}
	preferences = DEFAULT_PREFERENCES;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// Storage unavailable: the defaults hold until the page closes.
	}
	notify();
};

/** Whether any of `keys` (all of them without) differs from its default. */
export const preferencesChanged = (current: TPreferences, keys?: readonly (keyof TPreferences)[]) =>
	(keys ?? (Object.keys(DEFAULT_PREFERENCES) as (keyof TPreferences)[])).some(
		(key) => current[key] !== DEFAULT_PREFERENCES[key],
	);

/** Another tab of the app changed them (or the storage was wiped): follow it. */
const onStorage = (event: StorageEvent) => {
	if (event.key === KEY || event.key === null) {
		preferences = parsePreferences(event.newValue);
		notify();
	}
};

/** Call `listener` whenever a setting changes, here or in another tab of the app. */
export const subscribePreferences = (listener: () => void) => {
	if (listeners.size === 0) {
		window.addEventListener("storage", onStorage);
	}
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			window.removeEventListener("storage", onStorage);
		}
	};
};

/** The overlays drawn over the view, each shown where its setting says. */
export type TOverlay = "navigationGizmo" | "viewLabel" | "compositionGrid" | "viewpointsInWorld";

/** Whether an overlay set to `place` shows in `mode`. */
export const overlayShownIn = (place: TOverlayPlace, mode: "edit" | "view") =>
	place === "both" || place === mode;

/** `place` with the overlay shown or not in `mode`, the other mode kept as it was. */
export const overlayPlaceWith = (
	place: TOverlayPlace,
	mode: "edit" | "view",
	shown: boolean,
): TOverlayPlace => {
	const other = mode === "edit" ? "view" : "edit";
	const inOther = overlayShownIn(place, other);
	if (shown) {
		return inOther ? "both" : mode;
	}
	return inOther ? other : "off";
};

/** The camera settings of this browser, updating when one changes. */
export const usePreferences = () =>
	useSyncExternalStore(subscribePreferences, readPreferences, () => DEFAULT_PREFERENCES);
