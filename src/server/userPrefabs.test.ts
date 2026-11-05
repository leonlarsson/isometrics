import { describe, expect, it } from "vitest";

import { MOST_METADATA_BYTES } from "./sharingControls";
import { isGzip } from "./storedText";
import {
	deleteUserPrefab,
	type IUserPrefabMeta,
	type IUserPrefabStore,
	MOST_USER_PREFAB_BYTES,
	readUserPrefab,
	shareUserPrefab,
	USER_PREFAB_ID,
	UserPrefabError,
} from "./userPrefabs";

/** An in-memory KV namespace, keeping what was put (as bytes, as KV does) and how long for. */
const memoryStore = () => {
	const kept = new Map<string, { value: Uint8Array; metadata: IUserPrefabMeta; ttl: number }>();
	const store: IUserPrefabStore = {
		getWithMetadata: async (key) => {
			const found = kept.get(key);
			return {
				value: found ? (found.value.slice().buffer as ArrayBuffer) : null,
				metadata: found?.metadata ?? null,
			};
		},
		put: async (key, value, { expirationTtl, metadata }) => {
			const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
			kept.set(key, { value: bytes, metadata, ttl: expirationTtl });
		},
		delete: async (key) => {
			kept.delete(key);
		},
	};
	return { store, kept };
};

const ORIGIN = "https://example.test";
const prefab = (extra: Record<string, unknown> = {}) =>
	JSON.stringify({
		id: "prefab_kiosk",
		name: "Kiosk",
		entities: [{ id: "box", kind: "box_01" }],
		...extra,
	});

describe("prefabs shared by link (ADR-0134)", () => {
	it("keep a prefab under a new unguessable key, for as long as asked, with its links", async () => {
		const { store, kept } = memoryStore();
		const now = new Date("2026-11-03T12:00:00Z");
		const shared = await shareUserPrefab(store, prefab(), 86_400, ORIGIN, now);
		expect(shared.id).toMatch(USER_PREFAB_ID);
		expect(shared.url).toBe(`${ORIGIN}/p/${shared.id}`);
		expect(shared.jsonUrl).toBe(`${ORIGIN}/api/user-prefabs/${shared.id}`);
		expect(shared.expiresAt).toBe("2026-11-04T12:00:00.000Z");
		const entry = kept.get(shared.id);
		expect(entry?.ttl).toBe(86_400);
		expect(entry?.metadata.name).toBe("Kiosk");
		// The delete key itself is never kept, only its hash.
		expect(JSON.stringify(entry)).not.toContain(shared.deleteKey);
		const again = await shareUserPrefab(store, prefab(), 86_400, ORIGIN, now);
		expect(again.id).not.toBe(shared.id);
		expect(kept.size).toBe(2);
	});

	it("reads it back, and deletes it only with its key", async () => {
		const { store } = memoryStore();
		const shared = await shareUserPrefab(store, prefab(), 3600, ORIGIN);
		const found = await readUserPrefab(store, shared.id);
		expect(JSON.parse(found?.json ?? "{}")).toMatchObject({ id: "prefab_kiosk", name: "Kiosk" });
		expect(await readUserPrefab(store, "not an id")).toBeNull();
		expect(await deleteUserPrefab(store, shared.id, "wrong")).toBe("refused");
		expect(await deleteUserPrefab(store, shared.id, shared.deleteKey)).toBe("deleted");
		expect(await deleteUserPrefab(store, shared.id, shared.deleteKey)).toBe("gone");
	});

	it("refuses what isn't a prefab as written, too long a time, or too much", async () => {
		const { store, kept } = memoryStore();
		const refused = (text: string, seconds = 3600) =>
			expect(shareUserPrefab(store, text, seconds, ORIGIN)).rejects.toBeInstanceOf(UserPrefabError);
		await refused("{nope");
		await refused(JSON.stringify({ id: "kiosk" }));
		await refused(prefab({ entities: [{ id: "box", kind: "box_01", scale: "huge" }] }));
		await refused(prefab(), 5);
		await refused(prefab({ description: "x".repeat(MOST_USER_PREFAB_BYTES) }));
		expect(kept.size).toBe(0);
	});
});

describe("how a shared prefab is kept (ADR-0145)", () => {
	const refusal = async (text: string) => {
		const { store, kept } = memoryStore();
		const error = await shareUserPrefab(store, text, 3600, ORIGIN).catch(
			(caught: unknown) => caught,
		);
		expect(kept.size).toBe(0);
		expect(error).toBeInstanceOf(UserPrefabError);
		return (error as UserPrefabError).message;
	};
	const pieces = (count: number, extra: Record<string, unknown> = {}) =>
		Array.from({ length: count }, (_, i) => ({ id: `piece_${i}`, kind: "box_01", ...extra }));

	it("refuse a prefab bigger than 300 kB as kept, in words", async () => {
		expect(
			await refusal(prefab({ entities: pieces(1900, { name: "A piece with a name ".repeat(5) }) })),
		).toMatch(/as kept: at most 300 kB/);
	});

	it("keep it gzipped, read old plain entries, and fit any name in metadata", async () => {
		const { store, kept } = memoryStore();
		const shared = await shareUserPrefab(store, prefab({ name: "😀\n".repeat(600) }), 3600, ORIGIN);
		const entry = kept.get(shared.id);
		expect(entry && isGzip(entry.value)).toBe(true);
		expect(new TextEncoder().encode(JSON.stringify(entry?.metadata)).length).toBeLessThanOrEqual(
			MOST_METADATA_BYTES,
		);
		expect(entry?.metadata.name).not.toContain("\n");
		expect(JSON.parse((await readUserPrefab(store, shared.id))?.json ?? "{}").id).toBe(
			"prefab_kiosk",
		);
		const old = "B".repeat(22);
		await store.put(old, prefab(), {
			expirationTtl: 3600,
			metadata: { name: "Kiosk", createdAt: "", expiresAt: "", deleteKeyHash: "0" },
		});
		expect((await readUserPrefab(store, old))?.json).toBe(prefab());
	});
});
