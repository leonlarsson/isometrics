import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { compactWorld } from "#/parts/compactWorld";
import { repairWorld } from "#/parts/repairWorld";
import { TEMPLATES } from "#/templates";

import { MOST_SHARED_WORLD_BYTES, sizeInWords } from "./shareLimits";

const OLD_WORLDS = new URL("../scene/fixtures/old-worlds/", import.meta.url);

describe("how big a share can be (ADR-0145)", () => {
	it("leaves every template and old world well inside the limit", () => {
		const worlds = [
			...TEMPLATES.map((template) => ({ name: template.id, world: template.create() as unknown })),
			...readdirSync(OLD_WORLDS).map((file) => ({
				name: file,
				world: JSON.parse(readFileSync(new URL(file, OLD_WORLDS), "utf8")) as unknown,
			})),
		];
		expect(worlds.length).toBeGreaterThan(10);
		for (const { name, world } of worlds) {
			const { scene } = repairWorld(world);
			const kept = JSON.stringify(compactWorld(scene));
			// Stockholm, the biggest, is about a third of what may be kept.
			expect(kept.length, name).toBeLessThan(MOST_SHARED_WORLD_BYTES / 2.5);
		}
	});

	it("says sizes in words", () => {
		expect(sizeInWords(1_500_000)).toBe("1.5 MB");
		expect(sizeInWords(518_958)).toBe("519 kB");
		expect(sizeInWords(300_000)).toBe("300 kB");
	});
});
