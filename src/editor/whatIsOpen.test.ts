import { describe, expect, it } from "vitest";

import { linkInAddress } from "./openLink";
import { keepsOpenWorld, previewOf } from "./whatIsOpen";

describe("what's open (ADR-0121)", () => {
	it("reads a link from the page's address, and nothing else", () => {
		expect(linkInAddress("?shared=5ttCNb8m9AVF1wwYCij3gA")).toEqual({
			from: "shared",
			id: "5ttCNb8m9AVF1wwYCij3gA",
		});
		expect(linkInAddress("?template=brightwater")).toEqual({ from: "template", id: "brightwater" });
		expect(linkInAddress("?shared=short")).toBeNull();
		expect(linkInAddress("?template=../x")).toBeNull();
		expect(linkInAddress("")).toBeNull();
	});

	it("only a world of one's own is kept: not a preview, a link or the home screen", () => {
		const preview = { from: "shared" as const, id: "a", expiresAt: null };
		expect(keepsOpenWorld({ kind: "world", preview: null })).toBe(true);
		expect(keepsOpenWorld({ kind: "world", preview })).toBe(false);
		expect(keepsOpenWorld({ kind: "home", why: { kind: "noWorlds" } })).toBe(false);
		expect(keepsOpenWorld({ kind: "starting" })).toBe(false);
		expect(previewOf({ kind: "world", preview })).toBe(preview);
		expect(previewOf({ kind: "home", why: { kind: "chosen" } })).toBeNull();
	});
});
