import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No request leaves for an address outside this site without this browser's
 * yes (ADR-0119, ADR-0121). `editor/readLink.ts` is the only code that may ask
 * the network for an outside address, and it checks first; this site's own API
 * is asked only by the files listed here, at paths on this site.
 */
const ROOT = join(import.meta.dirname, "..");

/** Files allowed to call the network, and what for. */
const MAY_REQUEST: Record<string, "outside, checked" | "this site only"> = {
	"editor/readLink.ts": "outside, checked",
	"editor/userWorlds.ts": "this site only",
};

/** Ways to send a request from a browser. */
const REQUESTS =
	/\bfetch\s*\(|\bfetcher\s*\(|\bXMLHttpRequest\b|\bEventSource\b|\bWebSocket\b|\bsendBeacon\b|\bimportScripts\b/;

const sourceFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			return sourceFiles(path);
		}
		return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")
			? [path]
			: [];
	});

/** The code without its comments, which may well mention fetching. */
const codeOf = (text: string) =>
	text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("requests to outside addresses (ADR-0119, ADR-0121)", () => {
	it("go only through readLink; this site's API only from the listed files", () => {
		const requesting = sourceFiles(ROOT)
			// The server's routes answer requests; they don't make them from a viewer's browser.
			.filter((path) => !relative(ROOT, path).startsWith("routes/api/"))
			.filter((path) => REQUESTS.test(codeOf(readFileSync(path, "utf8"))))
			.map((path) => relative(ROOT, path).replaceAll("\\", "/"));
		expect(requesting.sort()).toEqual(Object.keys(MAY_REQUEST).sort());
	});

	it("this site's own requests are to paths on this site", () => {
		for (const [file, kind] of Object.entries(MAY_REQUEST)) {
			if (kind !== "this site only") {
				continue;
			}
			const code = codeOf(readFileSync(join(ROOT, file), "utf8"));
			const addresses = [...code.matchAll(/\bfetch\s*\(\s*([`"'])(.*?)\1/g)].map((m) => m[2]);
			expect(addresses.length).toBeGreaterThan(0);
			for (const address of addresses) {
				expect(address, `${file}: ${address}`).toMatch(/^\/(?!\/)/);
			}
			// Every fetch there names its address as a literal path.
			expect([...code.matchAll(/\bfetch\s*\(/g)].length).toBe(addresses.length);
		}
	});
});
