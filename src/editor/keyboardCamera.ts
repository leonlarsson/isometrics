import { keepOnHotReload } from "#/lib/hot";

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
	| "zoomOut"
	| "moveUp"
	| "moveDown";

/** A tap moves the camera this long, so it does something even if it's let go before a frame. */
const TAP_MS = 150;

interface IRunningMove {
	/** The key that keeps it going (KeyboardEvent.key, normalised like the hotkeys'). */
	key: string;
	/** It runs at least until then (performance.now() ms), held or not. */
	until: number;
}

/** The moves running now. */
export const runningCameraMoves = keepOnHotReload(
	"runningCameraMoves",
	() => new Map<TCameraMove, IRunningMove>(),
);

/**
 * The right mouse button held on the view: whether the keys moved the camera
 * during that press, so letting go doesn't open the right-click menu.
 */
export const rightButtonPress = keepOnHotReload("rightButtonPress", () => ({
	movedByKeys: false,
	/** How much the view showed (grid units, top to bottom) when it went down: sets flying speed. */
	span: 40,
}));

/** How much faster or slower than usual flying goes, set by scrolling while flying; kept between flights. */
export const flyingSpeed = keepOnHotReload("flyingSpeed", () => ({ factor: 1 }));

/** Scrolling while flying: each notch up 25% faster, down 25% slower, within 1/20× to 20×. */
export const changeFlyingSpeed = (wheelDeltaY: number) => {
	const notches = -Math.sign(wheelDeltaY);
	flyingSpeed.factor = Math.min(20, Math.max(0.05, flyingSpeed.factor * 1.25 ** notches));
};

/** Start a move; it runs until `key` is let go, and for at least a tap's time. */
export const startCameraMove = (move: TCameraMove, key: string) => {
	runningCameraMoves.set(move, { key, until: performance.now() + TAP_MS });
	rightButtonPress.movedByKeys = true;
};
