import type { ThreeElements } from "@react-three/fiber";

import { PICK_ORDER, pickOrderData } from "./pickOrder";

/**
 * How the selected thing's handles (road, area and fence points, the handles
 * that add one, peaks, gates) are drawn and picked: on top of everything, so
 * one inside a building or under a raised area still shows, and first among
 * the things under the pointer (`pickOrder`), so it can be grabbed there. Just
 * under the move gizmo's order (`RENDER_ORDER`, 1000), which stays on top of them.
 */
export const HANDLE_ORDER = 900;

/** `userData` for a group of handles: they come before whatever they're on. */
export const HANDLE_PICK = pickOrderData(PICK_ORDER.handle);

/** A handle's material: unlit, drawn over whatever is in front of it. Pieces over another take a later `renderOrder`. */
export const HandleMaterial = (props: ThreeElements["meshBasicMaterial"]) => (
	<meshBasicMaterial depthTest={false} depthWrite={false} {...props} />
);
