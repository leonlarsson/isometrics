import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FENCE_STYLE_LIST } from "#/fences/registry";
import { PARTS } from "#/parts/registry";

import PART_PICTURES from "./partPictures.json";

const ROOT = join(__dirname, "..", "..");

/** Add to scene's pictures, by key, as render/thumbnails names them (ADR-0150). */
const KEYS = [
	...PARTS.map((part) => part.kind),
	...FENCE_STYLE_LIST.map((style) => `fence:${style.id}`),
];

const makeThem = (key: string) =>
	`make them with node scripts/part-pictures.mjs --only ${key} (node.exe on WSL, for the real GPU; ADR-0150)`;

/** A source file's hash, as scripts/part-pictures.mjs works it out. */
const hashOf = (file: string) =>
	createHash("sha256")
		.update(readFileSync(join(ROOT, file), "utf8").replaceAll("\r\n", "\n"))
		.digest("hex")
		.slice(0, 16);

const made: Readonly<Record<string, string>> = PART_PICTURES;

describe("Add to scene's pictures, made ahead of time (ADR-0150)", () => {
	it.each(KEYS)("%s has its pictures, made from its source as it is now", (key) => {
		const entry = made[key];
		expect(entry, `${key} has no pictures: ${makeThem(key)}`).toBeDefined();
		const [source, hash] = entry.split("#");
		expect(existsSync(join(ROOT, source)), `${source} is gone: ${makeThem(key)}`).toBe(true);
		expect(hashOf(source), `${source} changed since its pictures were made: ${makeThem(key)}`).toBe(
			hash,
		);
		for (const theme of ["light", "dark"]) {
			const file = join(ROOT, "public", "part-pictures", `${key.replace(":", "-")}-${theme}.webp`);
			expect(existsSync(file), `${file} is missing: ${makeThem(key)}`).toBe(true);
		}
	});

	it("keeps none for parts or fence styles that are gone", () => {
		expect(Object.keys(made).filter((key) => !KEYS.includes(key))).toEqual([]);
	});
});
