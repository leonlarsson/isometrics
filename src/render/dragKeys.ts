import { readPreferences } from "#/editor/preferences";

/**
 * Whether a left drag with these keys held orbits the view (ADR-0156): with
 * Alt or Shift, as the preferences say (Alt orbits by default, Shift
 * pans); never with Ctrl or Cmd, which copy.
 */
export const leftDragOrbits = (
	event: Pick<PointerEvent, "altKey" | "shiftKey" | "ctrlKey" | "metaKey">,
) => {
	if (event.ctrlKey || event.metaKey) {
		return false;
	}
	const { altDrag, shiftDrag } = readPreferences();
	return (event.altKey && altDrag === "orbit") || (event.shiftKey && shiftDrag === "orbit");
};

/**
 * Whether a left drag with these keys held is the camera's whatever it starts
 * on (ADR-0156): Shift, which pans or orbits as the preferences say. The gizmo
 * and handles let such a press through to the camera.
 */
export const shiftDragMovesView = (event: Pick<PointerEvent, "shiftKey" | "ctrlKey" | "metaKey">) =>
	event.shiftKey && !event.ctrlKey && !event.metaKey;
