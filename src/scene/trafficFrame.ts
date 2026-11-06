import type { IRouteSampler, ITrafficPlace } from "./routes";
import {
	giveWayStops,
	type IJunctionVehicle,
	type ITrafficCar,
	type ITrafficState,
	stepRoadTraffic,
} from "./traffic";

/**
 * One frame of every driving vehicle's traffic (ADR-0042, ADR-0136, ADR-0148): grouped by the road
 * each is on now, giving way at junctions where a road is one-way, keeping their distance through
 * junctions, and moved. Framework-free, so the editor's TrafficStep, tests and benchmarks run the
 * same step. Runtime only: nothing here is saved.
 */

/** A vehicle on a road, kept up to date by whatever draws it, and moved by the traffic. */
export interface IDrivingVehicle {
	roadId: string;
	sampler: IRouteSampler;
	offset: number;
	/** The speed it's set to drive. */
	speed: number;
	length: number;
	/** Distance driven since it set off. */
	travelled: number;
	/** Its traffic state (speed now, how far out it is overtaking), once it has one. */
	state: ITrafficState | null;
}

/** How far past the end of its road a vehicle looks for the one ahead on the road it goes on to. */
const LOOKS_BEYOND = 30;
/** How far before a junction's line a vehicle that gives way stops. */
const GIVE_WAY_MARGIN = 0.3;

/** A vehicle placed in its road's traffic this frame. */
interface IPlaced {
	id: string;
	vehicle: IDrivingVehicle;
	place: ITrafficPlace;
}

/**
 * For vehicles on a road network (ADR-0136): the nearest vehicle on the road each goes on to,
 * driving the way it will, so queues carry through junctions.
 */
const beyondOf = (placed: IPlaced, byStream: Map<string, IPlaced[]>) => {
	const next = placed.place.network?.next;
	if (!next || next.distance > LOOKS_BEYOND) {
		return null;
	}
	let best: IPlaced | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const other of byStream.get(`${next.roadId}:${next.direction}`) ?? []) {
		if (other.id === placed.id) {
			continue;
		}
		const distance = next.distance + (other.place.position - next.along);
		if (distance > 0 && distance < bestDistance) {
			best = other;
			bestDistance = distance;
		}
	}
	if (!best || bestDistance > LOOKS_BEYOND) {
		return null;
	}
	return {
		distance: bestDistance,
		length: best.vehicle.length,
		speed: best.vehicle.state?.speed ?? best.vehicle.speed,
	};
};

/**
 * Moves every vehicle by `dt` seconds. `roadStates` is what the traffic remembers per road between
 * frames (kept by the caller). With `keepsDistance` off, each drives at its own speed, through the
 * others.
 */
export const stepAllTraffic = (
	vehicles: Map<string, IDrivingVehicle>,
	roadStates: Map<string, Map<string, ITrafficState>>,
	dt: number,
	{ keepsDistance, overtakes }: { keepsDistance: boolean; overtakes: boolean },
) => {
	if (!keepsDistance) {
		roadStates.clear();
		for (const vehicle of vehicles.values()) {
			vehicle.travelled += vehicle.speed * dt;
			vehicle.state = null;
		}
		return;
	}
	// By the road each is on now: its own road, or on a network the one it has driven on to.
	const roads = new Map<string, IPlaced[]>();
	const atJunctions: IJunctionVehicle[] = [];
	const byStream = new Map<string, IPlaced[]>();
	const addTo = (lists: Map<string, IPlaced[]>, key: string, placed: IPlaced) => {
		const list = lists.get(key);
		if (list) {
			list.push(placed);
		} else {
			lists.set(key, [placed]);
		}
	};
	for (const [id, vehicle] of vehicles) {
		const place = vehicle.sampler.place(vehicle.offset, vehicle.travelled);
		const placed = { id, vehicle, place };
		addTo(roads, place.network ? `network:${place.network.roadId}` : vehicle.roadId, placed);
		const network = place.network;
		if (network) {
			addTo(byStream, `${network.roadId}:${place.direction}`, placed);
		}
		// At junctions where a road is one-way, vehicles from different ends take turns (ADR-0148).
		if (network?.junctionAhead) {
			const { id: junctionId, from, entersIn } = network.junctionAhead;
			atJunctions.push({ id, junctionId, from, entersIn, length: vehicle.length });
		}
		if (network?.junctionBehind) {
			const { id: junctionId, from, leftBy } = network.junctionBehind;
			atJunctions.push({ id, junctionId, from, leftBy, length: vehicle.length });
		}
	}
	const stops = atJunctions.length > 0 ? giveWayStops(atJunctions) : null;
	for (const [roadId, list] of roads) {
		const first = list[0];
		const length = first.place.network?.length ?? first.vehicle.sampler.length;
		if (length === 0) {
			continue;
		}
		const cars: ITrafficCar[] = list.map((placed) => {
			const { id, vehicle, place } = placed;
			let beyond = place.network ? beyondOf(placed, byStream) : null;
			// Waiting at a junction's line: as if behind a vehicle standing there.
			const stop = stops?.get(id);
			if (stop !== undefined && (!beyond || beyond.distance - beyond.length / 2 > stop)) {
				beyond = { distance: Math.max(0, stop - GIVE_WAY_MARGIN), length: 0, speed: 0 };
			}
			return {
				id,
				stream: place.stream,
				ring: place.ring,
				position: place.position,
				centre: place.centre,
				direction: place.direction,
				turning: place.turning,
				length: vehicle.length,
				speed: vehicle.speed,
				beyond,
			};
		});
		// A network road is driven one way at a time between junctions, never round.
		const loop = !first.place.network && cars[0].stream !== "both";
		const states = roadStates.get(roadId) ?? new Map<string, ITrafficState>();
		roadStates.set(roadId, states);
		// A vehicle that has just driven on to this road keeps its speed (a queue stays a queue).
		for (const { id, vehicle } of list) {
			if (!states.has(id) && vehicle.state) {
				states.set(id, { ...vehicle.state, shift: 0, shiftRate: 0, passing: null });
			}
		}
		// A one-way road has no oncoming lane to overtake in (ADR-0148).
		const moves = stepRoadTraffic(
			{ length, loop, overtakes: overtakes && !first.place.isOneWay },
			cars,
			states,
			dt,
		);
		for (const { id, vehicle } of list) {
			vehicle.travelled += moves.get(id) ?? 0;
			vehicle.state = states.get(id) ?? null;
		}
	}
	for (const roadId of roadStates.keys()) {
		if (!roads.has(roadId)) {
			roadStates.delete(roadId);
		}
	}
};
