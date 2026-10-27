import type { TDataEntry, TEntity, TEntityColor } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { readColor } from "./dataBinding";
import type { IColorSpec, TColorDefault } from "./types";

/**
 * Colours as a shared model (ADR-0060), like lights (ADR-0058): a part
 * declares its colours (`IColorSpec`), an object stores a setting for some of
 * them by id (`TEntityColor`, null while it's as the part has it), and this
 * works out each colour for drawing: from data, else as set, else the part's.
 * No React here.
 */

/** What a part needs for its colours. */
export interface IPartColors {
	colors: readonly IColorSpec[];
}

/** What an object keeps about its colours: settings by id, and the fields older worlds used. */
export type TStoredColors = Pick<TEntity, "colors" | "color" | "accent">;

/** Settings that can follow data, and how each reads its value (`readColor` for now). */
export const COLOR_DATA = { color: "color" } as const;

export type TColorDataTarget = keyof typeof COLOR_DATA;

/** A fixed or theme colour as hex. */
export const resolveColorDefault = (value: TColorDefault, palette: IScenePalette) =>
	typeof value === "function" ? value(palette) : value;

/** An object's setting for one colour, if it has one. */
export const colorSettingOf = (entity: TStoredColors, id: string): TEntityColor | undefined =>
	entity.colors[id];

/**
 * A colour as it is while nothing sets it here: what an older world kept in
 * `color` or `accent`, else the part's default for the theme.
 */
export const colorDefault = (spec: IColorSpec, entity: TStoredColors, palette: IScenePalette) =>
	(spec.legacy ? entity[spec.legacy] : null) ?? resolveColorDefault(spec.default, palette);

/** One colour as it is right now: from data when the value reads as one, else as set, else its default. */
export const resolveColor = (
	spec: IColorSpec,
	entity: TStoredColors,
	palette: IScenePalette,
	data?: readonly TDataEntry[],
) => {
	const setting = colorSettingOf(entity, spec.id);
	return (
		readColor(setting?.data.color, data) ?? setting?.color ?? colorDefault(spec, entity, palette)
	);
};

/** Every colour of an object, by id, as the part draws them. */
export const resolveColors = (
	part: IPartColors,
	entity: TStoredColors,
	palette: IScenePalette,
	data?: readonly TDataEntry[],
): Record<string, string> =>
	Object.fromEntries(
		part.colors.map((spec) => [spec.id, resolveColor(spec, entity, palette, data)]),
	);

/** How see-through a colour is, 0 solid to 1 clear: as set, else the part's; 0 if it isn't see-through. */
export const resolveTransparency = (spec: IColorSpec, entity: TStoredColors) =>
	spec.seeThrough
		? (colorSettingOf(entity, spec.id)?.transparency ?? spec.seeThrough.transparency)
		: 0;

/** How see-through each of an object's colours is, by id (ADR-0090). */
export const resolveTransparencies = (
	part: IPartColors,
	entity: TStoredColors,
): Record<string, number> =>
	Object.fromEntries(part.colors.map((spec) => [spec.id, resolveTransparency(spec, entity)]));

const NO_COLORS: TStoredColors = { colors: {}, color: null, accent: null };

/** A part's colours as it has them (the palette, thumbnails, placing), and how see-through they are. */
export const resolvePartTransparencies = (part: IPartColors) =>
	resolveTransparencies(part, NO_COLORS);

/** A part's colours as it has them (the palette, thumbnails, placing). */
export const resolvePartColors = (part: IPartColors, palette: IScenePalette) =>
	resolveColors(part, NO_COLORS, palette);

/** An object's first two colours (swatches), the first standing in when it has only one. */
export const swatchColors = (colors: Record<string, string>, part: IPartColors) => {
	const [first, second] = part.colors.map((spec) => colors[spec.id]);
	return { first: first ?? "#999999", second: second ?? first ?? "#999999" };
};

/** Relative luminance check so pins and dots on white parts use the second colour instead. */
const isVeryLight = (hex: string) => {
	const n = Number.parseInt(hex.slice(1), 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.82;
};

/** Colour used for an object's label pin, leader line and card dot: its first colour, unless that's nearly white. */
export const resolveLabelColor = (
	part: IPartColors,
	entity: TStoredColors,
	palette: IScenePalette,
	data?: readonly TDataEntry[],
) => {
	const { first, second } = swatchColors(resolveColors(part, entity, palette, data), part);
	return isVeryLight(first) ? second : first;
};
