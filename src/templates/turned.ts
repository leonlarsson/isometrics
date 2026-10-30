import type { TVec3 } from "#/scene/schema";

/** An object's rotation turned this many degrees around the vertical (ADR-0104): `turned(90)`. */
export const turned = (degrees: number): TVec3 => [0, degrees, 0];
