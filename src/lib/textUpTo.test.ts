import { describe, expect, it } from "vitest";

import { textUpTo } from "./textUpTo";

describe("reading a body up to a limit", () => {
	it("reads what fits, and refuses what doesn't, said or not", async () => {
		expect(await textUpTo(new Response("hello"), 10)).toBe("hello");
		expect(await textUpTo(new Response("x".repeat(11)), 10)).toBeNull();
		const said = new Response("tiny", { headers: { "content-length": "999" } });
		expect(await textUpTo(said, 10)).toBeNull();
		expect(await textUpTo(new Response("åäö"), 10)).toBe("åäö");
	});
});
