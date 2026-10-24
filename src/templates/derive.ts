import { type Draft, produce } from "immer";

import { SceneSchema, type TScene } from "#/scene/schema";

/**
 * A template made from another: the base template's world, built fresh, with
 * only what differs changed, then checked like any world. Later changes to the
 * base flow through, so the two never drift apart.
 *
 *     export const createBrightwaterAtDuskScene = deriveTemplate(createBrightwaterScene, (scene) => {
 *         scene.meta.title = "Brightwater at dusk";
 *         scene.lighting.timeSource = "cycle";
 *         scene.lighting.time = 17.5;
 *     });
 *
 * Register it in index.ts like any template; the schema test checks it too.
 */
export const deriveTemplate = (base: () => TScene, change: (scene: Draft<TScene>) => void) => {
	return (): TScene => {
		return SceneSchema.parse(produce(base(), change));
	};
};
