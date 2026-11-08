import { describe, expect, it } from "vitest";

import { AREA_KIND_IDS, AREA_KINDS } from "./areas";
import { AreaSchema, SceneSchema, SurfaceSchema } from "./schema";
import { areaSurfaceKind, areaSurfaceOf, groundSurfaceOf, SURFACE_KIND_LABELS } from "./surfaces";

const area = (input: Record<string, unknown>) =>
	AreaSchema.parse({
		id: "a",
		points: [
			[0, 0],
			[4, 0],
			[4, 4],
		],
		...input,
	});
const on = SurfaceSchema.parse({ enabled: true });

describe("surfaces (ADR-0137)", () => {
	it("are plain in a world that doesn't ask for them, as worlds always were", () => {
		const scene = SceneSchema.parse({ version: 1 });
		expect(scene.surface.enabled).toBe(false);
		expect(groundSurfaceOf({ surface: { kind: "grass_01" } }, scene.surface)).toBeNull();
		for (const kind of AREA_KIND_IDS) {
			expect(areaSurfaceOf(area({ kind, surface: { kind: "cobbles_01" } }), scene.surface)).toBe(
				null,
			);
		}
	});

	it("give the ground its own kind, plain by default", () => {
		expect(groundSurfaceOf(SceneSchema.parse({ version: 1 }).grounds[0], on)).toBeNull();
		expect(groundSurfaceOf({ surface: { kind: "snow_01" } }, on)).toEqual({
			kind: "snow_01",
			patternStrength: 0.5,
			patternScale: 1,
		});
	});

	it("follow an area's kind until it picks its own", () => {
		expect(areaSurfaceKind(area({ kind: "grass_01" }))).toBe("grass_01");
		expect(areaSurfaceKind(area({ kind: "plaza_01" }))).toBe("paving_01");
		expect(areaSurfaceKind(area({ kind: "raised_land_01" }))).toBe("dirt_01");
		expect(areaSurfaceKind(area({ kind: "plaza_01", surface: { kind: "cobbles_01" } }))).toBe(
			"cobbles_01",
		);
		expect(areaSurfaceOf(area({ kind: "grass_01", surface: { kind: "plain" } }), on)).toBeNull();
	});

	it("never texture water, whatever it says", () => {
		expect(AREA_KINDS.water_01.surface).toBe("plain");
		expect(areaSurfaceOf(area({ kind: "water_01", surface: { kind: "sand_01" } }), on)).toBeNull();
	});

	it("take an area's own strength and size, or the world's", () => {
		const world = SurfaceSchema.parse({ enabled: true, patternStrength: 0.8, patternScale: 2 });
		expect(areaSurfaceOf(area({ kind: "sand_01" }), world)).toEqual({
			kind: "sand_01",
			patternStrength: 0.8,
			patternScale: 2,
		});
		expect(
			areaSurfaceOf(
				area({ kind: "sand_01", surface: { patternStrength: 0.2, patternScale: 0.5 } }),
				world,
			),
		).toEqual({ kind: "sand_01", patternStrength: 0.2, patternScale: 0.5 });
	});

	it("each have a name", () => {
		expect(Object.values(SURFACE_KIND_LABELS)).toEqual([
			"Plain",
			"Grass",
			"Sand",
			"Gravel",
			"Paving",
			"Concrete",
			"Cobbles",
			"Dirt",
			"Snow",
		]);
	});
});
