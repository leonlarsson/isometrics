import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type * as THREE from "three";

/**
 * Which of the things under the pointer a press goes to first. three hits
 * whatever is nearest, so a road's point inside a building, or a park under a
 * hidden area's fill, could never be reached. Things say where they stand with
 * `userData.pickOrder` (on themselves or a group they're in): higher first,
 * nearest first among equals, 0 for everything that doesn't say.
 */
export const PICK_ORDER = {
	/** The move gizmo: drawn on top of everything, so it's grabbed wherever it shows. */
	gizmo: 3,
	/** The selected thing's handles (road, area and fence points, gates, size handles), drawn on top too. */
	handle: 2,
	/** A hidden area (ADR-0151): only a faint fill while editing, so whatever shows is picked before it. */
	hiddenArea: -1,
	/** The ground, under everything: a click on nothing else clears the selection. */
	ground: -2,
} as const;

/** `userData` that puts a thing at a place in the order. */
export const pickOrderData = (order: number) => ({ pickOrder: order });

/** Where a hit object stands: the nearest `pickOrder` set on it or a group it's in. */
export const pickOrderOf = (object: THREE.Object3D | null): number => {
	for (let current = object; current; current = current.parent) {
		const order = current.userData.pickOrder;
		if (typeof order === "number") {
			return order;
		}
	}
	return 0;
};

/** The hits under the pointer in the order they get it: by `pickOrder`, then nearest first (as three gave them). */
export const inPickOrder = <T extends { object: THREE.Object3D }>(items: readonly T[]): T[] => {
	if (items.length < 2) {
		return [...items];
	}
	const orders = items.map((item) => pickOrderOf(item.object));
	return items
		.map((item, index) => ({ item, index, order: orders[index] }))
		.sort((a, b) => b.order - a.order || a.index - b.index)
		.map(({ item }) => item);
};

/** Puts the view's hits in pick order (`inPickOrder`) before any of them gets a pointer event. Mount once inside the Canvas. */
export const PickOrder = () => {
	const setEvents = useThree((s) => s.setEvents);
	useEffect(() => {
		setEvents({ filter: (items) => inPickOrder(items) });
	}, [setEvents]);
	return null;
};
