import { describe, expect, it } from "vitest";

import { rateLimitKeyOf } from "./rateLimitKey";

describe("who a rate limit counts (ADR-0145)", () => {
	it("counts an IPv4 address on its own", () => {
		expect(rateLimitKeyOf("192.0.2.1")).toBe("192.0.2.1");
		expect(rateLimitKeyOf("192.0.2.2")).toBe("192.0.2.2");
		expect(rateLimitKeyOf(" 203.0.113.9 ")).toBe("203.0.113.9");
	});

	it("counts an IPv6 address by its /64, however it's written", () => {
		const key = "2001:db8:85a3:1234::/64";
		expect(rateLimitKeyOf("2001:db8:85a3:1234::1")).toBe(key);
		expect(rateLimitKeyOf("2001:db8:85a3:1234:ffff:ffff:ffff:ffff")).toBe(key);
		expect(rateLimitKeyOf("2001:0DB8:85A3:1234:0000:0000:dead:beef")).toBe(key);
		expect(rateLimitKeyOf("2001:db8:85a3:1234:1:2::3")).toBe(key);
		expect(rateLimitKeyOf("2001:db8:85a3:1234::1%eth0")).toBe(key);
		expect(rateLimitKeyOf("2001:db8:85a3:1235::1")).toBe("2001:db8:85a3:1235::/64");
		expect(rateLimitKeyOf("::1")).toBe("0:0:0:0::/64");
		expect(rateLimitKeyOf("2001:db8::")).toBe("2001:db8:0:0::/64");
		expect(rateLimitKeyOf("64:ff9b::192.0.2.1")).toBe("64:ff9b:0:0::/64");
	});

	it("counts an IPv4 address written as IPv6 as the IPv4 one", () => {
		expect(rateLimitKeyOf("::ffff:192.0.2.1")).toBe("192.0.2.1");
		expect(rateLimitKeyOf("::ffff:c000:201")).toBe("192.0.2.1");
	});

	it("puts anything that isn't an address under one key", () => {
		for (const text of [
			null,
			undefined,
			"",
			"unknown",
			"256.1.1.1",
			"1.2.3",
			"2001:db8::1::2",
			"2001:db8:1:2:3:4:5:6:7",
			"2001:db8:1:2:3:4:5",
			"12345::1",
			"::ffff:1.2.3.400",
			"<script>",
		]) {
			expect(rateLimitKeyOf(text)).toBe("unknown");
		}
	});
});
