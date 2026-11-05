import { describe, expect, it } from "vitest";

import { ABUSE_CONTACT } from "./app";
import { reportAddressOf, sharedLinkOf } from "./report";

describe("reporting a shared link (ADR-0145)", () => {
	it("writes an email to the abuse contact with the link and its id", () => {
		const address = reportAddressOf("world", "5ttCNb8m9AVF1wwYCij3gA", "https://example.test");
		const url = new URL(address);
		expect(url.protocol).toBe("mailto:");
		expect(url.pathname).toBe(ABUSE_CONTACT);
		expect(url.searchParams.get("subject")).toContain("5ttCNb8m9AVF1wwYCij3gA");
		const body = url.searchParams.get("body") ?? "";
		expect(body).toContain("Link: https://example.test/w/5ttCNb8m9AVF1wwYCij3gA");
		expect(body).toContain("Id: 5ttCNb8m9AVF1wwYCij3gA");
		expect(sharedLinkOf("prefab", "abc", "https://example.test")).toBe(
			"https://example.test/p/abc",
		);
	});

	it("is never a made-up real address: a placeholder the owner replaces, or theirs", () => {
		expect(ABUSE_CONTACT).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
	});
});
