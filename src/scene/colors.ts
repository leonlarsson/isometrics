import type { IScenePalette } from "./theme";

/** A fixed hex colour, or one derived from the active theme palette. */
export type TColorDefault = string | ((palette: IScenePalette) => string);

/**
 * One of a thing's colours (ADR-0060): a part's (a house's roof), a fence
 * kind's, a road's, an area's or the ground's. What's drawn stores its setting
 * for it under its id (`ColorSettingSchema`) and can let data set it; the
 * properties show one per colour, in this order.
 */
export interface IColorSpec<C extends string = string> {
	/** Stable key settings are stored under, e.g. "roof". Never change it. */
	id: C;
	/** What the properties call it, e.g. "Roof". */
	name: string;
	/** Its colour until it's set: a hex colour, or one from the theme. */
	default: TColorDefault;
	/**
	 * Which of the old per-object fields older worlds (and AIs) kept it in: the
	 * first colour was `color`, the second `accent`. Moved into `colors` when a
	 * world is opened (`repairWorld`).
	 */
	legacy?: "color" | "accent";
	/**
	 * It's see-through, like glass (ADR-0090): settings can say how see-through
	 * it is (`transparency`, 0 solid to 1 clear), and until they do it's this.
	 * Only for glass with something behind it; see-through things can't be
	 * drawn together with their copies (ADR-0086).
	 */
	seeThrough?: { transparency: number };
}
