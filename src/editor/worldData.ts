import { useMemo } from "react";
import { create } from "zustand";

import { keepOnHotReload } from "#/lib/hot";
import type { TDataPoint, TDataTable, TWorldData } from "#/scene/schema";
import { worldDataAt } from "#/scene/story";

import { useEditor } from "./store";
import { useStory } from "./story";

/**
 * The world's data as it is now (data study, docs/data-study): what the world
 * keeps (its snapshot, typed or last read) with what its sources sent since
 * on top. Everything that shows or follows data reads it here, never from
 * `scene.data` itself, so values that arrive while the world is open (a
 * source read again, a live feed later) never make an undo step, never
 * autosave on every tick, and never touch what the world keeps until asked.
 */

/** What sources sent since the world opened, by value key and table key. */
interface IArrivedData {
	/** Which world it arrived for (the store's `openedWorldCount`): another world's is ignored. */
	forOpening: number | null;
	/** The latest value, and its whole past when the source gives one (an API with dates). */
	values: ReadonlyMap<string, { point: TDataPoint; history?: readonly TDataPoint[] }>;
	tables: ReadonlyMap<string, TDataTable["rows"]>;
}

const NOTHING_ARRIVED: IArrivedData = { forOpening: null, values: new Map(), tables: new Map() };

/** The most points a value's history keeps while the world is open. */
const MOST_POINTS = 500;

// Named as a hook: the React Compiler only treats `use…` calls as hooks, and caches anything else.
const useArrived = keepOnHotReload("arrivedData", () =>
	create<IArrivedData>(() => NOTHING_ARRIVED),
);

/**
 * The world's data with what arrived on top; the kept data itself while
 * nothing has (or what has was for a world opened before this one).
 */
export const mergeArrived = (
	kept: TWorldData,
	since: Omit<IArrivedData, "forOpening">,
): TWorldData => {
	if (since.values.size === 0 && since.tables.size === 0) {
		return kept;
	}
	return {
		...kept,
		values: kept.values.map((entry) => {
			const arrived = since.values.get(entry.key);
			if (!arrived) {
				return entry;
			}
			const { point, history } = arrived;
			return {
				...entry,
				value: point.value,
				// The source's own past, or what's kept with this point on the end (unless it's the last).
				history: history
					? [...history]
					: entry.history.at(-1)?.at === point.at
						? entry.history
						: [...entry.history, point].slice(-MOST_POINTS),
			};
		}),
		tables: kept.tables.map((table) => {
			const rows = since.tables.get(table.key);
			return rows ? { ...table, rows } : table;
		}),
	};
};

/** A world's data with nothing in it, the same object each time for the same data (caches key on it). */
const emptied = new WeakMap<TWorldData, TWorldData>();
const withoutData = (data: TWorldData) => {
	const known = emptied.get(data);
	if (known) {
		return known;
	}
	const empty = { ...data, values: [], tables: [] };
	emptied.set(data, empty);
	return empty;
};

/**
 * The data as a story shows it (ADR-0114): as it was on its date in View mode, else as it is.
 * With data off (ADR-0115), none: everything is drawn as set by hand.
 */
const asOf = (data: TWorldData, at: string | null, inView: boolean) =>
	!data.isOn ? withoutData(data) : at !== null && inView ? worldDataAt(data, at) : data;

/** Whether the world uses data (ADR-0115): off hides every data tool, value and tile. */
export const useUsesData = () => useEditor((s) => s.scene.data.isOn);

/**
 * The world's data now, for components: changes as the world, what arrived
 * or the story's date changes.
 */
export const useWorldData = (): TWorldData => {
	const kept = useEditor((s) => s.scene.data);
	const opening = useEditor((s) => s.openedWorldCount);
	const inView = useEditor((s) => s.mode === "view");
	const since = useArrived((s) => s);
	const at = useStory((s) => s.at);
	// The same object until something changes, so selectors that use it stay settled.
	const merged = useMemo(
		() => mergeArrived(kept, since.forOpening === opening ? since : NOTHING_ARRIVED),
		[kept, since, opening],
	);
	return useMemo(() => asOf(merged, at, inView), [merged, at, inView]);
};

/** What the world keeps with what arrived on top, whatever date a story shows (for keeping it). */
export const keptWithArrived = (): TWorldData => {
	const { scene, openedWorldCount } = useEditor.getState();
	const since = useArrived.getState();
	return mergeArrived(scene.data, since.forOpening === openedWorldCount ? since : NOTHING_ARRIVED);
};

/** The world's data now, for code outside components (each frame, the store's actions). */
export const worldDataNow = (): TWorldData =>
	asOf(keptWithArrived(), useStory.getState().at, useEditor.getState().mode === "view");

/** What arrived so far for the world open now: none if it was for another. */
const arrivedForThisWorld = (): IArrivedData => {
	const opening = useEditor.getState().openedWorldCount;
	const since = useArrived.getState();
	return since.forOpening === opening ? since : { ...NOTHING_ARRIVED, forOpening: opening };
};

/**
 * A value that arrived from a source, kept until the world closes or it's kept
 * for good; with `history`, the source's whole past for it (an API with dates).
 */
export const valueArrived = (key: string, point: TDataPoint, history?: readonly TDataPoint[]) => {
	const since = arrivedForThisWorld();
	useArrived.setState({ ...since, values: new Map(since.values).set(key, { point, history }) });
};

/** Whether anything arrived for the world open now, to offer to keep it. */
export const useHasArrived = () => {
	const opening = useEditor((s) => s.openedWorldCount);
	return useArrived((s) => s.forOpening === opening && (s.values.size > 0 || s.tables.size > 0));
};

/** A table's rows that arrived from a source. */
export const tableArrived = (key: string, rows: TDataTable["rows"]) => {
	const since = arrivedForThisWorld();
	useArrived.setState({ ...since, tables: new Map(since.tables).set(key, rows) });
};

/** Forget what arrived: another world opened, or it was kept in the world. */
export const clearArrived = () => useArrived.setState(NOTHING_ARRIVED);
