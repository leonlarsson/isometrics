import type { TColorSetting, TReadableValues } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { readColor } from "./dataBinding";
import type { IColorSpec, TColorDefault } from "./types";

/**
 * Colours as a shared model (ADR-0060), like lights (ADR-0058): a part (or
 * a fence kind, a road, an area, the ground) declares its colours
 * (`IColorSpec`), what's drawn stores a setting for some of them by id
 * (`TColorSetting`, null while it's as declared), and this works out each
 * colour for drawing: from data, else as set, else the default. No React here.
 */

/** What a part (or anything else drawn in colours) declares about them. */
export interface IPartColors {
	colors: readonly IColorSpec[];
}

/** What's kept about something's colours: its settings by id. */
export interface IStoredColors {
	colors: Readonly<Record<string, TColorSetting>>;
}

/** Settings that can follow data, and how each reads its value (`readColor` for now). */
export const COLOR_DATA = { color: "color" } as const;

export type TColorDataTarget = keyof typeof COLOR_DATA;

/** A fixed or theme colour as hex. */
export const resolveColorDefault = (value: TColorDefault, palette: IScenePalette) =>
	typeof value === "function" ? value(palette) : value;

/** The setting for one colour, if there is one. */
export const colorSettingOf = (stored: IStoredColors, id: string): TColorSetting | undefined =>
	stored.colors[id];

/** One colour as it is right now: from data when the value reads as one, else as set, else its default. */
export const resolveColor = (
	spec: IColorSpec,
	stored: IStoredColors,
	palette: IScenePalette,
	data?: TReadableValues,
) => {
	const setting = colorSettingOf(stored, spec.id);
	return (
		readColor(setting?.data.color, data) ??
		setting?.color ??
		resolveColorDefault(spec.default, palette)
	);
};

/** Every colour of an object, by id, as the part draws them. */
export const resolveColors = (
	part: IPartColors,
	entity: IStoredColors,
	palette: IScenePalette,
	data?: TReadableValues,
): Record<string, string> =>
	Object.fromEntries(
		part.colors.map((spec) => [spec.id, resolveColor(spec, entity, palette, data)]),
	);

/**
 * One of something's colours by id as drawn now: a road's, an area's or the
 * ground's (ADR-0104), or a part's. `fallback` when it has no colour by that id.
 */
export const colorOf = (
	holder: IPartColors,
	stored: IStoredColors,
	id: string,
	palette: IScenePalette,
	data?: TReadableValues,
	fallback = "#999999",
) => {
	const spec = holder.colors.find((color) => color.id === id);
	return spec ? resolveColor(spec, stored, palette, data) : fallback;
};

/** How see-through a colour is, 0 solid to 1 clear: as set, else the part's; 0 if it isn't see-through. */
export const resolveTransparency = (spec: IColorSpec, entity: IStoredColors) =>
	spec.seeThrough
		? (colorSettingOf(entity, spec.id)?.transparency ?? spec.seeThrough.transparency)
		: 0;

/** How see-through each of an object's colours is, by id (ADR-0090). */
export const resolveTransparencies = (
	part: IPartColors,
	entity: IStoredColors,
): Record<string, number> =>
	Object.fromEntries(part.colors.map((spec) => [spec.id, resolveTransparency(spec, entity)]));

const NO_COLORS: IStoredColors = { colors: {} };

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
	entity: IStoredColors,
	palette: IScenePalette,
	data?: TReadableValues,
) => {
	const { first, second } = swatchColors(resolveColors(part, entity, palette, data), part);
	return isVeryLight(first) ? second : first;
};
