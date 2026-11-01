import { afterEach, describe, expect, it, vi } from "vitest";

import { validateWorld } from "#/parts/validateWorld";
import type { TScene } from "#/scene/schema";
import { createEmptyScene } from "#/templates";

import { shareWorld } from "./userWorlds";

describe("sharing from the app (ADR-0120)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("posts the world as opening it would read it, so a stray bad value never blocks sharing", async () => {
		const posted: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init?: RequestInit) => {
				posted.push(String(init?.body));
				return Response.json(
					{
						id: "5ttCNb8m9AVF1wwYCij3gA",
						kind: "world",
						url: "https://example.test/w/5ttCNb8m9AVF1wwYCij3gA",
						jsonUrl: "https://example.test/api/user-worlds/5ttCNb8m9AVF1wwYCij3gA",
						expiresAt: "2026-11-02T00:00:00.000Z",
						deleteKey: "key",
					},
					{ status: 201 },
				);
			}),
		);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const scene = createEmptyScene({ title: "Mine" });
		// What an editing bug could leave behind: a value the schema doesn't take, and an id used twice.
		const broken = {
			...scene,
			entities: [
				{ id: "a", kind: "house_01", position: [0, 0], scale: Number.NaN },
				{ id: "a", kind: "house_01", position: [2, 0] },
			],
		} as unknown as TScene;
		await shareWorld(broken, 3600);
		const sent = JSON.parse(posted[0]);
		// What the API checks (it keeps only worlds that open as written): this passes.
		expect(validateWorld(sent).isValid).toBe(true);
		expect(sent.entities).toHaveLength(1);
		expect(warn).toHaveBeenCalled();
		// The world in the editor isn't touched.
		expect(broken.entities).toHaveLength(2);
	});
});
