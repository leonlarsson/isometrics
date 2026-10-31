import { describe, expect, it } from "vitest";

import {
	builtBuildings,
	CLUSTER_STYLES,
	clusterSlots,
	reachOf,
	rectsOverlap,
	seededRandom,
} from "./clusterKit";

const WIDTHS = [3, 5, 8, 13.5, 30];
const SEEDS = [1, 2, 7, 999];

const cases = CLUSTER_STYLES.flatMap((style) =>
	WIDTHS.flatMap((width) => SEEDS.map((seed) => [style.id, width, seed, style] as const)),
);

describe("seededRandom", () => {
	it("gives the same numbers for a seed and others for another, all in [0, 1)", () => {
		const a = Array.from({ length: 50 }, seededRandom(3));
		expect(Array.from({ length: 50 }, seededRandom(3))).toEqual(a);
		expect(Array.from({ length: 50 }, seededRandom(4))).not.toEqual(a);
		for (const value of a) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe("rectsOverlap", () => {
	it("tells turned rectangles apart from overlapping ones", () => {
		const a = { x: 0, z: 0, width: 1, depth: 1, turn: 0 };
		expect(rectsOverlap(a, { ...a, x: 0.9 })).toBe(true);
		expect(rectsOverlap(a, { ...a, x: 1.1 })).toBe(false);
		expect(rectsOverlap(a, { ...a, x: 1.1 }, 0.3)).toBe(true);
		// A diamond whose corner reaches into the square's side, and one just clear of it.
		expect(rectsOverlap(a, { ...a, x: 1.15, turn: Math.PI / 4 })).toBe(true);
		expect(rectsOverlap(a, { ...a, x: 1.25, turn: Math.PI / 4 })).toBe(false);
	});
});

describe("clusterSlots", () => {
	it.each(cases)("%s, %d wide, seed %d: the same layout every time", (_, width, seed, style) => {
		expect(clusterSlots(style, width, seed)).toEqual(clusterSlots(style, width, seed));
	});

	it.each(CLUSTER_STYLES.map((style) => [style.id, style] as const))(
		"%s: another seed is another arrangement",
		(_, style) => {
			expect(clusterSlots(style, 8, 1)).not.toEqual(clusterSlots(style, 8, 2));
		},
	);

	it.each(cases)(
		"%s, %d wide, seed %d: between 1 and the most buildings, inside the width, none overlapping",
		(_, width, seed, style) => {
			const slots = clusterSlots(style, width, seed);
			expect(slots.length).toBeGreaterThanOrEqual(1);
			expect(slots.length).toBeLessThanOrEqual(style.mostBuildings);
			slots.forEach((slot, i) => {
				expect(slot.rank).toBe(i);
				expect(reachOf(slot)).toBeLessThanOrEqual(width / 2 + 1e-9);
				for (const other of slots.slice(i + 1)) {
					expect(
						rectsOverlap(slot, other, style.gap * 0.999),
						`${slot.rank} and ${other.rank}`,
					).toBe(false);
				}
			});
		},
	);

	it("fills a default-sized cluster with a good number of buildings", () => {
		for (const style of CLUSTER_STYLES) {
			expect(clusterSlots(style, 8, 1).length, style.id).toBeGreaterThanOrEqual(8);
		}
	});
});

describe("builtBuildings", () => {
	const shares = Array.from({ length: 101 }, (_, i) => i / 100);

	it.each(cases)(
		"%s, %d wide, seed %d: one at 0, all at 1, never fewer as it grows",
		(_, width, seed, style) => {
			const slots = clusterSlots(style, width, seed);
			expect(builtBuildings(slots, 0)).toHaveLength(1);
			expect(builtBuildings(slots, 1)).toHaveLength(slots.length);
			const counts = shares.map((share) => builtBuildings(slots, share).length);
			counts.slice(1).forEach((count, i) => {
				expect(count).toBeGreaterThanOrEqual(counts[i]);
			});
		},
	);

	it.each(cases)(
		"%s, %d wide, seed %d: a building keeps its place, turn and look as the share grows, and only grows",
		(_, width, seed, style) => {
			const slots = clusterSlots(style, width, seed);
			for (const [low, high] of [
				[0, 0.4],
				[0.4, 0.8],
				[0.13, 0.14],
				[0.5, 1],
			]) {
				const before = builtBuildings(slots, low);
				const after = builtBuildings(slots, high);
				before.forEach((building, i) => {
					const later = after[i];
					expect(later.rank).toBe(building.rank);
					expect([later.x, later.z, later.turn, later.looks]).toEqual([
						building.x,
						building.z,
						building.turn,
						building.looks,
					]);
					expect(later.heightFactor).toBeGreaterThanOrEqual(building.heightFactor);
					expect(later.widthFactor).toBeGreaterThanOrEqual(building.widthFactor);
					expect(later.widthFactor).toBeLessThanOrEqual(1);
				});
			}
		},
	);

	it("builds from the middle outwards", () => {
		for (const style of CLUSTER_STYLES) {
			const slots = clusterSlots(style, 12, 1);
			const half = Math.floor(slots.length / 2);
			const mean = (list: typeof slots) =>
				list.reduce((sum, slot) => sum + slot.outness, 0) / list.length;
			expect(mean(slots.slice(0, half)), style.id).toBeLessThan(mean(slots.slice(half)));
		}
	});
});
