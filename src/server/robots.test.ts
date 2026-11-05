import { describe, expect, it } from "vitest";

import { SITE_URL } from "#/lib/app";

import { robotsTagFor } from "./robots";

describe("robotsTagFor", () => {
	it("opens the published site's own pages to search engines", () => {
		expect(robotsTagFor(new URL(SITE_URL))).toBeNull();
		expect(robotsTagFor(new URL("/parts", SITE_URL))).toBeNull();
		expect(robotsTagFor(new URL("/templates/stockholm", SITE_URL))).toBeNull();
	});

	it("keeps worlds and prefabs shared by link out, even on the published site", () => {
		expect(robotsTagFor(new URL("/w/abc123", SITE_URL))).toBe("noindex, nofollow");
		expect(robotsTagFor(new URL("/p/abc123", SITE_URL))).toBe("noindex, nofollow");
	});

	it("keeps previews and other addresses out", () => {
		expect(robotsTagFor(new URL("https://isometrics.ragnarok.workers.dev/"))).toBe(
			"noindex, nofollow",
		);
		expect(robotsTagFor(new URL("https://stockholm-isometrics.ragnarok.workers.dev/"))).toBe(
			"noindex, nofollow",
		);
		expect(robotsTagFor(new URL("http://localhost:3000/"))).toBe("noindex, nofollow");
	});
});
