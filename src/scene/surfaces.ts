import { AREA_KINDS } from "./areas";
import type { TArea, TGround, TSurface, TSurfaceKind } from "./schema";
import { SurfaceKindSchema } from "./schema";
import { variantName } from "./variants";

/**
 * Surfaces with texture (ADR-0137): the patterns the ground and areas can be
 * drawn with, in their own colours. What each looks like is drawn by
 * `render/surfaceShading`; this says what they are and which one a thing has.
 */

interface ISurfaceKind {
	/** Its family's name; variants are told apart by number (scene/variants). */
	name: string;
	/** What it looks like, for hints. */
	description: string;
}

export const SURFACE_KINDS: Record<TSurfaceKind, ISurfaceKind> = {
	plain: { name: "Plain", description: "A flat colour" },
	grass_01: { name: "Grass", description: "Soft patches and tufts, drier in places" },
	sand_01: { name: "Sand", description: "Wind ripples over a fine grain" },
	gravel_01: { name: "Gravel", description: "Small stones, each its own shade" },
	paving_01: { name: "Paving", description: "Square slabs with thin joints" },
	concrete_01: { name: "Concrete", description: "Large panels, quietly mottled" },
	cobbles_01: { name: "Cobbles", description: "Rounded stones in staggered rows" },
	dirt_01: { name: "Dirt", description: "Blotchy earth with pebbles" },
	snow_01: { name: "Snow", description: "A snowfield with soft drifts, in a tint of its colour" },
};

/** Every surface kind, in the order they're offered. */
export const SURFACE_KIND_IDS = SurfaceKindSchema.options;

export const SURFACE_KIND_LABELS = Object.fromEntries(
	SURFACE_KIND_IDS.map((kind) => [
		kind,
		variantName(kind, SURFACE_KINDS[kind].name, SURFACE_KIND_IDS),
	]),
) as Record<TSurfaceKind, string>;

/** What a textured surface is drawn with: its pattern, how strong (0–1, 0.5 as designed) and how big. */
export interface IDrawnSurface {
	kind: Exclude<TSurfaceKind, "plain">;
	patternStrength: number;
	patternScale: number;
}

const drawn = (
	kind: TSurfaceKind,
	patternStrength: number,
	patternScale: number,
): IDrawnSurface | null => (kind === "plain" ? null : { kind, patternStrength, patternScale });

/** The surface an area has, switch or not: its own kind, or its area kind's. */
export const areaSurfaceKind = (area: Pick<TArea, "kind" | "surface">): TSurfaceKind =>
	AREA_KINDS[area.kind].isWater ? "plain" : (area.surface.kind ?? AREA_KINDS[area.kind].surface);

/** What the ground is drawn with: null while plain (the world's switch off, or its kind plain). */
export const groundSurfaceOf = (
	ground: Pick<TGround, "surface">,
	world: TSurface,
): IDrawnSurface | null =>
	world.enabled ? drawn(ground.surface.kind, world.patternStrength, world.patternScale) : null;

/**
 * What an area is drawn with: null while plain (the world's switch off, its
 * surface plain, or water). Its own strength and size, or the world's.
 */
export const areaSurfaceOf = (
	area: Pick<TArea, "kind" | "surface">,
	world: TSurface,
): IDrawnSurface | null =>
	world.enabled
		? drawn(
				areaSurfaceKind(area),
				area.surface.patternStrength ?? world.patternStrength,
				area.surface.patternScale ?? world.patternScale,
			)
		: null;
