import type { TColorSetting, TDataBinding, TEntity, TFence, TScene } from "./schema";

/**
 * Every place an object keeps data bindings (ADR-0058, ADR-0060, ADR-0109):
 * its sizes' and props' (`data`), each light's and each colour's `data`, a map from setting to binding. Anything
 * new that can follow data adds its maps here, and data renames and deletes,
 * and redrawing when a value changes, pick it up. Returned objects are the
 * object's own, so a store draft can change them in place.
 */
export const bindingMapsOf = (
	entity: Pick<TEntity, "lights" | "colors" | "data">,
): Record<string, TDataBinding>[] => [
	entity.data,
	...Object.values(entity.lights).map((light) => light.data),
	...colorBindingMapsOf(entity.colors),
];

/** Whether any of an object's settings follow a data value, or it follows a table row. */
export const usesDataBindings = (entity: Pick<TEntity, "lights" | "colors" | "data" | "dataRow">) =>
	entity.dataRow !== null || bindingMapsOf(entity).some((map) => Object.keys(map).length > 0);

/** Every place a fence keeps data bindings (ADR-0103): its colours' and its own (`builtShare`). */
export const fenceBindingMapsOf = (
	fence: Pick<TFence, "colors" | "data">,
): Record<string, TDataBinding>[] => [fence.data, ...colorBindingMapsOf(fence.colors)];

/** The data bindings of each colour in a `colors` map (ADR-0060). */
export const colorBindingMapsOf = (
	colors: Readonly<Record<string, TColorSetting>>,
): Record<string, TDataBinding>[] => Object.values(colors).map((color) => color.data);

/**
 * Every place the world keeps data bindings besides its objects and fences:
 * the time of day and the weather, each mood's too, the colours of the
 * ground, the roads and the areas (ADR-0104), and roads' widths and flows
 * (ADR-0112).
 */
export const worldBindingMapsOf = (
	scene: Pick<TScene, "lighting" | "weather" | "moods" | "ground" | "roads" | "areas">,
): Record<string, TDataBinding>[] => [
	scene.lighting.data,
	scene.weather.data,
	...scene.moods.flatMap((mood) => [mood.lighting.data, mood.weather.data]),
	...colorBindingMapsOf(scene.ground.colors),
	...scene.roads.flatMap((road) => [road.data, ...colorBindingMapsOf(road.colors)]),
	...scene.areas.flatMap((area) => colorBindingMapsOf(area.colors)),
];
