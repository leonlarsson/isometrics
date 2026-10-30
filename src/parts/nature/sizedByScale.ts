import { z } from "zod";

import type { TFieldSpec } from "../types";

/**
 * What nature parts have instead of a size of their own: an object's scale
 * sizes them (ADR-0104). They once had a `size` that did just what the scale
 * does, folded into the scale when a world is opened. Brightwater and Monaco
 * saved by 387d004 stored it as `letterHeight` (the text sign's renamed size,
 * applied to the trees by mistake); the first of the two that's there counts.
 */
export const sizedByScale = {
	schema: z.object({}),
	fields: [] as TFieldSpec<never>[],
	foldedIntoScale: ["size", "letterHeight"],
	removedProps: ["size", "letterHeight"],
};
