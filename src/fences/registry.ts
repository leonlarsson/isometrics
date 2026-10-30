import { FenceKindSchema, type TFenceKind } from "#/scene/schema";
import { variantName } from "#/scene/variants";

import { chainLinkFence01 } from "./chain_link_fence_01";
import { guardRail01 } from "./guard_rail_01";
import { hedge01 } from "./hedge_01";
import { picketFence01 } from "./picket_fence_01";
import { railFence01 } from "./rail_fence_01";
import { railing01 } from "./railing_01";
import { stoneWall01 } from "./stone_wall_01";
import type { IFenceStyle } from "./types";

/**
 * Every fence style (ADR-0103), in the order Add to scene lists them. A new
 * style is a file here, added to this list and to FenceKindSchema.
 */
export const FENCE_STYLE_LIST: readonly IFenceStyle[] = [
	picketFence01,
	railFence01,
	hedge01,
	stoneWall01,
	railing01,
	chainLinkFence01,
	guardRail01,
];

export const FENCE_STYLES = Object.fromEntries(
	FENCE_STYLE_LIST.map((style) => [style.id, style]),
) as Record<TFenceKind, IFenceStyle>;

const IDS = FenceKindSchema.options;

/** What a style is called, with its variant's number when its family has several ("Hedge 2"). */
export const FENCE_STYLE_LABELS = Object.fromEntries(
	FENCE_STYLE_LIST.map((style) => [style.id, variantName(style.id, style.name, IDS)]),
) as Record<TFenceKind, string>;
