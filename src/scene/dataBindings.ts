import type { TDataBinding, TEntity, TFence } from "./schema";

/**
 * Every place an object keeps data bindings (ADR-0058, ADR-0060): each
 * light's and each colour's `data`, a map from setting to binding. Anything
 * new that can follow data adds its maps here, and data renames and deletes,
 * and redrawing when a value changes, pick it up. Returned objects are the
 * object's own, so a store draft can change them in place.
 */
export const bindingMapsOf = (
	entity: Pick<TEntity, "lights" | "colors">,
): Record<string, TDataBinding>[] => [
	...(typeof entity.lights === "string" ? [] : Object.values(entity.lights).map((l) => l.data)),
	...Object.values(entity.colors).map((color) => color.data),
];

/** Whether any of an object's settings follow a data value. */
export const usesDataBindings = (entity: Pick<TEntity, "lights" | "colors">) =>
	bindingMapsOf(entity).some((map) => Object.keys(map).length > 0);

/** Every place a fence keeps data bindings (ADR-0103): its colours' and its own (`builtShare`). */
export const fenceBindingMapsOf = (
	fence: Pick<TFence, "colors" | "data">,
): Record<string, TDataBinding>[] => [
	fence.data,
	...Object.values(fence.colors).map((color) => color.data),
];
