import { create } from "zustand";

import { keepOnHotReload } from "#/lib/hot";

/**
 * Where the story is (ADR-0114): the date the world's data is shown at in
 * View mode, and whether it's playing. Runtime only, never in the world; null
 * = now. Named as a hook: the React Compiler only treats `use…` calls as hooks.
 */
export const useStory = keepOnHotReload("story", () =>
	create<{ at: string | null; isPlaying: boolean }>(() => ({ at: null, isPlaying: false })),
);

export const setStoryAt = (at: string | null) => useStory.setState({ at });

export const setStoryPlaying = (isPlaying: boolean) => useStory.setState({ isPlaying });
