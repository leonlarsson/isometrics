import { SCENE_VERSION, SceneSchema, type TScene } from "#/scene/schema";

/** Starting option: bare ground, with no objects, roads, areas or data. */
export const createEmptyScene = (): TScene =>
	SceneSchema.parse({ version: SCENE_VERSION, meta: { title: "Untitled world" } });
