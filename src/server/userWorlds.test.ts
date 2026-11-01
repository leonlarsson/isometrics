import { describe, expect, it } from "vitest";

import { createEmptyScene } from "#/templates";

import {
	deleteUserWorld,
	type IUserWorldMeta,
	type IUserWorldStore,
	readUserWorld,
	shareUserWorld,
	USER_WORLD_ID,
	UserWorldError,
} from "./userWorlds";

/** An in-memory KV namespace, keeping what was put and how long for. */
const memoryStore = () => {
	const kept = new Map<string, { value: string; metadata: IUserWorldMeta; ttl: number }>();
	const store: IUserWorldStore = {
		getWithMetadata: async (key) => {
			const found = kept.get(key);
			return { value: found?.value ?? null, metadata: found?.metadata ?? null };
		},
		put: async (key, value, { expirationTtl, metadata }) => {
			kept.set(key, { value, metadata, ttl: expirationTtl });
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
