/**
 * What prefabs' menu items and buttons say (ADR-0134), in one place, so a
 * copy's right-click, its properties and its tile in Add to scene say the
 * same thing in the same words.
 */
export const PREFAB_WORDS = {
	edit: { label: "Edit prefab", description: "Changes every copy of it, in the Workshop" },
	makeFromIt: {
		label: "Make a prefab from it…",
		description: "One thing to place again and again",
	},
	makeFromThese: {
		label: "Make a prefab from these…",
		description: "One thing to place again and again",
	},
	removeFromLibrary: {
		label: "Remove from My prefabs",
		description: "Worlds that use it keep it",
	},
	removeFromWorld: {
		label: "Remove from this world…",
		description: "Its copies in this world go too",
	},
} as const;
