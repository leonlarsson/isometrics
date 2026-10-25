/**
 * Moving the camera with the keyboard (ADR-0062): a shortcut (editor/useShortcuts)
 * starts a move, and render/KeyboardCamera carries it on every frame for as long
 * as its key is held, so holding an arrow glides instead of stepping.
 */

export type TCameraMove =
	| "panLeft"
	| "panRight"
	| "panForward"
	| "panBack"
	| "turnLeft"
	| "turnRight"
	| "tiltUp"
	| "tiltDown"
	| "zoomIn"
	| "zoomOut";

/** A tap moves the camera this long, so it does something even if it's let go before a frame. */
const TAP_MS = 150;

interface IRunningMove {
	/** The key that keeps it going (KeyboardEvent.key, normalised like the hotkeys'). */
	key: string;
	/** It runs at least until then (performance.now() ms), held or not. */
	until: number;
}

/** The moves running now. */
export const runningCameraMoves = new Map<TCameraMove, IRunningMove>();

/** Start a move; it runs until `key` is let go, and for at least a tap's time. */
export const startCameraMove = (move: TCameraMove, key: string) => {
	runningCameraMoves.set(move, { key, until: performance.now() + TAP_MS });
};
