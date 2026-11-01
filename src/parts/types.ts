import type { FC } from "react";
import type { z } from "zod";

import type { IColorSpec, TColorDefault } from "#/scene/colors";
import type { TComesOn, TDataValue } from "#/scene/schema";
import type { ISunPosition } from "#/scene/sun";
import type { IScenePalette } from "#/scene/theme";

/**
 * What a light looks like, which also says which settings it has: a `lens`
 * (a small glowing surface, e.g. a rain light), a `beam` (a fan of light on
 * the road ahead, e.g. headlights), a `pool` (a round glow on the ground, e.g.
 * a lamp), `windows` (a building's lit windows) or a `glow` (a glowing surface,
 * e.g. a cabin or doorway). Beams and pools have a reach.
 */
export type TLightShape = "lens" | "beam" | "pool" | "windows" | "glow";

export type { IColorSpec, TColorDefault };

/** Light shapes that light the ground, and so have a reach. */
export const LIGHT_SHAPES_WITH_REACH: readonly TLightShape[] = ["beam", "pool"];

/**
 * Where a light lights its surroundings from as a real light (ADR-0072): a
 * point in the part's own space (before the object's scale and turn, front
 * +Z, vehicles +X).
 */
export interface IRealLightSource {
	at: [number, number, number];
	/**
	 * How far it lights round it, in grid units at scale 1, for lights without a
	 * reach of their own (windows, glows); beams and pools use theirs.
	 */
	reach?: number;
}

/** One of a part's lights (ADR-0058). Its look and place are the part's; objects can change the rest. */
export interface ILightSpec<P extends object = Record<string, unknown>> {
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
	/** Window lights: the share of its own panes that are lit, 0–1 (all of them if left out). */
	litPaneShare?: number;
	/**
	 * Window lights: how many of the building's panes are its, relative to its
	 * other window lights' pane weights (9 and 1: nine panes in ten are its); 1 if
	 * left out. Changing it moves which panes are whose.
	 */
	paneWeight?: number;
	/**
	 * How it comes on after dark: "atOnce" (the default), "oneByOne" (window
	 * lights: pane after pane as it gets darker) or "gradually" (fading in).
	 */
	comesOn?: TComesOn;
	/**
	 * When it's on by itself: "dark" (the default) after dark; "driving" after
	 * dark while it drives along a road; "always" day and night (a traffic
	 * signal), dimmer by day so it doesn't glow in the sun.
	 */
	when?: "dark" | "driving" | "always";
	/**
	 * Settings older worlds kept elsewhere (props, the accent colour) before this
	 * light had its own: read once when a world is opened (`repairWorld`), into the
	 * object's settings for it where they're unset.
	 */
	legacy?: (stored: { props: Record<string, unknown>; accent: string | null }) => {
		color?: string | null;
		strength?: number | null;
		reach?: number | null;
	};
	/**
	 * Lights the streets, walls and water round it as a real light too, from
	 * here, when the graphics settings draw real lights at night (ADR-0072);
	 * without it, the light is painted only. A part with several lights in one
	 * place gives it to one of them. Several sources for a light that shines
	 * from several places, like a tower's windows on each of its sides.
	 */
	realLight?(props: P): IRealLightSource | IRealLightSource[];
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
	litPaneShare: number;
	/** Window lights: how many of the building's panes are its, relative to the others' weights. */
	paneWeight: number;
}

export type TPartCategory =
	| "buildings"
	| "vehicles"
	| "nature"
	| "furniture"
	| "infrastructure"
	| "markers";

export const CATEGORY_LABELS: Record<TPartCategory, string> = {
	buildings: "Buildings",
	vehicles: "Vehicles",
	nature: "Nature",
	furniture: "Street furniture",
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
			/**
			 * Values worth one click, shown as chips under the slider (the chip of
			 * the value it has looks chosen), e.g. standard container lengths.
			 */
			presets?: { label: string; value: number }[];
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

export interface IPartRenderProps<P, C extends string = string> {
	props: P;
	/** Each of its colours (its `colors`, by id) as it is right now: set, from data, or the default. */
	colors: Record<C, string>;
	/** How see-through each colour is, 0 solid to 1 clear (ADR-0090): 0 unless it's `seeThrough`. */
	transparency: Record<C, number>;
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
	data?: readonly TDataValue[];
	/** Where the sun is now, for parts that follow it (`followsTheSun`); undefined otherwise. */
	sun?: ISunPosition;
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
	 * name keeps its value: `repairWorld` moves it to the new name, and
	 * `resolveProps` reads it there too when the new one is missing.
	 * Never remove an entry. Renamed again: point every older name at the newest,
	 * oldest first (`{ pulse: "flashes", pulses: "flashes" }`; of several stored,
	 * the latest listed wins). See docs/adr/0056-safe-schema-and-part-changes.md.
	 */
	renamedProps?: Readonly<Record<string, Extract<keyof P, string>>>;
	/**
	 * Props it no longer has, removed on purpose. Old worlds keep their values
	 * (unused); listing them tells the old-world tests it isn't a mistake.
	 */
	removedProps?: readonly string[];
	/**
	 * Props older worlds had that sized the whole part evenly, as an object's
	 * `scale` does: when a world is opened (`repairWorld`) each is multiplied into
	 * the scale and removed. List them in removedProps too. Never remove an entry.
	 */
	foldedIntoScale?: readonly string[];
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
	/**
	 * Wider overhead than at its foot (a parasol over a table): what stands on the
	 * ground (width, depth at scale 1), and from what height the rest of its
	 * footprint begins, so things can stand under it.
	 */
	overhang?: (props: P) => { foot: [number, number]; from: number };
	/** Whether the part can be set to follow a route. */
	canFollowPath?: boolean;
	/**
	 * It leaves a wake on the water while it follows a route (ADR-0081): how
	 * wide it is where the wake starts, and how far behind its centre that is
	 * (in its own space, at scale 1).
	 */
	wake?: (props: P) => { width: number; behind: number };
	/**
	 * How it leans in turns while it follows a route (ADR-0082): degrees of lean
	 * per unit of sideways acceleration (speed² × how sharply the route bends;
	 * negative leans out of the turn, like a car's body), and at most how far.
	 * Planes and helicopters bank this way too.
	 */
	turnLean?: { degreesPerAcceleration: number; maxDegrees: number };
	/**
	 * Its lights (ADR-0058): windows, lamps, cabins, headlights, a rain light…
	 * Each gets a card in the Lights tab, and objects store their settings for
	 * it by its id. The part draws them where they are, from `lights` in its
	 * render props.
	 */
	lights?: ILightSpec<P>[];
	/**
	 * Lights whose id changed: old id → new id, so objects keep their settings
	 * for them (like renamedProps). Never remove an entry.
	 */
	renamedLights?: Readonly<Record<string, string>>;
	/** It lies flat on the ground (a marked zone): other parts can be placed on top of it. */
	flat?: boolean;
	/** It builds its geometry asynchronously (e.g. text) and calls `onReady` when done. */
	rendersAsync?: boolean;
	/**
	 * It moves pieces of itself every frame (`useFrame`: a turning beam, a pulsing ring), so its
	 * matrices are kept up to date each frame like a driving vehicle's (ADR-0092). Objects that
	 * stand still are only placed when they change. A test checks parts using useFrame say so.
	 */
	movesOnItsOwn?: boolean;
	/**
	 * It turns with the sun (solar panels that track it), when this says so for
	 * its props: it gets `sun` in its render props and draws again as the
	 * world's hour moves on. Only such objects follow the hour, so it costs
	 * nothing for the rest.
	 */
	followsTheSun?: (props: P) => boolean;
	Component: FC<IPartRenderProps<P, C>>;
}

/** Define a part; its colour ids type `colors` in its render props. */
export const definePart = <P extends object, const C extends string>(
	definition: IPartDefinition<P, C>,
) => definition;
