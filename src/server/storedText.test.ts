import { describe, expect, it } from "vitest";

import { gzipText, isGzip, textOfStored } from "./storedText";

describe("shares kept gzipped (ADR-0145)", () => {
	it("round-trip any text, much smaller", async () => {
		const text = JSON.stringify({ title: "Gamla stan 😀", entities: new Array(500).fill("house") });
		const zipped = await gzipText(text);
		expect(isGzip(zipped)).toBe(true);
		expect(zipped.length).toBeLessThan(text.length / 10);
		expect(await textOfStored(zipped)).toBe(text);
		expect(await textOfStored(zipped.slice().buffer as ArrayBuffer)).toBe(text);
		expect(await textOfStored(await gzipText(""))).toBe("");
	});

	it("read entries kept before as the plain text they are", async () => {
		const text = '{"version":1,"meta":{"title":"Before ADR-0145, å"}}';
		const bytes = new TextEncoder().encode(text);
		expect(isGzip(bytes)).toBe(false);
		expect(await textOfStored(bytes)).toBe(text);
		expect(await textOfStored(new Uint8Array())).toBe("");
	});
});
