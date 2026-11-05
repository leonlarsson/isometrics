import { repairWorld } from "#/parts/repairWorld";
import { safeJson } from "#/scene/safeJson";
import { SCENE_VERSION } from "#/scene/schema";

import {
	bytesOf,
	MOST_SHARED_PREFAB_BYTES,
	sizeInWords,
	tooLongIn,
	tooManyInPrefab,
} from "./shareLimits";
import { fitMetadata, isAdminToken, sameSecret } from "./sharingControls";
import { GZIP, gzipText, textOfStored } from "./storedText";
import { randomKey, sha256, USER_WORLD_EXPIRIES, USER_WORLD_ID } from "./userWorlds";

/**
 * Prefabs shared by link (ADR-0134), kept in Cloudflare KV as worlds shared
 * by link are (ADR-0120): only when someone asks (Share a link… on a prefab's
 * tile), public to anyone with the link until it expires, each share a
 * snapshot under a new random key, never overwritten. Only prefabs that read
 * as written are kept, held to the limits in `shareLimits.ts` (ADR-0145): it's
 * not a place to keep anything else. Kept gzipped since ADR-0145; plain-text
 * entries kept before are still read. No Cloudflare imports here: the routes
 * pass the store in.
 */

/** What the routes hand in: the KV namespace, as much of it as is used. */
export interface IUserPrefabStore {
	getWithMetadata: (
		key: string,
		type: "arrayBuffer",
	) => Promise<{ value: ArrayBuffer | null; metadata: IUserPrefabMeta | null }>;
	put: (
		key: string,
		value: Uint8Array | string,
		options: { expirationTtl: number; metadata: IUserPrefabMeta },
	) => Promise<void>;
	delete: (key: string) => Promise<void>;
}

/** Kept with each prefab: its name, when it goes, and the hash of the key that deletes it. */
export interface IUserPrefabMeta {
	name: string;
	createdAt: string;
	expiresAt: string;
	/** SHA-256 of the delete key, never the key itself. */
	deleteKeyHash: string;
	/** "gzip" when kept gzipped (ADR-0145); left out by entries kept before, as plain text. */
	encoding?: typeof GZIP;
}

/** How long a shared prefab is kept, in seconds: an hour, a day, a week or 30 days (as worlds). */
export const USER_PREFAB_EXPIRIES = USER_WORLD_EXPIRIES;

/** Kept this long when the asker doesn't say. */
export const DEFAULT_USER_PREFAB_EXPIRY = 604_800;

/**
 * More than this isn't read: a prefab is a few pieces, not a world (and is kept at most
 * MOST_SHARED_PREFAB_BYTES, as read).
 */
export const MOST_USER_PREFAB_BYTES = 1_000_000;

/** A shared prefab's id: 22 characters of 128 random bits, base64url, as a shared world's. */
export const USER_PREFAB_ID = USER_WORLD_ID;

/** Why a prefab wasn't kept, in words for whoever sent it. */
export class UserPrefabError extends Error {}

/** What sharing a prefab gives: where it is, until when, and the key that deletes it (shown once). */
export interface ISharedPrefab {
	id: string;
	/** The editor, opening it: /p/<id>. */
	url: string;
	/** The prefab as JSON: /api/user-prefabs/<id>. */
	jsonUrl: string;
	expiresAt: string;
	deleteKey: string;
}

/** Keep a prefab sent as JSON text, for `expiresIn` seconds. */
export const shareUserPrefab = async (
	store: IUserPrefabStore,
	text: string,
	expiresIn: number,
	origin: string,
	now = new Date(),
): Promise<ISharedPrefab> => {
	if (!(USER_PREFAB_EXPIRIES as readonly number[]).includes(expiresIn)) {
		throw new UserPrefabError(
			`Kept for 3600, 86400, 604800 or 2592000 seconds (an hour, a day, a week, 30 days), not ${expiresIn}.`,
		);
	}
	if (bytesOf(text) > MOST_USER_PREFAB_BYTES) {
		throw new UserPrefabError(`A prefab is at most ${MOST_USER_PREFAB_BYTES / 1000} kB.`);
	}
	let parsed: unknown;
	try {
		parsed = safeJson(JSON.parse(text));
	} catch (error) {
		throw new UserPrefabError(
			`It isn't JSON a prefab could be: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	// Before anything else is done with it: no text a page long, no list to freeze a tab (ADR-0145).
	const tooMuch = tooLongIn(parsed) ?? tooManyInPrefab(parsed);
	if (tooMuch) {
		throw new UserPrefabError(
			`It holds more than can be shared: ${tooMuch.where}, ${tooMuch.what}.`,
		);
	}
	// Read as a world holding it alone: kept only as written, never repaired into something else.
	let prefab: unknown;
	try {
		const { scene, report } = repairWorld({ version: SCENE_VERSION, prefabs: [parsed] });
		prefab = report === null ? scene.prefabs[0] : undefined;
	} catch {
		prefab = undefined;
	}
	if (!prefab || typeof prefab !== "object") {
		throw new UserPrefabError(
			"It isn't a prefab that reads as written: { id (starting with prefab_), name, description, entities, fences }, as in a world's prefabs (/api/worlds/schema).",
		);
	}
	const kept = JSON.stringify(prefab);
	const bytes = bytesOf(kept);
	if (bytes > MOST_SHARED_PREFAB_BYTES) {
		throw new UserPrefabError(
			`The prefab is ${sizeInWords(bytes)} as kept: at most ${sizeInWords(MOST_SHARED_PREFAB_BYTES)} can be shared. Fewer pieces would bring it under.`,
		);
	}
	const name = String((prefab as { name?: unknown }).name ?? "");
	const id = randomKey(16);
	const deleteKey = randomKey(32);
	const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();
	await store.put(id, await gzipText(kept), {
		expirationTtl: expiresIn,
		metadata: fitMetadata(
			{
				name,
				createdAt: now.toISOString(),
				expiresAt,
				deleteKeyHash: await sha256(deleteKey),
				encoding: GZIP,
			},
			"name",
		),
	});
	return {
		id,
		url: `${origin}/p/${id}`,
		jsonUrl: `${origin}/api/user-prefabs/${id}`,
		expiresAt,
		deleteKey,
	};
};

/** A shared prefab's JSON and what's kept with it, or null (expired, deleted, or not there yet). */
export const readUserPrefab = async (store: IUserPrefabStore, id: string) => {
	if (!USER_PREFAB_ID.test(id)) {
		return null;
	}
	const { value, metadata } = await store.getWithMetadata(id, "arrayBuffer");
	return value === null ? null : { json: await textOfStored(value), metadata };
};

/**
 * Delete a shared prefab with the key that came with it, or with the admin token (the
 * `ADMIN_DELETE_TOKEN` secret, for taking down what shouldn't be there: docs/runbooks/takedown.md).
 */
export const deleteUserPrefab = async (
	store: IUserPrefabStore,
	id: string,
	deleteKey: string,
	adminToken?: unknown,
): Promise<"deleted" | "gone" | "refused"> => {
	const found = await readUserPrefab(store, id);
	if (!found) {
		return "gone";
	}
	const isAllowed =
		(await isAdminToken(deleteKey, adminToken)) ||
		(found.metadata !== null &&
			(await sameSecret(await sha256(deleteKey), found.metadata.deleteKeyHash)));
	if (!isAllowed) {
		return "refused";
	}
	await store.delete(id);
	return "deleted";
};
