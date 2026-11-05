import { describe, expect, it } from "vitest";

import { compactWorld } from "#/parts/compactWorld";
import { createEmptyScene, TEMPLATES } from "#/templates";

import { MOST_SHARED_WORLD_BYTES } from "./shareLimits";
import { MOST_METADATA_BYTES } from "./sharingControls";
import { isGzip } from "./storedText";
import {
	deleteUserWorld,
	type IUserWorldMeta,
	type IUserWorldStore,
	readUserWorld,
	shareUserWorld,
	USER_WORLD_ID,
	UserWorldError,
} from "./userWorlds";

/** An in-memory KV namespace, keeping what was put (as bytes, as KV does) and how long for. */
const memoryStore = () => {
	const kept = new Map<string, { value: Uint8Array; metadata: IUserWorldMeta; ttl: number }>();
	const store: IUserWorldStore = {
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
const world = () => JSON.stringify(createEmptyScene({ title: "Harbour" }));

describe("worlds shared by link (ADR-0120)", () => {
	it("keep a world under a new unguessable key, for as long as asked, with its links", async () => {
		const { store, kept } = memoryStore();
		const shared = await shareUserWorld(
			store,
			world(),
			604_800,
			ORIGIN,
			new Date("2026-10-31T12:00:00Z"),
		);
		expect(shared.id).toMatch(USER_WORLD_ID);
		expect(shared.url).toBe(`${ORIGIN}/w/${shared.id}`);
		expect(shared.jsonUrl).toBe(`${ORIGIN}/api/user-worlds/${shared.id}`);
		expect(shared.expiresAt).toBe("2026-11-07T12:00:00.000Z");
		const entry = kept.get(shared.id);
		expect(entry?.ttl).toBe(604_800);
		expect(entry?.metadata.title).toBe("Harbour");
		// The delete key itself is never kept, only its hash.
		expect(JSON.stringify(entry)).not.toContain(shared.deleteKey);
		const again = await shareUserWorld(store, world(), 3600, ORIGIN);
		expect(again.id).not.toBe(shared.id);
	});

	it("keep worlds as read, defaults left out, and patches as they came", async () => {
		const { store } = memoryStore();
		const shared = await shareUserWorld(store, world(), 3600, ORIGIN);
		const found = await readUserWorld(store, shared.id);
		expect(JSON.parse(found?.json ?? "{}").meta.title).toBe("Harbour");
		expect(found?.json.length).toBeLessThan(world().length);
		const patch = await shareUserWorld(
			store,
			'{"isPatch": true, "lighting": {"time": 19}, "__proto__": {"x": 1}}',
			3600,
			ORIGIN,
		);
		expect(patch.kind).toBe("patch");
		expect((await readUserWorld(store, patch.id))?.json).toBe(
			'{"isPatch":true,"lighting":{"time":19}}',
		);
	});

	it("refuse what isn't a world or a patch, and expiries that aren't offered", async () => {
		const { store, kept } = memoryStore();
		await expect(shareUserWorld(store, "not json", 3600, ORIGIN)).rejects.toThrow(UserWorldError);
		await expect(shareUserWorld(store, '{"hello": "there"}', 3600, ORIGIN)).rejects.toThrow(
			"isn't a world",
		);
		await expect(shareUserWorld(store, world(), 60, ORIGIN)).rejects.toThrow("not 60");
		expect(kept.size).toBe(0);
	});

	it("keep only a patch that is one: the world's fields, lists by remove, change and add, values they take", async () => {
		const { store, kept } = memoryStore();
		const share = (patch: unknown, seconds = 3600) =>
			shareUserWorld(
				store,
				JSON.stringify({ isPatch: true, ...(patch as object) }),
				seconds,
				ORIGIN,
			);
		const good = await share({
			meta: { title: "Renamed" },
			entities: {
				remove: ["old_shed"],
				change: [{ id: "lighthouse", scale: 1.5, name: null }],
				add: [{ id: "boat", kind: "sailing_boat_01", position: [4, 2] }],
			},
			data: { values: { change: [{ key: "visitors", value: 12 }] } },
		});
		expect(good.kind).toBe("patch");
		const refusedFor = async (patch: unknown, seconds?: number) => {
			const error = await share(patch, seconds).catch((caught: unknown) => caught);
			expect(error).toBeInstanceOf(UserWorldError);
			const { message, problems } = error as UserWorldError;
			return `${message} ${problems.map((each) => `${each.where}: ${each.what}`).join(" | ")}`;
		};
		expect(await refusedFor({ payload: "anything at all" })).toMatch(
			/payload: isn't a field of the world/,
		);
		expect(await refusedFor({ entities: { replace: [] } })).toMatch(/entities\.replace/);
		expect(await refusedFor({ entities: { change: [{ id: "a", stash: "x" }] } })).toMatch(
			/change\[0\]\.stash: isn't a field/,
		);
		expect(await refusedFor({ entities: { change: [{ id: "a", scale: "huge" }] } })).toMatch(
			/change\[0\]\.scale/,
		);
		expect(await refusedFor({ entities: { change: [{ scale: 2 }] } })).toMatch(/names its thing/);
		expect(
			await refusedFor({ entities: { add: [{ id: "x", kind: "house_01", position: "here" }] } }),
		).toMatch(/position/);
		expect(await refusedFor({ data: { secrets: 1 } })).toMatch(/data\.secrets/);
		// Only for handing changes back: an hour at most, 500 kB at most.
		expect(await refusedFor({ meta: { title: "x" } }, 86_400)).toMatch(/an hour at most/);
		expect(await refusedFor({ meta: { title: "x".repeat(600_000) } })).toMatch(/500 kB/);
		expect(kept.size).toBe(1);
	});

	it("refuse a world that would need repairs, listing its problems", async () => {
		const { store, kept } = memoryStore();
		const broken = { ...createEmptyScene({ title: "Broken" }) } as Record<string, unknown>;
		broken.entities = [{ id: "a", kind: "house_01", position: [0, 0], scale: "huge" }];
		const error = await shareUserWorld(store, JSON.stringify(broken), 3600, ORIGIN).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(UserWorldError);
		expect((error as UserWorldError).message).toMatch(/doesn't open as written/);
		expect((error as UserWorldError).problems.length).toBeGreaterThan(0);
		expect(kept.size).toBe(0);
	});

	it("delete only with the key that came with it", async () => {
		const { store } = memoryStore();
		const shared = await shareUserWorld(store, world(), 3600, ORIGIN);
		expect(await deleteUserWorld(store, shared.id, "guess")).toBe("refused");
		expect(await deleteUserWorld(store, shared.id, shared.deleteKey)).toBe("deleted");
		expect(await readUserWorld(store, shared.id)).toBeNull();
		expect(await deleteUserWorld(store, shared.id, shared.deleteKey)).toBe("gone");
	});

	it("never look up an id that isn't one", async () => {
		const { store } = memoryStore();
		expect(await readUserWorld(store, "../../etc")).toBeNull();
	});
});

describe("how a shared world is kept (ADR-0145)", () => {
	const refusal = async (scene: unknown) => {
		const { store, kept } = memoryStore();
		const error = await shareUserWorld(store, JSON.stringify(scene), 3600, ORIGIN).catch(
			(caught: unknown) => caught,
		);
		expect(kept.size).toBe(0);
		expect(error).toBeInstanceOf(UserWorldError);
		return (error as UserWorldError).message;
	};

	it("keep every template and old world as it is", async () => {
		const { store } = memoryStore();
		for (const template of TEMPLATES) {
			const shared = await shareUserWorld(store, JSON.stringify(template.create()), 3600, ORIGIN);
			expect(shared.kind, template.id).toBe("world");
		}
	});

	it("refuse a world bigger than 1.5 MB as kept, in words", async () => {
		const scene = createEmptyScene({ title: "Heavy" });
		const entities = Array.from({ length: 9000 }, (_, i) => ({
			id: `object_${i}`,
			kind: "house_01",
			name: `A house with a long enough name to weigh something, number ${i}`,
			position: [i, i],
			details: { description: "d".repeat(120) },
		}));
		const heavy = { ...scene, entities };
		expect(JSON.stringify(compactWorld(heavy as never)).length).toBeGreaterThan(
			MOST_SHARED_WORLD_BYTES,
		);
		expect(await refusal(heavy)).toMatch(/as kept \(its defaults left out\): at most 1\.5 MB/);
	});

	it("keep it gzipped, and read entries kept before as plain text", async () => {
		const { store, kept } = memoryStore();
		const stockholm = TEMPLATES.find((each) => each.id === "stockholm")?.create();
		const shared = await shareUserWorld(store, JSON.stringify(stockholm), 3600, ORIGIN);
		const entry = kept.get(shared.id);
		expect(entry && isGzip(entry.value)).toBe(true);
		expect(entry?.metadata.encoding).toBe("gzip");
		const found = await readUserWorld(store, shared.id);
		const asKept = JSON.stringify(compactWorld(stockholm as never));
		expect(found?.json).toBe(asKept);
		// About thirteen times smaller.
		expect(entry?.value.length).toBeLessThan(asKept.length / 8);
		// An entry from before ADR-0145: plain JSON text, no encoding in its metadata.
		const old = "A".repeat(22);
		await store.put(old, '{"version":1,"meta":{"title":"Before"}}', {
			expirationTtl: 3600,
			metadata: {
				kind: "world",
				title: "Before",
				createdAt: "2026-11-01T00:00:00.000Z",
				expiresAt: "2026-11-08T00:00:00.000Z",
				deleteKeyHash: "0",
			},
		});
		expect((await readUserWorld(store, old))?.json).toBe('{"version":1,"meta":{"title":"Before"}}');
	});

	it("keep any title in metadata KV takes, without control characters", async () => {
		const { store, kept } = memoryStore();
		const scene = createEmptyScene({ title: "x" });
		for (const title of ["\u2028".repeat(1000), "😀".repeat(1000), 'a"\\\u0000\n'.repeat(400)]) {
			const shared = await shareUserWorld(
				store,
				JSON.stringify({ ...scene, meta: { ...scene.meta, title: title.slice(0, 2000) } }),
				3600,
				ORIGIN,
			);
			const metadata = kept.get(shared.id)?.metadata;
			expect(new TextEncoder().encode(JSON.stringify(metadata)).length).toBeLessThanOrEqual(
				MOST_METADATA_BYTES,
			);
			// biome-ignore lint/suspicious/noControlCharactersInRegex: checking there are none
			expect(metadata?.title).not.toMatch(/[\u0000-\u001f\u2028]/);
		}
	});
});
