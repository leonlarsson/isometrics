import { useSyncExternalStore } from "react";

import { keepOnHotReload } from "#/lib/hot";
import type { TEntity } from "#/scene/schema";

/**
 * Where each vehicle driving a road network is now (ADR-0136): the road its
 * trip has taken it onto, which way it drives it and how far along. A
 * vehicle's saved `follow` is only where it starts; everything that shows the
 * road it's on (the route highlight, the Motion tab, framing it, a road's
 * count of vehicles) reads it here, and falls back to `follow` for a vehicle
 * that isn't on a network or hasn't drawn yet. Runtime only, never saved;
 * written by each vehicle as it's drawn (render/EntityNode), so it stays on
 * the road a vehicle stopped on while motion is paused.
 */

export interface IVehicleNow {
	roadId: string;
	/** Driving against the order of the road's points. */
	drivesTheOtherWay: boolean;
	/** How far along the road it is, from its first point. */
	centre: number;
}

const kept = keepOnHotReload("vehiclesNow", () => ({
	places: new Map<string, IVehicleNow>(),
	listeners: new Set<() => void>(),
	/** The places as they were after the last change of road: replaced on each, for React. */
	snapshot: new Map<string, IVehicleNow>() as ReadonlyMap<string, IVehicleNow>,
}));

const changed = () => {
	kept.snapshot = new Map(kept.places);
	for (const listener of kept.listeners) {
		listener();
	}
};

/** Where a vehicle on a network is now, or null if it isn't on one (or hasn't drawn yet). */
export const vehicleNow = (entityId: string): IVehicleNow | null =>
	kept.places.get(entityId) ?? null;

/**
 * Says where a vehicle is now. Cheap to call every frame: views are told only
 * when its road or its way along it changes.
 */
export const setVehicleNow = (entityId: string, now: IVehicleNow) => {
	const was = kept.places.get(entityId);
	if (was && was.roadId === now.roadId && was.drivesTheOtherWay === now.drivesTheOtherWay) {
		was.centre = now.centre;
		return;
	}
	kept.places.set(entityId, { ...now });
	changed();
};

/** Forgets a vehicle: it stopped driving, or drives no network, or is gone. */
export const forgetVehicleNow = (entityId: string) => {
	if (kept.places.delete(entityId)) {
		changed();
	}
};

/**
 * The road a vehicle is on now and which way it drives it: where its trip
 * has taken it, else the road it follows from the start; null if it's parked.
 */
export const roadOfVehicleNow = (
	entity: Pick<TEntity, "id" | "follow">,
	places: ReadonlyMap<string, IVehicleNow> = kept.places,
): { roadId: string; drivesTheOtherWay: boolean } | null => {
	if (!entity.follow) {
		return null;
	}
	const now = places.get(entity.id);
	return now
		? { roadId: now.roadId, drivesTheOtherWay: now.drivesTheOtherWay }
		: { roadId: entity.follow.roadId, drivesTheOtherWay: entity.follow.drivesTheOtherWay };
};

/** Calls `listener` whenever a vehicle drives onto another road or turns round; returns the unsubscribe. */
export const subscribeToVehiclesNow = (listener: () => void) => {
	kept.listeners.add(listener);
	return () => {
		kept.listeners.delete(listener);
	};
};

const NONE: ReadonlyMap<string, IVehicleNow> = new Map();

/**
 * Where the vehicles on networks are now, for a component: a new map whenever one drives onto
 * another road or turns round (hand it to `roadOfVehicleNow`).
 */
export const useVehiclesNow = () =>
	useSyncExternalStore(
		subscribeToVehiclesNow,
		() => kept.snapshot,
		() => NONE,
	);
