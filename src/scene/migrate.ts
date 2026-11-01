import { upgradeLegacyIds } from "./legacy";
import { SCENE_VERSION, SceneSchema, type TScene } from "./schema";

/**
 * Parse an unknown value (from storage, a file, or an AI response) into a
 * valid Scene. Throws a ZodError (or Error) when the input cannot be used.
 *
 * Versioning (ADR-0106): the format changes in place and SCENE_VERSION stays 1;
 * renamed, moved and replaced fields are brought up to date first (legacy.ts,
 * and the parts' in parts/repairWorld.ts), and worlds that still don't validate
 * are repaired (repair.ts, ADR-0026). A change those can't make bumps the
 * version, with a step here from the version before, kept for good.
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
	return SceneSchema.parse(upgradeLegacyIds(input));
};
