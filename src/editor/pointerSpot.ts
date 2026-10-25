import { keepOnHotReload } from "#/lib/hot";
import type { TVec2 } from "#/scene/schema";

/**
 * Where on the ground the mouse pointer is, for pasting there (ADR-0068).
 * render/PointerSpot fills in `read`, which works it out from the pointer's
 * last place on screen and the camera as it is now (it may have moved since),
 * or gives null while the pointer isn't over the world.
 */
export const pointerSpot = keepOnHotReload("pointerSpot", () => ({
	read: null as (() => TVec2 | null) | null,
}));
