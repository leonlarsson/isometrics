import type { IRoadNetwork } from "./junctions";
import { createNetworkTrip } from "./network";
import type { TDrivingSide, TRoad } from "./schema";

/**
 * The size of a road's flow (ADR-0112, ADR-0135), where both drawing it and
 * checking a world (ADR-0117) need it, and the trips of a flow that drives on
 * through junctions (ADR-0147). No React.
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

/**
 * Whether a road's flow drives on through junctions onto other roads (ADR-0147): it's shown, its
 * own switch is on, and the road has a junction at an end. Otherwise its vehicles keep to the
 * road, as flows always have. Never the world's or the road's traffic switch: those are for vehicle
 * objects, and a flow showing an amount must stay on the road it's for.
 */
export const flowDrivesOn = (
	network: Pick<IRoadNetwork, "connects">,
	road: Pick<TRoad, "id"> & { flow: Pick<TRoad["flow"], "enabled" | "drivesThroughJunctions"> },
) => road.flow.enabled && road.flow.drivesThroughJunctions && network.connects(road.id);

/**
 * How big a flow's vehicle is drawn, from 0 to 1 of its size, once it has come `driven` along its
 * stream (from where the stream starts, its start place included) on a road `length` long. On its
 * own road it grows in at the start and shrinks out at the end, every time round, so the jump back
 * isn't seen; driving on, it grows in once, at the start, and is whole from then on.
 */
export const flowVehicleSize = (driven: number, length: number, drivesOn: boolean) => {
	if (drivesOn) {
		return Math.min(1, driven / FLOW_EASE_LENGTH);
	}
	const along = length > 0 ? driven % length : 0;
	return Math.min(1, along / FLOW_EASE_LENGTH, (length - along) / FLOW_EASE_LENGTH);
};

/**
 * What seeds a flow vehicle's choices at junctions: its road, its way and its place in its stream,
 * so it takes the same way every time the world plays.
 */
export const flowVehicleSeed = (roadId: string, reverse: boolean, index: number) =>
	`flow:${roadId}:${reverse ? "against" : "along"}:${index}`;

export interface IFlowTripOptions {
	driving: TDrivingSide;
	/** Heading smoothing (see `turnSmoothing`). */
	smoothing: number;
	/** Drives the road against the order of its points (the flow's other way). */
	reverse: boolean;
	/** Where it starts along its stream, from where the stream starts (`flowOffsets`). */
	offset: number;
	/** The road's length, the stream's. */
	length: number;
	/** Its place in its stream. */
	index: number;
}

/**
 * The trip of one vehicle of a flow that drives on (ADR-0147): from where it starts along its
 * road, on across the network as a vehicle object that follows the road drives (ADR-0136).
 */
export const createFlowTrip = (
	network: IRoadNetwork,
	roadId: string,
	{ driving, smoothing, reverse, offset, length, index }: IFlowTripOptions,
) =>
	createNetworkTrip(network, roadId, {
		driving,
		smoothing,
		reverse,
		// A trip's start is from the road's first point, whichever way it drives.
		startDistance: reverse ? length - offset : offset,
		seed: flowVehicleSeed(roadId, reverse, index),
		// Spread along the road, they start over at its start, not in the traffic behind them.
		startsOverAtRoadStart: true,
	});
