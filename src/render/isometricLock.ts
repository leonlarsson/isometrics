import { readPreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";
import { normalizeDegrees } from "#/lib/math";

import { currentView, ISOMETRIC_ELEVATION, runningFlight } from "./viewpoints";

/**
 * A world can keep the camera at the isometric angle, like a classic isometric
 * game (scene.camera.keepsIsometricAngle): the tilt stays put and the view
 * turns a quarter at a time, between the four diagonals. Free camera control
 * (Preferences) leaves the world's camera limits aside, this one too.
 */
export const keepsIsometricAngle = () =>
	useEditor.getState().scene.camera.keepsIsometricAngle &&
	readPreferences().cameraControl !== "free";

/** How far a drag goes, as a part of the view's height, before it turns the view a quarter. */
export const QUARTER_TURN_DRAG = 0.15;

/**
 * Glide a quarter turn round (positive: the way a positive orbit turn goes),
 * from the nearest diagonal, at the isometric tilt. While a glide is under
 * way it counts from where that one is going, so quick presses add up.
 */
export const turnIsometricView = (quarters: number) => {
	const { flight, glideTo } = useEditor.getState();
	const from = runningFlight.stop && flight ? flight.pose : currentView.read?.();
	if (!from) {
		return;
	}
	const diagonal = Math.round((from.azimuth - 45) / 90) * 90 + 45;
	glideTo({
		...from,
		azimuth: normalizeDegrees(diagonal + 90 * Math.sign(quarters) * Math.abs(Math.round(quarters))),
		elevation: ISOMETRIC_ELEVATION,
	});
};
