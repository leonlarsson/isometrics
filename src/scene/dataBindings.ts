import type {
	TArea,
	TColorSetting,
	TDataBinding,
	TEntity,
	TFence,
	TPrefab,
	TRoad,
	TScene,
} from "./schema";

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

/**
 * Every place a fence keeps data bindings (ADR-0103, ADR-0133): its colours',
 * its own (`builtShare`) and each gate's (`isOpen`).
 */
export const fenceBindingMapsOf = (
	fence: Pick<TFence, "colors" | "data" | "gates">,
): Record<string, TDataBinding>[] => [
	fence.data,
	...colorBindingMapsOf(fence.colors),
	...fence.gates.map((gate) => gate.data),
];

/** The data bindings of each colour in a `colors` map (ADR-0060). */
export const colorBindingMapsOf = (
	colors: Readonly<Record<string, TColorSetting>>,
): Record<string, TDataBinding>[] => Object.values(colors).map((color) => color.data);

/** A road's data bindings: its own (width, flow) and its colours'. */
export const roadBindingMapsOf = (
	road: Pick<TRoad, "data" | "colors">,
): Record<string, TDataBinding>[] => [road.data, ...colorBindingMapsOf(road.colors)];

/** An area's data bindings: its colours' and its own weather's (ADR-0151). */
export const areaBindingMapsOf = (
	area: Pick<TArea, "colors" | "weather">,
): Record<string, TDataBinding>[] => [
	...colorBindingMapsOf(area.colors),
	...(area.weather ? [area.weather.data] : []),
];

/**
 * Every place the world keeps data bindings besides its objects and fences:
 * the time of day and the weather, each mood's too, the colours of the
 * grounds (each, ADR-0155), the roads and the areas (ADR-0104), roads' widths and flows
 * (ADR-0112), and every binding of the prefabs' pieces (ADR-0134).
 */
export const worldBindingMapsOf = (
	scene: Pick<TScene, "lighting" | "weather" | "moods" | "grounds" | "roads" | "areas" | "prefabs">,
): Record<string, TDataBinding>[] => [
	scene.lighting.data,
	scene.weather.data,
	...scene.moods.flatMap((mood) => [mood.lighting.data, mood.weather.data]),
	...scene.grounds.flatMap((ground) => colorBindingMapsOf(ground.colors)),
	...scene.roads.flatMap(roadBindingMapsOf),
	...scene.areas.flatMap(areaBindingMapsOf),
	...scene.prefabs.flatMap(prefabBindingMapsOf),
];

/** A prefab's data bindings: its pieces', objects' and fences' alike (ADR-0134). */
export const prefabBindingMapsOf = (
	prefab: Pick<TPrefab, "entities" | "fences">,
): Record<string, TDataBinding>[] => [
	...prefab.entities.flatMap(bindingMapsOf),
	...prefab.fences.flatMap(fenceBindingMapsOf),
];

/** Whether any of a prefab's pieces follow data. */
export const prefabUsesData = (prefab: Pick<TPrefab, "entities" | "fences">) =>
	prefab.entities.some(usesDataBindings) ||
	prefabBindingMapsOf(prefab).some((map) => Object.keys(map).length > 0);
