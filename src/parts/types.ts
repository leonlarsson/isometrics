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

/** Describes one editable part parameter so the inspector can render a control. */
export type TFieldSpec =
	| {
			key: string;
			label: string;
			type: "number";
			min: number;
			max: number;
			step: number;
	  }
	| { key: string; label: string; type: "boolean" }
	| { key: string; label: string; type: "text"; placeholder?: string }
	/** One of the world's data keys, or "" for none (ADR-0041). Renamed and removed with the key. */
	| { key: string; label: string; type: "dataKey" }
	| {
			key: string;
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
	/** Zod schema with defaults for every prop: `schema.parse({})` must succeed. */
	schema: z.ZodType<P>;
	fields: TFieldSpec[];
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
	/** It builds its geometry asynchronously (e.g. text) and calls `onReady` when done. */
	rendersAsync?: boolean;
	Component: FC<IPartRenderProps<P>>;
}

export const definePart = <P extends object>(definition: IPartDefinition<P>) => definition;
