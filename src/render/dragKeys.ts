import { readPreferences } from "#/editor/preferences";

/**
 * Whether a left drag with these keys held orbits the view (ADR-0156): with
 * Alt (Preferences: Alt + left-drag orbits), or with Shift when the
 * preferences say Shift orbits; never with Ctrl or Cmd, which copy.
 */
export const leftDragOrbits = (
	event: Pick<PointerEvent, "altKey" | "shiftKey" | "ctrlKey" | "metaKey">,
) => {
	if (event.ctrlKey || event.metaKey) {
		return false;
	}
	const { altDragOrbits, shiftDrag } = readPreferences();
	return (event.altKey && altDragOrbits) || (event.shiftKey && shiftDrag === "orbit");
};

/**
 * Whether a left drag with these keys held pans the view whatever it starts
 * on (ADR-0156): Shift, unless the preferences say Shift orbits. The gizmo and
 * handles let such a press through to the camera.
 */
export const shiftDragPans = (event: Pick<PointerEvent, "shiftKey" | "ctrlKey" | "metaKey">) =>
	event.shiftKey && !event.ctrlKey && !event.metaKey && readPreferences().shiftDrag === "pan";
