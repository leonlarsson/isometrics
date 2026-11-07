import { useSyncExternalStore } from "react";

import { keepOnHotReload } from "#/lib/hot";

import type { ISceneItem } from "./framing";
import { type IEditorState, includesItem, useEditor } from "./store";

/** An object's flags (useEntityFlags), one bit each. */
export const SELECTED = 1;
/** The only thing selected: it alone gets a gizmo and size handles (ADR-0064). */
export const ALONE = 2;
/** Inside a selection box being drawn. */
export const BOXED = 4;
/** Hovered in a list (the outliner). */
export const LIST_HOVERED = 8;

const NO_ITEMS: readonly ISceneItem[] = [];

type TFlagState = Pick<IEditorState, "selectedItems" | "selectedId" | "boxDrag" | "hovered">;

const boxedOf = (state: TFlagState) => state.boxDrag?.items ?? NO_ITEMS;

/** An object's flags in a state of the editor. */
export const flagsOf = (state: TFlagState, id: string) =>
	(includesItem(state.selectedItems, "entity", id) ? SELECTED : 0) |
	(state.selectedId === id && state.selectedItems.length === 1 ? ALONE : 0) |
	(includesItem(boxedOf(state), "entity", id) ? BOXED : 0) |
	(state.hovered?.kind === "entity" && state.hovered.id === id ? LIST_HOVERED : 0);

/**
 * Who listens for which object's flags, and the state they were last told about. One subscription
 * to the store for all of them, which tells only the objects a change concerns: with the selection
 * handed to every object, each click drew every object of a big world again (PERFORMANCE.md).
 */
const registry = keepOnHotReload("entityFlagListeners", () => ({
	listeners: new Map<string, Set<() => void>>(),
	told: null as TFlagState | null,
	unsubscribe: null as (() => void) | null,
}));

const entityIdsIn = (items: readonly ISceneItem[], into: Set<string>) => {
	for (const item of items) {
		if (item.kind === "entity") {
			into.add(item.id);
		}
	}
};

/** The objects whose flags may differ between two states: in either's selection, box or hover. */
export const concernedBy = (before: TFlagState | null, now: TFlagState) => {
	const concerned = new Set<string>();
	for (const state of before ? [before, now] : [now]) {
		entityIdsIn(state.selectedItems, concerned);
		entityIdsIn(boxedOf(state), concerned);
		if (state.selectedId) {
			concerned.add(state.selectedId);
		}
		if (state.hovered?.kind === "entity") {
			concerned.add(state.hovered.id);
		}
	}
	return concerned;
};

/** Tells the listeners of each object whose flags may have changed since they were last told. */
const tellChanged = () => {
	const now = useEditor.getState();
	const before = registry.told;
	if (
		before &&
		now.selectedItems === before.selectedItems &&
		now.selectedId === before.selectedId &&
		boxedOf(now) === boxedOf(before) &&
		now.hovered === before.hovered
	) {
		return;
	}
	registry.told = {
		selectedItems: now.selectedItems,
		selectedId: now.selectedId,
		boxDrag: now.boxDrag,
		hovered: now.hovered,
	};
	for (const id of concernedBy(before, now)) {
		for (const listener of registry.listeners.get(id) ?? []) {
			listener();
		}
	}
};

/** Subscriptions by id, so a component's stays the same across renders. */
const subscriptions = new Map<string, (listener: () => void) => () => void>();

const subscribeTo = (id: string) => (listener: () => void) => {
	if (!registry.unsubscribe) {
		const { selectedItems, selectedId, boxDrag, hovered } = useEditor.getState();
		registry.told = { selectedItems, selectedId, boxDrag, hovered };
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
 * An object's flags (SELECTED, ALONE, BOXED, LIST_HOVERED), by id; the component renders again
 * only when they change. For what's drawn per object, thousands of times (ADR-0092).
 */
export const useEntityFlags = (id: string) => {
	let subscribe = subscriptions.get(id);
	if (!subscribe) {
		subscribe = subscribeTo(id);
		subscriptions.set(id, subscribe);
	}
	return useSyncExternalStore(subscribe, () => flagsOf(useEditor.getState(), id));
};
