/** How far (px) a press must travel before it counts as a drag rather than a click. */
export const DRAG_THRESHOLD_PX = 6;

interface IScreenPoint {
	clientX: number;
	clientY: number;
}

/** Whether the pointer has moved far enough from where it was pressed to start a drag. */
export const pastDragThreshold = (from: IScreenPoint, to: IScreenPoint) =>
	Math.hypot(to.clientX - from.clientX, to.clientY - from.clientY) >= DRAG_THRESHOLD_PX;

/**
 * Whether an R3F click was a real click rather than the end of a camera drag.
 * `delta` is how far (px) the pointer travelled since it was pressed. Everything
 * in the scene selects or acts on a click, never on the press, so a pan or orbit
 * that starts over something never selects it.
 */
export const isClick = (event: { delta: number }) => event.delta < DRAG_THRESHOLD_PX;

/**
 * Hide the mouse cursor everywhere, or show it again, so it doesn't cover a
 * handle being placed precisely. Wins over every hover cursor (see styles.css).
 */
export const setCursorHidden = (hidden: boolean) => {
	document.documentElement.toggleAttribute("data-cursor-hidden", hidden);
};
