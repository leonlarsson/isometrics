import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SceneSchema } from "#/scene/schema";

import { createWorld } from "./persistence";
import { blockedStorage, memoryStorage } from "./testStorage";
import { FRESH_START, markFreshStartSeen, shouldOfferFreshStart } from "./wipeOffer";

const world = () => createWorld(SceneSchema.parse({ version: 1 }));

describe("fresh-start offer (ADR-0059)", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", memoryStorage());
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("isn't offered while the number hasn't been bumped", () => {
		world();
		expect(shouldOfferFreshStart(FRESH_START)).toBe(false);
	});

	it("is offered once the number goes up, to a browser with worlds, until it's seen", () => {
		world();
		expect(shouldOfferFreshStart(FRESH_START + 1)).toBe(true);
		markFreshStartSeen(FRESH_START + 1);
		expect(shouldOfferFreshStart(FRESH_START + 1)).toBe(false);
		// The next bump offers it again.
		expect(shouldOfferFreshStart(FRESH_START + 2)).toBe(true);
	});

	it("isn't offered to a browser with nothing stored, which just takes the number", () => {
		expect(shouldOfferFreshStart(FRESH_START + 1)).toBe(false);
		world();
		expect(shouldOfferFreshStart(FRESH_START + 1)).toBe(false);
	});

	it("isn't offered when the browser doesn't allow storage", () => {
		vi.stubGlobal("localStorage", blockedStorage());
		expect(shouldOfferFreshStart(FRESH_START + 1)).toBe(false);
	});
});
