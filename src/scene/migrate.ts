import { SCENE_VERSION, SceneSchema, type TScene } from "./schema";

/**
 * Parse an unknown value (from storage, a file, or an AI response) into a
 * valid Scene. Throws a ZodError (or Error) when the input cannot be used.
 *
 * Versioning: while the app is unreleased the schema changes in place and
 * SCENE_VERSION stays 1. Once scenes exist in the wild, bump the version on
 * breaking changes and migrate older documents here before validating.
 */
export const parseScene = (input: unknown): TScene => {
	if (typeof input !== "object" || input === null) {
		throw new Error("Scene must be a JSON object");
	}
	const version = (input as { version?: unknown }).version;
	if (typeof version !== "number") {
		throw new Error("Scene is missing a numeric `version`");
	}
	if (version > SCENE_VERSION) {
		throw new Error(`Scene version ${version} is newer than this app supports (${SCENE_VERSION})`);
	}
	return SceneSchema.parse(input);
};
