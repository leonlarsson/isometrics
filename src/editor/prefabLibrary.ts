import { useSyncExternalStore } from "react";

import { APP_NAME } from "#/lib/app";
import { keepOnHotReload } from "#/lib/hot";
import { prefabPartOf } from "#/parts/prefabParts";
import { repairWorld } from "#/parts/repairWorld";
import { groundHeightAt } from "#/scene/areas";
import { EntitySchema, SCENE_VERSION, type TPrefab, type TVec2 } from "#/scene/schema";

import { findFreeSpot } from "./placement";
import { newId, useEditor } from "./store";
import { workshopOf } from "./whatIsOpen";

/**
 * My prefabs (ADR-0134): every prefab saved in the Workshop is also kept in
 * this browser, newest first, so it can be placed in any of one's worlds.
 * Placing one copies its design into the world, which then keeps it as its
 * own; a design a world already has is kept as the world has it. Removing one
 * from here leaves worlds that use it as they are. What's stored is read
 * like any world from outside (`repairWorld`), as it may come from an older
 * version or another tab.
 */
export const PREFAB_LIBRARY_KEY = `${APP_NAME.toLowerCase()}:prefabs`;

const NONE: readonly TPrefab[] = [];

/** The designs stored, brought up to date; none when nothing's stored or it can't be read. */
export const parsePrefabLibrary = (raw: string | null): readonly TPrefab[] => {
	if (!raw) {
		return NONE;
	}
	try {
		const stored: unknown = JSON.parse(raw);
		return repairWorld({ version: SCENE_VERSION, prefabs: Array.isArray(stored) ? stored : [] })
			.scene.prefabs;
	} catch {
		return NONE;
	}
};

const readStored = () => {
	try {
		return parsePrefabLibrary(localStorage.getItem(PREFAB_LIBRARY_KEY));
	} catch {
		return NONE;
	}
};

/** What's in the library now, read once, kept over a hot reload with its listeners. */
const library = keepOnHotReload("prefabLibrary", () => ({
	prefabs: null as readonly TPrefab[] | null,
	listeners: new Set<() => void>(),
}));

export const readPrefabLibrary = (): readonly TPrefab[] => {
	library.prefabs ??= readStored();
	return library.prefabs;
};

/**
 * The library as stored right now, which another tab may have changed since it was read, or
 * this tab's own when the storage can't be read. Changes start from it.
 */
const latest = () => {
	try {
		return parsePrefabLibrary(localStorage.getItem(PREFAB_LIBRARY_KEY));
	} catch {
		return readPrefabLibrary();
	}
};

const notify = () => {
	for (const listener of library.listeners) {
		listener();
	}
};

/** Store the library; false when the browser refused (it's kept until the page closes). */
const store = (prefabs: readonly TPrefab[]) => {
	library.prefabs = prefabs;
	notify();
	try {
		localStorage.setItem(PREFAB_LIBRARY_KEY, JSON.stringify(prefabs));
		return true;
	} catch (error) {
		console.warn("Could not keep My prefabs", error);
		return false;
	}
};

/**
 * Keep a design in My prefabs, first in the list, in place of one with the same id (the same
 * prefab saved again). Starts from what's stored now, so another tab's aren't lost. Returns
 * whether the browser kept it.
 */
export const keepInLibrary = (prefab: TPrefab) =>
	store([prefab, ...latest().filter((each) => each.id !== prefab.id)]);

/** Remove from My prefabs: worlds that use it keep their own design. */
export const removeFromLibrary = (id: string) =>
	store(latest().filter((prefab) => prefab.id !== id));

/** Another tab changed it (or the storage was wiped): follow it. */
const onStorage = (event: StorageEvent) => {
	if (event.key === PREFAB_LIBRARY_KEY || event.key === null) {
		library.prefabs = parsePrefabLibrary(event.newValue);
		notify();
	}
};

/** Call `listener` whenever My prefabs change, here or in another tab. */
export const subscribePrefabLibrary = (listener: () => void) => {
	if (library.listeners.size === 0) {
		window.addEventListener("storage", onStorage);
	}
	library.listeners.add(listener);
	return () => {
		library.listeners.delete(listener);
		if (library.listeners.size === 0) {
			window.removeEventListener("storage", onStorage);
		}
	};
};

/** My prefabs, updating when they change, here or in another tab. */
export const usePrefabLibrary = () =>
	useSyncExternalStore(subscribePrefabLibrary, readPrefabLibrary, () => NONE);

/**
 * Remove from this world… (a prefab's tile): its design and every copy of it in the open world,
 * as one undo step. My prefabs keeps it, if it's there. Returns how many copies went.
 */
export const removePrefabFromWorld = (id: string) => {
	const { scene, commit, selectedItems, clearSelection } = useEditor.getState();
	const copies = scene.entities.filter((entity) => entity.kind === id).map((entity) => entity.id);
	commit((draft) => {
		draft.prefabs = draft.prefabs.filter((prefab) => prefab.id !== id);
		draft.entities = draft.entities.filter((entity) => entity.kind !== id);
	});
	if (selectedItems.some((item) => item.kind === "entity" && copies.includes(item.id))) {
		clearSelection();
	}
	return copies.length;
};

/**
 * Place a prefab from My prefabs (or a link) in the open world near `near`, selected, as one undo
 * step: its design is copied in first if the world doesn't have it, else the world's is used.
 * `exactly`: right at `near` (the Ground menu's Add here), not at a free spot by it.
 */
export const placeFromLibrary = (prefab: TPrefab, near: TVec2, { exactly = false } = {}) => {
	const { scene, commit, select, whatIsOpen } = useEditor.getState();
	// A prefab can't hold another (ADR-0134).
	if (workshopOf(whatIsOpen)) {
		return null;
	}
	const design = scene.prefabs.find((each) => each.id === prefab.id) ?? prefab;
	const position = exactly ? near : findFreeSpot(scene, prefabPartOf(design), near);
	const copy = EntitySchema.parse({
		id: newId(design.id),
		kind: design.id,
		position,
		// On the ground where it's put (ADR-0098).
		altitude: groundHeightAt(scene.areas, position),
	});
	commit((draft) => {
		if (!draft.prefabs.some((each) => each.id === design.id)) {
			draft.prefabs.push(structuredClone(design));
		}
		draft.entities.push(copy);
	});
	select(copy.id);
	return copy.id;
};
