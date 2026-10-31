import { create } from "zustand";

import { keepOnHotReload } from "#/lib/hot";

/**
 * View mode's Map / Data switch (ADR-0110): whether the world's data shows as
 * tables over the map. Runtime only, never in the world. Named as a hook: the
 * React Compiler only treats `use…` calls as hooks.
 */
export const useViewShowsData = keepOnHotReload("viewShowsData", () =>
	create<{ showsData: boolean }>(() => ({ showsData: false })),
);

export const setViewShowsData = (showsData: boolean) => useViewShowsData.setState({ showsData });
