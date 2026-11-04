/**
 * The tour's stepping (scene.camera.tour, ADR-0139): which viewpoint comes
 * next and when. No React or three.js: render/ViewpointTour runs it each
 * frame, glides with the store's goToViewpoint and stops it on input.
 */

/**
 * The index `by` steps from `index` in a list of `count`, round and round. From
 * none (-1, or an index past the end), forward starts at the first and back at the last.
 */
export const steppedIndex = (index: number, count: number, by: number) => {
	if (count <= 0) {
		return -1;
	}
	if (index < 0 || index >= count) {
		return by > 0 ? 0 : count - 1;
	}
	return (((index + by) % count) + count) % count;
};

export interface ITourClock {
	/** The viewpoint it went to last, by index in the world's list; -1 before the first. */
	index: number;
	/** When it moves on, in seconds on the caller's clock. */
	movesAt: number;
}

/**
 * A tour starting at `now` from the viewpoint at `index` (-1: none). It moves
 * on at once, unless it `holdsFirst` there (the world just opened at it):
 * then it holds for `holdSeconds` first.
 */
export const startTourClock = (
	index: number,
	now: number,
	{ holdsFirst, holdSeconds }: { holdsFirst: boolean; holdSeconds: number },
): ITourClock => ({ index, movesAt: holdsFirst && index >= 0 ? now + holdSeconds : now });

/**
 * The tour at `now`: once it's time, the next of `count` viewpoints to go to
 * (`goesTo`, else null) and when it moves on from there, after the glide and
 * the hold.
 */
export const tickTour = (
	clock: ITourClock,
	now: number,
	{
		count,
		glideSeconds,
		holdSeconds,
	}: { count: number; glideSeconds: number; holdSeconds: number },
): { clock: ITourClock; goesTo: number | null } => {
	if (count <= 0 || now < clock.movesAt) {
		return { clock, goesTo: null };
	}
	const next = steppedIndex(clock.index, count, 1);
	return {
		clock: { index: next, movesAt: now + Math.max(0, glideSeconds) + holdSeconds },
		goesTo: next,
	};
};
