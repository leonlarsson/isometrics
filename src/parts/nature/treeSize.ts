import { z } from "zod";

import type { TFieldSpec } from "../types";

/** The size setting both trees share. */
export const TreeSizeSchema = z.object({
	size: z.number().min(0.3).max(4).default(1),
});

type TTreeSize = z.output<typeof TreeSizeSchema>;

export const treeSizeFields: TFieldSpec<keyof TTreeSize>[] = [
	{ key: "size", label: "Size", type: "number", min: 0.3, max: 4, step: 0.1 },
];

/**
 * Brightwater and Monaco saved by 387d004 stored their trees' size as
 * letterHeight (the text sign's renamed size, applied to the trees by
 * mistake), so worlds saved then read it back as the size.
 */
export const treeRenamedProps = { letterHeight: "size" } as const;
