import type { FC } from "react";
import type { z } from "zod";

import type { TDataEntry } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

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

export interface IPartRenderProps<P> {
	props: P;
	color: string;
	accent: string;
	palette: IScenePalette;
	/** False in edit mode or when motion is paused. */
	playing: boolean;
	/**
	 * Its lights are switched on (its Lights setting, `lightsFor`): after dark
	 * by default (a vehicle's only while it drives), always, or never. Lights
	 * that are on shine as much as `palette.night` says.
	 */
	lightsOn?: boolean;
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
export interface IPartDefinition<P extends object> {
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
	defaultColor: TColorDefault;
	defaultAccent: TColorDefault;
	colorLabel?: string;
	accentLabel?: string;
	/** Width (x) and depth (z) at scale 1, used for selection and placement. */
	footprint: (props: P) => [number, number];
	/** Height at scale 1, used to anchor labels. */
	height: (props: P) => number;
	/** Whether the part can be set to follow a route. */
	canFollowPath?: boolean;
	/**
	 * Its lights (windows, lamps, cabins, headlights), switched by its Lights
	 * setting in the inspector; absent = it has none. `whileDriving`: by default
	 * they're on only while it drives along a road (a vehicle's headlights).
	 */
	lights?: { whileDriving?: boolean };
	/** It lies flat on the ground (a marked zone): other parts can be placed on top of it. */
	flat?: boolean;
	/** It builds its geometry asynchronously (e.g. text) and calls `onReady` when done. */
	rendersAsync?: boolean;
	Component: FC<IPartRenderProps<P>>;
}

export const definePart = <P extends object>(definition: IPartDefinition<P>) => definition;
