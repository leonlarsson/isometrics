import { describe, expect, it } from "vitest";

import { linkInAddress } from "./openLink";
import { MOST_SOURCES_READ, readOnTheirOwn, sitesOf } from "./sourceRefresh";
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

describe("naming the sites of external sources (ADR-0121)", () => {
	const source = (url: string) => ({ url }) as Parameters<typeof sitesOf>[0][number];
	it("names hosts only, each once, the first two and a count of the rest", () => {
		expect(sitesOf([source("https://a.com/x"), source("https://a.com/y")])).toBe("a.com");
		expect(sitesOf([source("https://a.com/x"), source("https://b.org/y")])).toBe("a.com and b.org");
		expect(
			sitesOf(["a.com", "b.org", "c.net", "d.io"].map((host) => source(`https://${host}/z`))),
		).toBe("a.com, b.org and 2 other sites");
		expect(sitesOf(["a.com", "b.org", "c.net"].map((host) => source(`https://${host}/z`)))).toBe(
			"a.com, b.org and 1 other site",
		);
	});
});

describe("sources read on their own (ADR-0119)", () => {
	it("are the first few addresses, each once; the rest wait to be asked", () => {
		const sources = Array.from({ length: 14 }, (_, i) => ({
			id: `s${i}`,
			url: `https://site-${i % 12}.test/x`,
		}));
		const read = readOnTheirOwn(sources);
		expect(read).toHaveLength(MOST_SOURCES_READ);
		expect(read.map((source) => source.id)).toEqual(
			sources.slice(0, MOST_SOURCES_READ).map((s) => s.id),
		);
		// An address repeated isn't read twice, and doesn't use up a place.
		const repeated = readOnTheirOwn([
			{ id: "a", url: "https://same.test" },
			{ id: "b", url: "https://same.test" },
			{ id: "c", url: "https://other.test" },
		]);
		expect(repeated.map((source) => source.id)).toEqual(["a", "c"]);
	});
});
