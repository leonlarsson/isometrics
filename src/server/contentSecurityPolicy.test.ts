import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, makeNonce } from "./contentSecurityPolicy";

describe("the Content Security Policy (ADR-0122)", () => {
	it("lets scripts run only from this site, with the page's nonce or as the page's own blobs: never inline without it, nor eval", () => {
		const policy = contentSecurityPolicy("abc123");
		const scripts = policy.split("; ").find((each) => each.startsWith("script-src"));
		expect(scripts).toBe("script-src 'self' 'nonce-abc123' blob:");
		expect(policy).not.toContain("unsafe-eval");
		expect(scripts).not.toContain("unsafe-inline");
		expect(policy).toContain("frame-ancestors 'none'");
		expect(policy).toContain("object-src 'none'");
	});

	it("makes a different nonce each time", () => {
		const first = makeNonce();
		expect(first).toMatch(/^[A-Za-z0-9+/]{22}==$/);
		expect(makeNonce()).not.toBe(first);
	});
});
