import type { IColorSpec } from "./colors";

/** The ground's colours (ADR-0060): what `ground.colors` keeps settings for, by id. */
export const GROUND: { colors: readonly IColorSpec[] } = {
	colors: [{ id: "surface", name: "Surface", default: (palette) => palette.ground }],
};
