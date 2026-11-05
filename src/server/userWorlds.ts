import { compactWorld } from "#/parts/compactWorld";
import { repairWorld } from "#/parts/repairWorld";
import { validatePatchAlone } from "#/parts/validatePatchAlone";
import { type IWorldIssue, validateWorld } from "#/parts/validateWorld";
import { safeJson } from "#/scene/safeJson";
import { isWorldPatch } from "#/scene/worldPatch";

import {
	bytesOf,
	MOST_SHARED_WORLD_BYTES,
	sizeInWords,
	tooLongIn,
	tooManyInWorld,
} from "./shareLimits";
import { fitMetadata, isAdminToken, sameSecret } from "./sharingControls";
import { GZIP, gzipText, textOfStored } from "./storedText";

/**
 * Worlds shared by link (ADR-0120), kept in Cloudflare KV. Nothing is kept
 * unless someone asks (Share a link…, or an AI posting its answer), and what's
 * kept is public to anyone with its link until it expires. Each share is a
 * snapshot under a new random key, never overwritten, so KV's eventual
 * consistency can only mean "not there yet" (for up to a minute elsewhere in
 * the world), never an old version. Only worlds that read as worlds (stored as
 * read, defaults left out) and patches are kept, held to the limits in
 * `shareLimits.ts` (ADR-0145): it's not a place to keep anything else. Kept
 * gzipped since ADR-0145; plain-text entries kept before are still read. No
 * Cloudflare imports here: the routes pass the store in.
 */

/** What the routes hand in: the KV namespace, as much of it as is used. */
export interface IUserWorldStore {
	getWithMetadata: (
		key: string,
		type: "arrayBuffer",
	) => Promise<{ value: ArrayBuffer | null; metadata: IUserWorldMeta | null }>;
	put: (
		key: string,
		value: Uint8Array | string,
		options: { expirationTtl: number; metadata: IUserWorldMeta },
	) => Promise<void>;
	delete: (key: string) => Promise<void>;
}

/** Kept with each world: what it is, when it goes, and the hash of the key that deletes it. */
export interface IUserWorldMeta {
	kind: "world" | "patch";
	title: string;
	createdAt: string;
	expiresAt: string;
	/** SHA-256 of the delete key, never the key itself. */
	deleteKeyHash: string;
	/** "gzip" when kept gzipped (ADR-0145); left out by entries kept before, as plain text. */
	encoding?: typeof GZIP;
}

/** How long a shared world is kept, in seconds: an hour, a day, a week or 30 days. */
export const USER_WORLD_EXPIRIES = [3600, 86_400, 604_800, 2_592_000] as const;

/** Kept this long when the asker doesn't say: an AI handing back its answer. */
export const DEFAULT_USER_WORLD_EXPIRY = 3600;

/**
 * More than this isn't read: a world sent with its defaults written out can be a few times what
 * it is as kept, without them (at most MOST_SHARED_WORLD_BYTES).
 */
export const MOST_USER_WORLD_BYTES = 5_000_000;

/** A patch is only for handing changes back (ADR-0118): kept an hour at most, and this big at most. */
export const MOST_PATCH_SECONDS = 3600;
export const MOST_PATCH_BYTES = 500_000;

/** A shared world's id: 22 characters of 128 random bits, base64url. */
export const USER_WORLD_ID = /^[A-Za-z0-9_-]{22}$/;

/** `bytes` random bytes, base64url without padding. */
export const randomKey = (bytes: number) => {
	const random = crypto.getRandomValues(new Uint8Array(bytes));
	return btoa(String.fromCharCode(...random))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
};

/** SHA-256 of a text, as hex: what a delete key is kept as. */
export const sha256 = async (text: string) => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

/** Why a world wasn't kept, in words for whoever sent it. */
export class UserWorldError extends Error {
	/** What's wrong with it, where and what, when it was checked and refused. */
	readonly problems: IWorldIssue[];

	constructor(message: string, problems: IWorldIssue[] = []) {
		super(message);
		this.problems = problems;
	}
}

/** More problems than this aren't listed in a refusal. */
const PROBLEMS_LISTED = 40;

/** What sharing a world gives: where it is, until when, and the key that deletes it (shown once). */
export interface ISharedWorld {
	id: string;
	kind: IUserWorldMeta["kind"];
	/** The editor, opening it: /w/<id>. */
	url: string;
	/** The world as JSON, for AIs and tools: /api/user-worlds/<id>. */
	jsonUrl: string;
	expiresAt: string;
	deleteKey: string;
}

/** Keep a world (or a patch) sent as JSON text, for `expiresIn` seconds. */
export const shareUserWorld = async (
	store: IUserWorldStore,
	text: string,
	expiresIn: number,
	origin: string,
	now = new Date(),
): Promise<ISharedWorld> => {
	if (!(USER_WORLD_EXPIRIES as readonly number[]).includes(expiresIn)) {
		throw new UserWorldError(
			`Kept for 3600, 86400, 604800 or 2592000 seconds (an hour, a day, a week, 30 days), not ${expiresIn}.`,
		);
	}
	let parsed: unknown;
	try {
		parsed = safeJson(JSON.parse(text));
	} catch (error) {
		throw new UserWorldError(
			`It isn't JSON a world could be: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	// Before anything else is done with it: no text a page long, no list long enough to freeze
	// the tab of whoever opens it (ADR-0145).
	const tooMuch = tooLongIn(parsed) ?? tooManyInWorld(parsed);
	if (tooMuch) {
		throw new UserWorldError(
			`It holds more than can be shared: ${tooMuch.where}, ${tooMuch.what}.`,
			[tooMuch],
		);
	}
	let kept: string;
	let kind: IUserWorldMeta["kind"];
	let title: string;
	if (isWorldPatch(parsed)) {
		// Only for handing changes back: short-lived and small, and only a patch, checked on its own
		// (its fields the world's, its values ones they take); put in place, it's checked against
		// its world too.
		if (expiresIn > MOST_PATCH_SECONDS) {
			throw new UserWorldError(
				`A patch is kept for an hour at most (expiresIn ${MOST_PATCH_SECONDS}): it's only for handing changes back.`,
			);
		}
		if (bytesOf(text) > MOST_PATCH_BYTES) {
			throw new UserWorldError(
				`A patch is at most ${MOST_PATCH_BYTES / 1000} kB: for bigger changes, send the whole world.`,
			);
		}
		const problems = validatePatchAlone(parsed);
		if (problems.length > 0) {
			throw new UserWorldError(
				"It isn't a patch that can be kept: fix these and send it again.",
				problems.slice(0, PROBLEMS_LISTED),
			);
		}
		kind = "patch";
		title = "A patch";
		kept = JSON.stringify(parsed);
	} else {
		const check = validateWorld(parsed);
		if (check.isUnreadable) {
			throw new UserWorldError(
				`It isn't a world: ${check.problems[0]?.what ?? "it couldn't be read"}.`,
			);
		}
		// Kept only as written: a world that would need repairs is refused with its problems (the
		// same as POST /api/worlds/validate says), never repaired into something else.
		if (!check.isValid) {
			throw new UserWorldError(
				"The world doesn't open as written: fix these and send it again.",
				check.problems.slice(0, PROBLEMS_LISTED),
			);
		}
		const { scene } = repairWorld(parsed);
		kind = "world";
		title = scene.meta.title;
		kept = JSON.stringify(compactWorld(scene));
		const bytes = bytesOf(kept);
		if (bytes > MOST_SHARED_WORLD_BYTES) {
			throw new UserWorldError(
				`The world is ${sizeInWords(bytes)} as kept (its defaults left out): at most ${sizeInWords(MOST_SHARED_WORLD_BYTES)} can be shared. Fewer objects or less data would bring it under; Save to file sends a world of any size.`,
			);
		}
	}
	const id = randomKey(16);
	const deleteKey = randomKey(32);
	const expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();
	await store.put(id, await gzipText(kept), {
		expirationTtl: expiresIn,
		metadata: fitMetadata(
			{
				kind,
				title,
				createdAt: now.toISOString(),
				expiresAt,
				deleteKeyHash: await sha256(deleteKey),
				encoding: GZIP,
			},
			"title",
		),
	});
	return {
		id,
		kind,
		url: `${origin}/w/${id}`,
		jsonUrl: `${origin}/api/user-worlds/${id}`,
		expiresAt,
		deleteKey,
	};
};

/** A shared world's JSON and what's kept with it, or null (expired, deleted, or not there yet). */
export const readUserWorld = async (store: IUserWorldStore, id: string) => {
	if (!USER_WORLD_ID.test(id)) {
		return null;
	}
	const { value, metadata } = await store.getWithMetadata(id, "arrayBuffer");
	return value === null ? null : { json: await textOfStored(value), metadata };
};

/**
 * Delete a shared world with the key that came with it, or with the admin token (the
 * `ADMIN_DELETE_TOKEN` secret, for taking down what shouldn't be there: docs/runbooks/takedown.md).
 */
export const deleteUserWorld = async (
	store: IUserWorldStore,
	id: string,
	deleteKey: string,
	adminToken?: unknown,
): Promise<"deleted" | "gone" | "refused"> => {
	const found = await readUserWorld(store, id);
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
