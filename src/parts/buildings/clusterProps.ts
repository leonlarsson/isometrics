import { z } from "zod";

import type { TFieldSpec } from "../types";

/** The props every building cluster has, the same names on each so data and settings carry across. */
export const ClusterSchema = z.object({
	/** How much of the cluster is built, 0–1: one building at 0, all of them at 1. */
	builtShare: z.number().min(0).max(1).default(0.6),
	/** The cluster's diameter, in grid units: its buildings stay inside it. */
	width: z.number().min(3).max(30).default(8),
	/** Another arrangement of the same cluster. */
	seed: z.number().int().min(1).max(999).default(1),
});

export type TClusterProps = z.output<typeof ClusterSchema>;

export const CLUSTER_FIELDS: TFieldSpec<keyof TClusterProps>[] = [
	{ key: "builtShare", label: "Built", type: "number", min: 0, max: 1, step: 0.01 },
	{ key: "width", label: "Width", type: "number", min: 3, max: 30, step: 0.5 },
	{ key: "seed", label: "Arrangement", type: "number", min: 1, max: 999, step: 1 },
];
