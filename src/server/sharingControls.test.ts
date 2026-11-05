import { describe, expect, it } from "vitest";

import { fitMetadata, isSharingDisabled, MOST_METADATA_BYTES } from "./sharingControls";

const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

describe("the owner's controls over sharing (ADR-0145)", () => {
	it("pause sharing only when the var says so", () => {
		for (const on of [true, 1, "true", "TRUE", " 1 ", "yes", "on"]) {
			expect(isSharingDisabled(on), String(on)).toBe(true);
		}
		for (const off of [undefined, null, false, 0, "", "false", "0", "no", "off", "paused?"]) {
			expect(isSharingDisabled(off), String(off)).toBe(false);
		}
	});

	it("fit metadata under KV's limit, by whole characters, without control characters", () => {
		const base = {
			kind: "world",
			createdAt: "2026-11-05T00:00:00.000Z",
			expiresAt: "2026-12-05T00:00:00.000Z",
			deleteKeyHash: "f".repeat(64),
		};
		expect(fitMetadata({ ...base, title: "Harbour" }, "title").title).toBe("Harbour");
		expect(fitMetadata({ ...base, title: " Two\nlines\u0000\t" }, "title").title).toBe("Two lines");
		for (const title of [
			"x".repeat(5000),
			"😀".repeat(5000),
			"\u2028".repeat(5000),
			'"\\'.repeat(5000),
			"\u0001".repeat(5000),
			"\ud800".repeat(500),
		]) {
			const fitted = fitMetadata({ ...base, title }, "title");
			expect(bytesOf(fitted)).toBeLessThanOrEqual(MOST_METADATA_BYTES);
			// Never half an emoji.
			expect(fitted.title).not.toMatch(/\ud83d(?!\ude00)/);
			expect(fitted.deleteKeyHash).toBe(base.deleteKeyHash);
		}
		expect(fitMetadata({ ...base, title: "y".repeat(5000) }, "title").title.length).toBe(200);
	});
});
