import { beforeAll, describe, expect, it, vi } from "vitest";

import { allowLink } from "./linkTrust";
import { LinkError, nameOfLink, readableUrlOf, readLink } from "./readLink";

const answer = (body: string, init: ResponseInit = {}) =>
	(async () => new Response(body, init)) as typeof fetch;

describe("reading links and APIs (ADR-0113)", () => {
	beforeAll(() => {
		for (const url of [
			"https://x.test/a",
			"https://x.test/b.csv",
			"https://x.test",
			"https://api.steampowered.com/x",
			"not a link",
		]) {
			allowLink(url);
		}
	});

	it("sends nothing to an address this browser hasn't allowed (ADR-0119)", async () => {
		const fetcher = vi.fn(answer("{}"));
		await expect(readLink("https://not-allowed.test/x", fetcher)).rejects.toMatchObject({
			why: "notAllowed",
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("reads JSON and CSV", async () => {
		expect(await readLink("https://x.test/a", answer('{"totalUsers": 4}'))).toEqual({
			kind: "json",
			json: { totalUsers: 4 },
		});
		const csv = await readLink("https://x.test/b.csv", answer("day,sent\n2026-10-30,7\n"));
		expect(csv.kind).toBe("csv");
	});

	it("says why it couldn't: blocked, a status, not an address", async () => {
		const blocked = (async () => {
			throw new TypeError("Failed to fetch");
		}) as typeof fetch;
		await expect(readLink("https://api.steampowered.com/x", blocked)).rejects.toMatchObject({
			why: "blocked",
		});
		await expect(readLink("https://x.test", answer("no", { status: 403 }))).rejects.toThrow(/key/);
		await expect(readLink("not a link")).rejects.toBeInstanceOf(LinkError);
	});

	it("reads a Google Sheet's page as its CSV export, and names links by host and path", () => {
		expect(readableUrlOf("https://docs.google.com/spreadsheets/d/abc_1/edit#gid=42")).toBe(
			"https://docs.google.com/spreadsheets/d/abc_1/export?format=csv&gid=42",
		);
		expect(nameOfLink("https://api.battlefieldstats.com/users/count")).toBe(
			"api.battlefieldstats.com/users/count",
		);
	});
});
