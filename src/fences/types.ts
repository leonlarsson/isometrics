import type { IColorSpec } from "#/parts/types";
import type { IFenceLayout } from "#/scene/fences";
import type { TFenceStyle } from "#/scene/schema";

import type { IFenceBuilder } from "./builder";

/** What a style's `build` gets: where the posts and spans are, how tall, and the builder. */
export interface IFenceBuildContext<C extends string = string> {
	layout: IFenceLayout;
	/** Its height in grid units (the fence's, else the style's). */
	height: number;
	builder: IFenceBuilder;
	/** The style's colour ids, to say which colour each piece is. */
	colorIds: Readonly<Record<C, C>>;
}

/**
 * A look for fences (ADR-0103), one file per style in this folder, like parts:
 * what it's called, its own height and post spacing, its colours, and how it's
 * built from a layout's posts and spans.
 */
export interface IFenceStyle<C extends string = string> {
	id: TFenceStyle;
	/** Its family's name ("Picket fence"); variants get a number after it. */
	name: string;
	/** What it is, for Add to scene and the format guide. */
	description: string;
	/** Everyday words Add to scene's search finds it by. */
	keywords?: readonly string[];
	/** Its height in grid units while the fence doesn't set one. */
	height: number;
	/** The longest gap between posts while the fence doesn't set one. */
	postSpacing: number;
	/** Its colours, as parts list theirs (ADR-0060): ids are stable, never rename one. */
	colors: readonly IColorSpec<C>[];
	build: (context: IFenceBuildContext<C>) => void;
}

/** A fence style, typed by its colour ids so `build` can only use colours it has. */
export const defineFenceStyle = <C extends string>(style: IFenceStyle<C>) =>
	style as unknown as IFenceStyle;
