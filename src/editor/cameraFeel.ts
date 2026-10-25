import { useSyncExternalStore } from "react";
import { z } from "zod";

import { APP_NAME } from "#/lib/app";

/**
 * How the camera feels to move, per browser: speeds, inverted zoom,
 * smoothing, glides. Personal, like the panel sizes, so it applies to every
 * world here and is never saved with one. See docs/adr/0062-camera-settings.md.
 *
 * When the settings change: nothing is migrated. A setting that can't be read
 * goes back to its default; the others are kept.
 */
const KEY = `${APP_NAME.toLowerCase()}:camera-feel`;

export const CameraFeelSchema = z.object({
	/** Turning and tilting with the mouse or a two-finger twist, × the usual speed. */
	orbitSpeed: z.number().min(0.2).max(3).catch(1),
	/** Zooming with the wheel, the middle button or a pinch, × the usual speed. */
	zoomSpeed: z.number().min(0.2).max(3).catch(1),
	/** Scrolling up zooms out instead of in. */
	invertZoom: z.boolean().catch(false),
	/** How long the camera keeps gliding after a move: 0 stops at once, 1 drifts a long way. */
	smoothing: z.number().min(0).max(1).catch(0.6),
	/** Seconds a glide to a viewpoint takes; 0 jumps there. */
	glideSeconds: z.number().min(0).max(3).catch(0.8),
	/** Moving the camera with the arrow keys, + and −, × the usual speed. */
	keyboardSpeed: z.number().min(0.2).max(3).catch(1),
	/** A rule-of-thirds grid over the view in Edit mode, for lining up viewpoints. */
	compositionGrid: z.boolean().catch(false),
});

export type TCameraFeel = z.output<typeof CameraFeelSchema>;

/** Every setting at its default. */
export const DEFAULT_CAMERA_FEEL: TCameraFeel = CameraFeelSchema.parse({});

/** Stored settings, each one that can't be read at its default. */
export const parseCameraFeel = (raw: string | null): TCameraFeel => {
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		return CameraFeelSchema.parse(typeof value === "object" && value !== null ? value : {});
	} catch {
		return DEFAULT_CAMERA_FEEL;
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
		return parseCameraFeel(localStorage.getItem(KEY));
	} catch {
		return DEFAULT_CAMERA_FEEL;
	}
};

let feel: TCameraFeel | null = null;
const listeners = new Set<() => void>();

/** The settings, read from storage once, then kept up to date. */
export const readCameraFeel = () => {
	feel ??= read();
	return feel;
};

const notify = () => {
	for (const listener of listeners) {
		listener();
	}
};

export const setCameraFeel = <K extends keyof TCameraFeel>(key: K, value: TCameraFeel[K]) => {
	// From the stored settings, so a change in another tab of the app since isn't overwritten.
	feel = { ...read(), [key]: value };
	try {
		localStorage.setItem(KEY, JSON.stringify(feel));
	} catch {
		// Storage unavailable (private mode etc.): it's remembered until the page closes.
	}
	notify();
};

/** Every setting back to its default. */
export const resetCameraFeel = () => {
	feel = DEFAULT_CAMERA_FEEL;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// Storage unavailable: the defaults hold until the page closes.
	}
	notify();
};

/** Another tab of the app changed them (or the storage was wiped): follow it. */
const onStorage = (event: StorageEvent) => {
	if (event.key === KEY || event.key === null) {
		feel = parseCameraFeel(event.newValue);
		notify();
	}
};

/** Call `listener` whenever a setting changes, here or in another tab of the app. */
export const subscribeCameraFeel = (listener: () => void) => {
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

/** The camera settings of this browser, updating when one changes. */
export const useCameraFeel = () =>
	useSyncExternalStore(subscribeCameraFeel, readCameraFeel, () => DEFAULT_CAMERA_FEEL);
