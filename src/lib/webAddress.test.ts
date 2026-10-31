import { describe, expect, it } from "vitest";

import { webAddress } from "./webAddress";

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
