/**
 * How far (px) the perspective camera's view is shifted sideways, so a side
 * panel opening or folding doesn't move the world on screen (ADR-0055). The
 * diorama camera slides instead, which looks the same in that view; sliding a
 * perspective camera would change what it sees, so it shifts its projection.
 * Positive: the view's centre sits right of the canvas's centre.
 *
 * Back to 0 wherever the camera moves anyway: re-centring and framing,
 * switching cameras, gliding to a viewpoint and following a vehicle.
 */
export const viewShift = { x: 0 };

export const resetViewShift = () => {
	viewShift.x = 0;
};
