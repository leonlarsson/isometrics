import { keepOnHotReload } from "#/lib/hot";

/**
 * Where the camera looks right now, for the overlays drawn over the view
 * (the navigation gizmo, the view label): written every frame by
 * render/CameraReadout, read without re-rendering React. Plus the camera
 * moves those overlays can ask for, set by render/CameraControls.
 * See docs/adr/0062-camera-settings.md.
 */
export const liveCamera = keepOnHotReload("liveCamera", () => ({
	/** Compass direction it looks from, degrees counter-clockwise from +x seen from above. */
	azimuth: 315,
	/** Degrees above the ground. */
	elevation: 32.5,
	/** The perspective camera's field of view (degrees), or null in the diorama view. */
	fieldOfView: null as number | null,
}));

export const cameraCommands = keepOnHotReload("cameraCommands", () => ({
	/** Turn (around the vertical) and tilt the view around its centre, in radians. */
	orbit: null as ((turn: number, tilt: number) => void) | null,
}));
