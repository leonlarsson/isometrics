import type { FC } from "react";
import type { z } from "zod";

import type { TDataEntry } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

/**
 * What a light looks like, which also says which settings it has: a `lens`
 * (a small glowing surface, e.g. a rain light), a `beam` (a fan of light on
 * the road ahead, e.g. headlights), a `pool` (a round glow on the ground, e.g.
 * a lamp), `windows` (a building's lit windows) or a `glow` (a glowing surface,
 * e.g. a cabin or doorway). Beams and pools have a reach.
 */
export type TLightShape = "lens" | "beam" | "pool" | "windows" | "glow";

/** Light shapes that light the ground, and so have a reach. */
export const LIGHT_SHAPES_WITH_REACH: readonly TLightShape[] = ["beam", "pool"];

/** One of a part's lights (ADR-0058). Its look and place are the part's; objects can change the rest. */
export interface ILightSpec {
	/** Stable key objects store their settings under, e.g. "headlights". Rename with renamedLights. */
	id: string;
	/** What the Lights tab calls it, e.g. "Headlights". */
	name: string;
	/** What it is, when the name doesn't say it all, e.g. "Computer screens left on at desks." Shown on its card. */
	description?: string;
	shape: TLightShape;
	/** Its colour; the theme's lamplight if left out. */
	color?: TColorDefault;
	/** How bright: 1 = normal (the default), up to 3. */
	strength?: number;
	/** How far it lights the ground, in grid units at scale 1 (beams and pools). */
	reach?: number;
	/** Window lights: the part of its own panes that are lit, 0–1 (all of them if left out). */
	litPanes?: number;
	/**
	 * Window lights: how many of the building's panes are its, relative to its
	 * other window lights' weights (9 and 1: nine panes in ten are its); 1 if
	 * left out. Changing it moves which panes are whose.
	 */
	weight?: number;
	/** When it's on by itself: "dark" (the default) after dark; "driving" after dark while it drives along a road. */
	when?: "dark" | "driving";
	/**
	 * Settings older worlds kept elsewhere (props, the accent colour) before this
	 * light had its own, used while the object's setting for it is unset.
	 */
	legacy?: (stored: { props: Record<string, unknown>; accent: string | null }) => {
		color?: string | null;
		strength?: number | null;
		reach?: number | null;
	};
}

/**
 * One of a part's colours (ADR-0060), e.g. a house's roof. Objects store
 * their setting for it under its id and can let data set it; the Look tab
 * shows one per colour, in this order.
 */
export interface IColorSpec<C extends string = string> {
	/** Stable key objects store their setting under, e.g. "roof". Never change it. */
	id: C;
	/** What the Look tab calls it, e.g. "Roof". */
	name: string;
	/** Its colour until it's set: a hex colour, or one from the theme. */
	default: TColorDefault;
	/**
	 * Which of the old per-object fields older worlds kept it in: the first
	 * colour was `color`, the second `accent`. Read while it isn't set in `colors`.
	 */
	legacy?: "color" | "accent";
}

/** One of a part's lights as it is right now (`resolveLights`). */
export interface IResolvedLight {
	/** Lit at all (`level` above 0). */
	on: boolean;
	/** How bright it is now: 0 when off, up to its strength (dimmer at dusk). */
	level: number;
	color: string;
	/** How far it lights the ground, in grid units at scale 1. */
	reach: number;
	/** Window lights: the part of its own panes that are lit, 0–1. */
	litPanes: number;
	/** Window lights: how many of the building's panes are its, relative to the others' weights. */
	weight: number;
}

export type TPartCategory = "buildings" | "vehicles" | "nature" | "infrastructure" | "markers";

export const CATEGORY_LABELS: Record<TPartCategory, string> = {
	buildings: "Buildings",
	vehicles: "Vehicles",
	nature: "Nature",
	infrastructure: "Ground & props",
	markers: "Markers",
};

/**
 * Describes one editable part parameter so the inspector can render a control.
 * `K` is the part's prop names, so a field can't name a prop the part doesn't have.
 */
export type TFieldSpec<K extends string = string> =
	| {
			key: K;
			label: string;
			type: "number";
			min: number;
			max: number;
			step: number;
	  }
	| { key: K; label: string; type: "boolean" }
	| { key: K; label: string; type: "text"; placeholder?: string }
	/** One of the world's data keys, or "" for none (ADR-0041). Renamed and removed with the key. */
	| { key: K; label: string; type: "dataKey" }
	| {
			key: K;
			label: string;
			type: "select";
			options: { value: string; label: string }[];
	  };

/** A fixed hex colour, or one derived from the active theme palette. */
export type TColorDefault = string | ((palette: IScenePalette) => string);

export interface IPartRenderProps<P, C extends string = string> {
	props: P;
	/** Each of its colours (its `colors`, by id) as it is right now: set, from data, or the default. */
	colors: Record<C, string>;
	palette: IScenePalette;
	/** False in edit mode or when motion is paused. */
	playing: boolean;
	/**
	 * Each of its lights (its `lights`, by id) as it is right now: whether it's
	 * on, its colour, how bright and how far it reaches (`resolveLights`,
	 * ADR-0058). Draw them with the helpers in lights.tsx.
	 */
	lights: Record<string, IResolvedLight>;
	/** The world's data, for parts that show values (absent in previews and thumbnails). */
	data?: TDataEntry[];
	/** Parts that set `rendersAsync` call this once everything they draw is built. */
	onReady?: () => void;
}

/**
 * A part is a parametric, procedurally built 3D object. Add new parts by
 * creating a definition with `definePart` and registering it in registry.ts.
 * See docs/adr/0005-procedural-part-registry.md.
 *
 * Conventions: origin at the centre of the footprint on the ground (y = 0),
 * "front" faces +Z, vehicles drive towards +X.
 */
export interface IPartDefinition<P extends object, C extends string = string> {
	kind: string;
	name: string;
	category: TPartCategory;
	description: string;
	/** Everyday words the palette search should also match, e.g. "boat" for a yacht. */
	keywords?: string[];
	/** Zod schema with defaults for every prop: `schema.parse({})` must succeed (a test checks). */
	schema: z.ZodType<P>;
	/**
	 * Props that were renamed: old name → new name. A world saved with the old
	 * name keeps its value (`resolveProps` reads it when the new one is missing).
	 * Never remove an entry. See docs/adr/0056-safe-schema-and-part-changes.md.
	 */
	renamedProps?: Readonly<Record<string, Extract<keyof P, string>>>;
	/**
	 * Props it no longer has, removed on purpose. Old worlds keep their values
	 * (unused); listing them tells the old-world tests it isn't a mistake.
	 */
	removedProps?: readonly string[];
	fields: TFieldSpec<Extract<keyof P, string>>[];
	/**
	 * Its colours (ADR-0060), in the order the Look tab shows them; the first is
	 * its main colour (label pins, swatches). Leave out what it doesn't have.
	 */
	colors: readonly IColorSpec<C>[];
	/** Width (x) and depth (z) at scale 1, used for selection and placement. */
	footprint: (props: P) => [number, number];
	/** Height at scale 1, used to anchor labels. */
	height: (props: P) => number;
	/** Whether the part can be set to follow a route. */
	canFollowPath?: boolean;
	/**
	 * Its lights (ADR-0058): windows, lamps, cabins, headlights, a rain light…
	 * Each gets a card in the Lights tab, and objects store their settings for
	 * it by its id. The part draws them where they are, from `lights` in its
	 * render props.
	 */
	lights?: ILightSpec[];
	/**
	 * Lights whose id changed: old id → new id, so objects keep their settings
	 * for them (like renamedProps). Never remove an entry.
	 */
	renamedLights?: Readonly<Record<string, string>>;
	/** It lies flat on the ground (a marked zone): other parts can be placed on top of it. */
	flat?: boolean;
	/** It builds its geometry asynchronously (e.g. text) and calls `onReady` when done. */
	rendersAsync?: boolean;
	Component: FC<IPartRenderProps<P, C>>;
}

/** Define a part; its colour ids type `colors` in its render props. */
export const definePart = <P extends object, const C extends string>(
	definition: IPartDefinition<P, C>,
) => definition;
