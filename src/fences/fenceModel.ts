import { resolveColor, resolveTransparency } from "#/parts/colorModel";
import { readScale } from "#/parts/dataBinding";
import { groundHeightAt } from "#/scene/areas";
import { fenceLayout } from "#/scene/fences";
import type { TArea, TDataEntry, TFence } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { createFenceBuilder } from "./builder";
import { FENCE_STYLES } from "./registry";

/**
 * A fence as it is drawn right now (ADR-0103): its style's height and post
 * spacing unless it sets its own, how much of it is built (from data, else as
 * set), and its colours, which follow data like an object's (ADR-0060).
 */

/** The settings that say how a fence is laid out. */
export type TFenceShape = Pick<
	TFence,
	"kind" | "points" | "loops" | "cornerRadius" | "height" | "postSpacing" | "builtShare" | "data"
>;

/** Its height: its own, else its style's. */
export const fenceHeightOf = (fence: Pick<TFence, "kind" | "height">) =>
	fence.height ?? FENCE_STYLES[fence.kind].height;

/** The longest gap between posts: its own, else its style's. */
export const fenceSpacingOf = (fence: Pick<TFence, "kind" | "postSpacing">) =>
	fence.postSpacing ?? FENCE_STYLES[fence.kind].postSpacing;

/** How much of it is built, 0 to 1: from data while it follows a value that reads as a number. */
export const builtShareOf = (
	fence: Pick<TFence, "builtShare" | "data">,
	data: readonly TDataEntry[] | undefined,
) => readScale(fence.data.builtShare, data, { min: 0, max: 1 }) ?? fence.builtShare;

/** Where its posts and spans are, on the ground (the areas) under it. */
export const layoutOfFence = (
	fence: TFenceShape,
	areas: readonly TArea[],
	data: readonly TDataEntry[] | undefined,
) =>
	fenceLayout(
		fence,
		fenceSpacingOf(fence),
		(point) => groundHeightAt(areas, point),
		builtShareOf(fence, data),
	);

/** Its pieces, one geometry per colour id. */
export const buildFence = (
	fence: TFenceShape,
	areas: readonly TArea[],
	data: readonly TDataEntry[] | undefined,
) => {
	const style = FENCE_STYLES[fence.kind];
	const builder = createFenceBuilder();
	style.build({
		layout: layoutOfFence(fence, areas, data),
		height: fenceHeightOf(fence),
		builder,
		colorIds: Object.fromEntries(style.colors.map((spec) => [spec.id, spec.id])),
	});
	return builder.geometries();
};

/** Each of its colours as drawn now, by id, and how see-through it is. */
export const resolveFenceColors = (
	fence: Pick<TFence, "kind" | "colors">,
	palette: IScenePalette,
	data: readonly TDataEntry[] | undefined,
) =>
	Object.fromEntries(
		FENCE_STYLES[fence.kind].colors.map((spec) => [
			spec.id,
			{
				color: resolveColor(spec, fence, palette, data),
				transparency: resolveTransparency(spec, fence),
			},
		]),
	);
