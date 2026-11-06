import type { TRoad } from "./schema";

/**
 * The size of a road's flow (ADR-0112, ADR-0135), where both drawing it and
 * checking a world (ADR-0117) need it. No React.
 */

/** How far from a stream's ends a flow's vehicles grow in and shrink out, in grid units. */
export const FLOW_EASE_LENGTH = 1.5;

/**
 * How long a flow's vehicles are on its road: their part's length at the
 * flow's vehicle size (ADR-0135), which spaces them and rounds their turns.
 */
export const flowVehicleLength = (flow: Pick<TRoad["flow"], "vehicleScale">, partLength: number) =>
	partLength * flow.vehicleScale;

/**
 * The shortest road a flow's vehicles reach their full size on: grown in at
 * one end, a whole vehicle, then shrinking out at the other.
 */
export const shortestRoadForFlow = (vehicleLength: number) => 2 * FLOW_EASE_LENGTH + vehicleLength;
