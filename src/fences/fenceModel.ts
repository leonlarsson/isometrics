import { resolveColor, resolveTransparency } from "#/parts/colorModel";
import { readScale, readSwitch } from "#/parts/dataBinding";
import { fenceLayout } from "#/scene/fences";
import { groundHeightAt, type TGroundWorld } from "#/scene/grounds";
import type { TFence, TFenceGate, TReadableValues } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { createFenceBuilder } from "./builder";
import { buildGateLeaves } from "./gates";
import { FENCE_STYLES } from "./registry";

/**
 * A fence as it is drawn right now (ADR-0103): its style's height and post
 * spacing unless it sets its own, how much of it is built (from data, else as
 * set), and its colours, which follow data like an object's (ADR-0060).
 */

/** The settings that say how a fence is laid out. */
export type TFenceShape = Pick<
	TFence,
	| "kind"
	| "points"
	| "loops"
	| "cornerRadius"
	| "height"
	| "postSpacing"
	| "builtShare"
	| "data"
	| "gates"
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
	data: TReadableValues | undefined,
) => readScale(fence.data.builtShare, data, { min: 0, max: 1 }) ?? fence.builtShare;

/** Whether a gate stands open now (ADR-0133): a gap always; a swinging gate from data while it follows a value, else as set. */
export const gateIsOpen = (
	gate: Pick<TFenceGate, "kind" | "isOpen" | "data">,
	data: TReadableValues | undefined,
) => gate.kind === "gap" || (readSwitch(gate.data.isOpen, data) ?? gate.isOpen);

/** Where its posts and spans are, on the ground under it (its grounds and areas, ADR-0155). */
export const layoutOfFence = (
	fence: TFenceShape,
	ground: TGroundWorld,
	data: TReadableValues | undefined,
) =>
	fenceLayout(
		fence,
		fenceSpacingOf(fence),
		(point) => groundHeightAt(ground, point),
		builtShareOf(fence, data),
	);

/** Its pieces, one geometry per colour id. */
export const buildFence = (
	fence: TFenceShape,
	ground: TGroundWorld,
	data: TReadableValues | undefined,
) => {
	const style = FENCE_STYLES[fence.kind];
	const builder = createFenceBuilder();
	const layout = layoutOfFence(fence, ground, data);
	const height = fenceHeightOf(fence);
	style.build({
		layout,
		height,
		builder,
		colorIds: Object.fromEntries(style.colors.map((spec) => [spec.id, spec.id])),
	});
	// Swinging gates' leaves, in the style's colours; a gap is only its two posts.
	for (const place of layout.gates) {
		const gate = fence.gates[place.index];
		if (gate?.kind === "swinging") {
			buildGateLeaves(
				builder,
				place,
				{ ...gate, isOpen: gateIsOpen(gate, data) },
				style.gate,
				height,
			);
		}
	}
	return builder.geometries();
};

/** Each of its colours as drawn now, by id, and how see-through it is. */
export const resolveFenceColors = (
	fence: Pick<TFence, "kind" | "colors">,
	palette: IScenePalette,
	data: TReadableValues | undefined,
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
