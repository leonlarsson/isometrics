import { SCENE_VERSION, SceneSchema, type TScene } from "./schema";

/**
 * Parse an unknown value (from storage, a file, or an AI response) into a
 * valid Scene. Older versions are migrated step by step before validation.
 * Throws a ZodError (or Error) when the input cannot be used.
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

	// Add migrations here as the schema evolves, e.g.
	// if (version === 1) input = migrateV1toV2(input)
	return SceneSchema.parse(input);
};
