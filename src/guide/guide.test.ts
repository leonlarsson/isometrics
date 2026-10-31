import { describe, expect, it } from "vitest";

import { GUIDE, GUIDE_API, guideAsMarkdown } from "./guide";

describe("the guide", () => {
	it("reads as Markdown with every section, the site's addresses made whole", () => {
		const text = guideAsMarkdown("https://example.test");
		for (const section of GUIDE) {
			expect(text).toContain(`## ${section.title}`);
		}
		expect(text).toContain("### 1. Read the API as a table");
		expect(text).toContain("`https://example.test/schema.json`");
		expect(text).toContain("`https://example.test/api/worlds/templates`");
		expect(text).toContain("`https://example.test/api/worlds/validate`");
		expect(text).toContain(GUIDE_API.counts);
		expect(text).not.toContain("`/schema.json`");
	});

	it("marks only whole **bold** and `code` runs", () => {
		const text = guideAsMarkdown();
		for (const line of text.split("\n")) {
			expect((line.match(/\*\*/g) ?? []).length % 2, line).toBe(0);
			expect((line.match(/`/g) ?? []).length % 2, line).toBe(0);
		}
	});
});
