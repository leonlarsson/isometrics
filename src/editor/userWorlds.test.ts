import { afterEach, describe, expect, it, vi } from "vitest";

import { compactWorld } from "#/parts/compactWorld";
import { repairWorld } from "#/parts/repairWorld";
import { validateWorld } from "#/parts/validateWorld";
import type { TScene } from "#/scene/schema";
import { createEmptyScene } from "#/templates";

import {
	fetchSharedWorld,
	MOST_TRIES,
	ShareError,
	secondsLeftToTry,
	shareWorld,
} from "./userWorlds";

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
		// Sent as the API keeps it, its defaults left out (ADR-0145): its limit is about that size.
		expect(sent).toEqual(compactWorld(repairWorld(structuredClone(sent)).scene));
		expect(sent.entities).toHaveLength(1);
		expect(warn).toHaveBeenCalled();
		// The world in the editor isn't touched.
		expect(broken.entities).toHaveLength(2);
	});

	it("says when sharing is paused, so the dialog can say it too (ADR-0145)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				Response.json({ error: "Sharing is paused for now. Try again later." }, { status: 503 }),
			),
		);
		const error = await shareWorld(createEmptyScene({ title: "Mine" }), 3600).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(ShareError);
		expect((error as ShareError).isPaused).toBe(true);
		expect((error as ShareError).message).toBe("Sharing is paused for now. Try again later.");
	});
});

describe("waiting for a link that isn't there (ADR-0145)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("asks a few times for a link not shared from here, a minute for one that was", () => {
		expect(secondsLeftToTry(1, 0, false, 0)).toBe(12);
		expect(secondsLeftToTry(3, 0, false, 8000)).toBe(4);
		expect(secondsLeftToTry(MOST_TRIES, 0, false, 12_000)).toBeNull();
		expect(secondsLeftToTry(MOST_TRIES, 0, true, 12_000)).toBe(48);
		expect(secondsLeftToTry(15, 0, true, 60_000)).toBeNull();
	});

	it("gives up on a mistyped or expired link after a few tries", async () => {
		vi.useFakeTimers();
		const asked = vi.fn(async () => Response.json({ error: "No world here." }, { status: 404 }));
		vi.stubGlobal("fetch", asked);
		const waits: number[] = [];
		const fetching = fetchSharedWorld("AAAAAAAAAAAAAAAAAAAAAA", {
			onWaiting: (tries) => waits.push(tries),
		}).catch((error: unknown) => error);
		await vi.runAllTimersAsync();
		const error = await fetching;
		expect(error).toBeInstanceOf(ShareError);
		expect((error as ShareError).message).toBe("No world here.");
		expect(asked).toHaveBeenCalledTimes(MOST_TRIES);
		expect(waits).toEqual([1, 2, 3]);
	});
});
