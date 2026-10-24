import type { TEntityInput } from "#/scene/schema";

/**
 * An object's colours by id from plain hex values (ADR-0060), leaving out
 * those that are null (the part's own): `paint({ roof: "#c0392b" })`.
 */
export const paint = (byId: Record<string, string | null>): TEntityInput["colors"] =>
	Object.fromEntries(
		Object.entries(byId).flatMap(([id, color]) => (color === null ? [] : [[id, { color }]])),
	);
