import { readPreferences } from "#/editor/preferences";

/**
 * Whether a left drag with these keys held orbits the view (ADR-0156): with
 * Shift when the preferences say Shift orbits (it pans by default); never with
 * Ctrl or Cmd, which copy.
 */
export const leftDragOrbits = (event: Pick<PointerEvent, "shiftKey" | "ctrlKey" | "metaKey">) =>
	event.shiftKey && !event.ctrlKey && !event.metaKey && readPreferences().shiftDrag === "orbit";

/**
 * Whether a left drag with these keys held is the camera's whatever it starts
 * on (ADR-0156): Shift, which pans or orbits as the preferences say. The gizmo
 * and handles let such a press through to the camera.
 */
export const shiftDragMovesView = (event: Pick<PointerEvent, "shiftKey" | "ctrlKey" | "metaKey">) =>
	event.shiftKey && !event.ctrlKey && !event.metaKey;
