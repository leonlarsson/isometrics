import { describe, expect, it } from "vitest";

import { isLocalHost, webAddress } from "./webAddress";

describe("web addresses from untrusted data", () => {
	it("keeps https and http, and nothing else", () => {
		expect(webAddress("https://battlefieldstats.com")).toBe("https://battlefieldstats.com");
		expect(webAddress("http://example.com/a")).toBe("http://example.com/a");
		expect(webAddress("javascript:alert(1)")).toBeNull();
		expect(webAddress(" JavaScript:alert(1)")).toBeNull();
		expect(webAddress("data:text/html,<script>alert(1)</script>")).toBeNull();
		expect(webAddress("file:///etc/passwd")).toBeNull();
		expect(webAddress("/relative")).toBeNull();
		expect(webAddress(null)).toBeNull();
	});
});

describe("hosts on this computer or its network", () => {
	it("are told apart from the web", () => {
		for (const host of [
			"localhost",
			"app.localhost",
			"printer.local",
			"127.0.0.1",
			"10.1.2.3",
			"172.16.0.1",
			"172.31.9.9",
			"192.168.1.1",
			"169.254.1.1",
			"0.0.0.0",
			"[::1]",
			"fd12:3456::1",
			"fe80::1",
		]) {
			expect(isLocalHost(host), host).toBe(true);
		}
		for (const host of [
			"api.battlefieldstats.com",
			"example.org",
			"172.32.0.1",
			"8.8.8.8",
			"192.169.0.1",
		]) {
			expect(isLocalHost(host), host).toBe(false);
		}
	});
});
