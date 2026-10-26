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
 * goes back to its default; the others are kept. A renamed one is read under
 * its old name too (RENAMED_PREFERENCES).
 */
const KEY = `${APP_NAME.toLowerCase()}:preferences`;

/** Where an overlay shows: nowhere, in one mode, or in both. */
export const OVERLAY_PLACES = ["off", "edit", "view", "both"] as const;
export type TOverlayPlace = (typeof OVERLAY_PLACES)[number];

const OverlayPlaceSchema = z.enum(OVERLAY_PLACES);

/** Graphics presets (ADR-0072, editor/graphics): standard is the view as it always was. */
export const GRAPHICS_PRESETS = ["standard", "nice", "ultra"] as const;
export type TGraphicsPreset = (typeof GRAPHICS_PRESETS)[number];

/** Ambient occlusion: none, or at half or full resolution. */
export const AMBIENT_OCCLUSION_MODES = ["off", "halfResolution", "fullResolution"] as const;
export type TAmbientOcclusion = (typeof AMBIENT_OCCLUSION_MODES)[number];

/** The canvas's own multisampling, or SMAA in the effects composer. */
export const ANTI_ALIASING_MODES = ["multisample", "smaa"] as const;
export type TAntiAliasing = (typeof ANTI_ALIASING_MODES)[number];

/** How many lights, nearest the view, light their surroundings as real lights. */
export const REAL_LIGHT_COUNTS = [0, 8, 16, 32, 64] as const;
export type TRealLightCount = (typeof REAL_LIGHT_COUNTS)[number];

/** Pixels per side of the sun's shadow map: more is sharper. */
export const SHADOW_MAP_SIZES = [2048, 4096] as const;
export type TShadowMapSize = (typeof SHADOW_MAP_SIZES)[number];

/** The highest number of device pixels per CSS pixel the view draws at. */
export const PIXEL_DENSITIES = [1, 1.5, 2] as const;
export type TPixelDensity = (typeof PIXEL_DENSITIES)[number];

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
	cameraSmoothing: z.number().min(0).max(1).catch(0.6),
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
	namesOfCopies: z.enum(["copy", "numbered"]).catch("copy"),
	/** The Graphics page's preset (ADR-0072); the graphics settings below follow it while null. */
	graphicsPreset: z.enum(GRAPHICS_PRESETS).catch("standard"),
	/** Darkening where things meet: off, at half or at full resolution. null = the preset's. */
	ambientOcclusion: z.enum(AMBIENT_OCCLUSION_MODES).nullable().catch(null),
	/** A glow round lit windows, lamps and headlights, as strong as it's dark. null = the preset's. */
	showGlowAfterDark: z.boolean().nullable().catch(null),
	/** How many lights nearest the view light the streets, walls and water round them. null = the preset's. */
	realLightCount: z
		.union(REAL_LIGHT_COUNTS.map((count) => z.literal(count)))
		.nullable()
		.catch(null),
	/** Water mirrors the world round it, broken by drifting ripples. null = the preset's. */
	showWaterReflections: z.boolean().nullable().catch(null),
	/** A colour grade on the finished picture: richer colour, a vignette, warm lights at night. null = the preset's. */
	useColorGrade: z.boolean().nullable().catch(null),
	/** Pixels per side of the sun's shadow map, 2048 or 4096. null = the preset's. */
	shadowMapSize: z
		.union(SHADOW_MAP_SIZES.map((size) => z.literal(size)))
		.nullable()
		.catch(null),
	/** Soft-edged shadows. null = the preset's. */
	useSoftShadows: z.boolean().nullable().catch(null),
	/** Smoothing jagged edges: the canvas's multisampling, or SMAA. null = the preset's. */
	antiAliasing: z.enum(ANTI_ALIASING_MODES).nullable().catch(null),
	/** The most device pixels per CSS pixel the view draws: 1, 1.5 or 2. null = the preset's. */
	maxPixelDensity: z
		.union(PIXEL_DENSITIES.map((density) => z.literal(density)))
		.nullable()
		.catch(null),
});

export type TPreferences = z.output<typeof PreferencesSchema>;

/** Every setting at its default. */
export const DEFAULT_PREFERENCES: TPreferences = PreferencesSchema.parse({});

/** Old names of renamed settings, and their names now (ADR-0071). Never remove an entry. */
const RENAMED_PREFERENCES: Readonly<Record<string, keyof TPreferences>> = {
	smoothing: "cameraSmoothing",
	copyNames: "namesOfCopies",
};

/** Stored settings, each one that can't be read at its default. */
export const parsePreferences = (raw: string | null): TPreferences => {
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		const stored: Record<string, unknown> =
			typeof value === "object" && value !== null ? { ...value } : {};
		for (const [from, to] of Object.entries(RENAMED_PREFERENCES)) {
			if (from in stored && !(to in stored)) {
				stored[to] = stored[from];
			}
			delete stored[from];
		}
		return PreferencesSchema.parse(stored);
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
