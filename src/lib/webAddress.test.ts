import { describe, expect, it } from "vitest";

import { isLocalHost, linkWords, webAddress } from "./webAddress";

describe("web addresses from untrusted data", () => {
	it("name a link with its host, so a name can't pass it off as another site's (ADR-0145)", () => {
		expect(linkWords("Your bank", "https://phish.example/login")).toBe("Your bank (phish.example)");
		expect(linkWords("", "https://scb.se/data")).toBe("scb.se");
		expect(linkWords(null, "https://scb.se:8443/data")).toBe("scb.se:8443");
		expect(linkWords("SCB.se", "https://scb.se/")).toBe("scb.se");
		expect(linkWords("Name", "not a link")).toBe("Name");
	});

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
			new URL("http://[::ffff:127.0.0.1]/").hostname,
			new URL("http://[::ffff:192.168.1.1]/").hostname,
			"::ffff:10.0.0.1",
		]) {
			expect(isLocalHost(host), host).toBe(true);
		}
		for (const host of [
			"api.battlefieldstats.com",
			"example.org",
			"172.32.0.1",
			"8.8.8.8",
			"192.169.0.1",
			new URL("http://[::ffff:8.8.8.8]/").hostname,
		]) {
			expect(isLocalHost(host), host).toBe(false);
		}
	});
});
