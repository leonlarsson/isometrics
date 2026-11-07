import { describe, expect, it } from "vitest";

import { DataBindingSchema, FenceKindSchema, FenceSchema } from "#/scene/schema";

import { buildFence } from "./fenceModel";
import { FENCE_STYLE_LABELS, FENCE_STYLE_LIST, FENCE_STYLES } from "./registry";

const sources = import.meta.glob("./*_[0-9][0-9].ts", {
	query: "?raw",
	import: "default",
	eager: true,
});

describe("fence styles", () => {
	it("has a style for every id in the format, and each id once", () => {
		expect(FENCE_STYLE_LIST.map((style) => style.id).sort()).toEqual(
			[...FenceKindSchema.options].sort(),
		);
		for (const id of FenceKindSchema.options) {
			expect(FENCE_STYLES[id].id).toBe(id);
			expect(FENCE_STYLE_LABELS[id]).toBeTruthy();
		}
	});

	it("keeps each style in a file named for it (ADR-0043)", () => {
		const files = Object.keys(sources).map((path) => path.replace(/^\.\/|\.ts$/g, ""));
		expect(files.sort()).toEqual([...FenceKindSchema.options].sort());
	});

	it("builds every style, with pieces only in the colours it lists", () => {
		for (const style of FENCE_STYLE_LIST) {
			const fence = FenceSchema.parse({
				id: "f",
				kind: style.id,
				points: [
					[0, 0],
					[6, 0],
					[6, 4],
				],
			});
			const geometries = buildFence(fence, [], []);
			expect(geometries.size, style.id).toBeGreaterThan(0);
			const ids = new Set(style.colors.map((spec) => spec.id));
			for (const [id, geometry] of geometries) {
				expect(ids.has(id), `${style.id} draws in a colour it doesn't list: ${id}`).toBe(true);
				const positions = geometry.getAttribute("position").array;
				expect(positions.length % 9).toBe(0);
				expect([...positions].every(Number.isFinite), style.id).toBe(true);
			}
		}
	});

	it("builds every style's gates, shut, open and from data, in colours it lists (ADR-0133)", () => {
		const count = (geometries: ReturnType<typeof buildFence>) =>
			[...geometries.values()].reduce((sum, g) => sum + g.getAttribute("position").count, 0);
		const highest = (geometries: ReturnType<typeof buildFence>) =>
			Math.max(
				...[...geometries.values()].flatMap((g) =>
					[...g.getAttribute("position").array].filter((_, i) => i % 3 === 2),
				),
			);
		for (const style of FENCE_STYLE_LIST) {
			const fence = (gates: unknown[]) =>
				FenceSchema.parse({
					id: "f",
					kind: style.id,
					points: [
						[0, 0],
						[6, 0],
					],
					gates,
				});
			const ids = new Set(style.colors.map((spec) => spec.id));
			expect(ids.has(style.gate.frameColor), style.id).toBe(true);
			expect(ids.has(style.gate.infillColor), style.id).toBe(true);
			const shut = buildFence(fence([{ spanIndex: 0, alongShare: 0.5, width: 1.4 }]), [], []);
			const gap = buildFence(fence([{ kind: "gap", width: 1.4, alongShare: 0.5 }]), [], []);
			for (const [id] of shut) {
				expect(ids.has(id), `${style.id}'s gate draws in a colour it doesn't list: ${id}`).toBe(
					true,
				);
			}
			expect(count(shut), style.id).toBeGreaterThan(count(gap));
			// Open, it swings out of the fence's line (to its right, +z here).
			const open = buildFence(
				fence([{ spanIndex: 0, alongShare: 0.5, width: 1.4, isOpen: true }]),
				[],
				[],
			);
			expect(highest(open), style.id).toBeGreaterThan(highest(shut) + 0.5);
			const fromData = fence([
				{
					spanIndex: 0,
					width: 1.4,
					data: { isOpen: DataBindingSchema.parse({ key: "open", switchesOnAbove: 0 }) },
				},
			]);
			const data = [{ key: "open", name: "", value: 1, unit: "" }];
			expect(highest(buildFence(fromData, [], data)), style.id).toBeCloseTo(highest(open));
		}
	});

	it("gives every colour a name and a default", () => {
		for (const style of FENCE_STYLE_LIST) {
			expect(style.colors.length, style.id).toBeGreaterThan(0);
			for (const spec of style.colors) {
				expect(spec.name, `${style.id}.${spec.id}`).toBeTruthy();
				expect(spec.default, `${style.id}.${spec.id}`).toBeTruthy();
			}
		}
	});

	it("stands on raised land, and partly built fences draw less", () => {
		const fence = FenceSchema.parse({
			id: "f",
			kind: "rail_fence_01",
			points: [
				[0, 0],
				[8, 0],
			],
		});
		const plateau = {
			id: "a",
			name: "",
			kind: "raised_land_01" as const,
			points: [
				[-1, -1],
				[9, -1],
				[9, 1],
				[-1, 1],
			] as [number, number][],
			height: 2,
			peaks: [],
			colors: {},
			water: { rippleStrength: null, reflectionStrength: null },
			surface: { kind: null, patternStrength: null, patternScale: null },
			weather: null,
			dataRow: null,
			isLocked: false,
			isHidden: false,
		};
		const lowest = (geometries: ReturnType<typeof buildFence>) =>
			Math.min(
				...[...geometries.values()].flatMap((g) =>
					[...g.getAttribute("position").array].filter((_, i) => i % 3 === 1),
				),
			);
		expect(lowest(buildFence(fence, [plateau], []))).toBeGreaterThan(1.9);
		const count = (geometries: ReturnType<typeof buildFence>) =>
			[...geometries.values()].reduce((sum, g) => sum + g.getAttribute("position").count, 0);
		const half = {
			...fence,
			data: { builtShare: DataBindingSchema.parse({ key: "progress", valueAtFull: 100 }) },
		};
		const data = [{ key: "progress", name: "", value: 50, unit: "%" }];
		expect(count(buildFence(half, [], data))).toBeLessThan(count(buildFence(fence, [], [])));
	});
});
