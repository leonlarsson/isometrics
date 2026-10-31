import { z } from "zod";

import { APP_NAME } from "#/lib/app";

import { SceneSchema } from "./schema";

/**
 * The scene format as JSON Schema, generated from `SceneSchema` so it never
 * drifts. Describes what a hand-written file may contain: fields with defaults
 * are optional. /api/worlds/schema serves it completed with the parts (parts/jsonSchema.ts).
 */
export const sceneJsonSchema = () => ({
	...z.toJSONSchema(SceneSchema, { io: "input", target: "draft-2020-12" }),
	title: `${APP_NAME} world`,
	description: `A world (scene document) for ${APP_NAME}. Fields with a default may be left out.`,
});
