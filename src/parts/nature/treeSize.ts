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
