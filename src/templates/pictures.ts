import { SceneSchema, type TScene } from "#/scene/schema";
import type { TResolvedTheme } from "#/scene/theme";

import { createEmptyScene } from "./empty";
import { TEMPLATES } from "./index";

/**
 * The pictures of the built-in worlds (ADR-0146): the starters' and the Blank
 * card's at each ground size, rendered from the worlds themselves ahead of
 * time by `scripts/starter-pictures.mjs` and shipped as files in
 * `public/starters/`, so the welcome and File → New world show them without
 * drawing anything. The editor draws a picture live only for what has no file.
 */

/** Ground sizes to start a blank world from; any exact size can be set later in the World tab. */
export const GROUND_PRESETS = {
	corner: { name: "Corner", width: 24, depth: 18, fits: "a street corner" },
	blocks: { name: "Blocks", width: 40, depth: 30, fits: "a few blocks" },
	district: { name: "District", width: 80, depth: 60, fits: "a neighbourhood" },
	town: { name: "Town", width: 120, depth: 90, fits: "a small town" },
	city: { name: "City", width: 240, depth: 180, fits: "a whole city" },
};

export type TGroundPreset = keyof typeof GROUND_PRESETS;

export const GROUND_PRESET_IDS = Object.keys(GROUND_PRESETS) as TGroundPreset[];

/** The Blank card's picture for a ground size, by its id (`blank-blocks`). */
export const blankPictureId = (preset: TGroundPreset) => `blank-${preset}`;

/**
 * The Blank card's picture for a ground size: the bare ground with a house, a
 * tree and a car in the middle, which stay the same size as the ground grows,
 * so the picture shows how big it is. They aren't in the world it creates.
 */
export const blankPictureScene = (preset: TGroundPreset) => {
	const { width, depth } = GROUND_PRESETS[preset];
	return SceneSchema.parse({
		...createEmptyScene({ ground: { width, depth } }),
		entities: [
			{ id: "scale_house", kind: "house_01", position: [-1.2, 0] },
			{ id: "scale_tree", kind: "round_tree_01", position: [1.4, -0.9] },
			{ id: "scale_car", kind: "car_01", position: [1.6, 1.3] },
		],
	});
};

/** A built-in world with a picture: `create` is only called when the picture is rendered. */
export interface IStarterPictureSource {
	id: string;
	create: () => TScene;
}

/** Every built-in picture: the Blank card's at each ground size, then each starter's. */
export const STARTER_PICTURE_SOURCES: IStarterPictureSource[] = [
	...GROUND_PRESET_IDS.map((preset) => ({
		id: blankPictureId(preset),
		create: () => blankPictureScene(preset),
	})),
	...TEMPLATES.map(({ id, create }) => ({ id, create })),
];

/** Where a built-in world's picture is, for a theme (this site's own address), or null for any other. */
export const starterPictureOf = (id: string, theme: TResolvedTheme) =>
	STARTER_PICTURE_SOURCES.some((source) => source.id === id)
		? `/starters/${id}-${theme}.webp`
		: null;

/** Where a starter's link preview is, on this site (a JPEG on the light background), or null. */
export const starterPreviewOf = (id: string) =>
	TEMPLATES.some((template) => template.id === id) ? `/starters/${id}-preview.jpg` : null;
