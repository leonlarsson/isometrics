import { useSyncExternalStore } from "react";

import { keepOnHotReload } from "#/lib/hot";
import type { TEntity, TScene } from "#/scene/schema";

import { useEditor } from "./store";

/** Each list of objects as a map by id, made once per list (lists are replaced, never changed). */
const mapsById = new WeakMap<TScene["entities"], Map<string, TEntity>>();

const byIdOf = (entities: TScene["entities"]) => {
	let byId = mapsById.get(entities);
	if (!byId) {
		byId = new Map(entities.map((entity) => [entity.id, entity]));
		mapsById.set(entities, byId);
	}
	return byId;
};

/**
 * Who listens for which object, and the list they were last told about. One subscription to the
 * store for all of them: a selector each would run thousands of them on every change.
 */
const registry = keepOnHotReload("entityListeners", () => ({
	listeners: new Map<string, Set<() => void>>(),
	told: null as TScene["entities"] | null,
	unsubscribe: null as (() => void) | null,
}));

/** Tells the listeners of each object that changed (or went away) since they were last told. */
const tellChanged = () => {
	const entities = useEditor.getState().scene.entities;
	if (entities === registry.told) {
		return;
	}
	const before = registry.told ? byIdOf(registry.told) : new Map<string, TEntity>();
	const now = byIdOf(entities);
	registry.told = entities;
	for (const [id, listeners] of registry.listeners) {
		if (now.get(id) !== before.get(id)) {
			for (const listener of listeners) {
				listener();
			}
		}
	}
};

/** Subscriptions by id, so a component's stays the same across renders. */
const subscriptions = new Map<string, (listener: () => void) => () => void>();

const subscribeTo = (id: string) => (listener: () => void) => {
	if (!registry.unsubscribe) {
		registry.told = useEditor.getState().scene.entities;
		registry.unsubscribe = useEditor.subscribe(tellChanged);
	}
	let listeners = registry.listeners.get(id);
	if (!listeners) {
		listeners = new Set();
		registry.listeners.set(id, listeners);
	}
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			registry.listeners.delete(id);
			subscriptions.delete(id);
		}
	};
};

/**
 * One object of the world, by id; the component renders again only when that object changes. For
 * what's drawn per object, thousands of times in a big world (ADR-0092).
 */
export const useEntity = (id: string) => {
	let subscribe = subscriptions.get(id);
	if (!subscribe) {
		subscribe = subscribeTo(id);
		subscriptions.set(id, subscribe);
	}
	return useSyncExternalStore(subscribe, () => byIdOf(useEditor.getState().scene.entities).get(id));
};
