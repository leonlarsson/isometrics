import { type RefObject, useLayoutEffect, useRef, useState } from "react";

import type { TEditorMode } from "#/editor/store";

/**
 * What the view bar gives up as its view narrows (ADR-0142), in order: the bar spans only the view,
 * between the side panels, so it folds by its own width, not the window's.
 * - `shading`: the shading switcher becomes one Shading menu
 * - `viewsLabel`: Views shows just its icon
 * - `view`: play and Re-centre camera move into More
 * - `modeLabels`: Edit and View show just their icons (their words stay their names)
 * - `tools`: snap, box select and paint move into More
 * - `viewMenus`: the shading, overlays and camera menus move into More (the phone toolbar's More)
 * - `history`: undo and redo move into More, for a view squeezed between two wide panels
 */
export const VIEW_BAR_FOLDS = [
	"shading",
	"viewsLabel",
	"view",
	"modeLabels",
	"tools",
	"viewMenus",
	"history",
] as const;

export type TViewBarFold = (typeof VIEW_BAR_FOLDS)[number];

/**
 * How wide the bar has to be (its whole width, padding included) for each step to stay unfolded,
 * in Edit mode and in View mode (no history, no tools): the width of what it holds with the steps
 * before it folded, measured in the browser, and a little room to spare.
 */
const ROOM_NEEDED: Record<TEditorMode, Record<TViewBarFold, number>> = {
	edit: {
		shading: 940,
		viewsLabel: 770,
		view: 730,
		modeLabels: 660,
		tools: 580,
		viewMenus: 470,
		history: 290,
	},
	view: {
		shading: 760,
		viewsLabel: 590,
		view: 550,
		modeLabels: 480,
		tools: 0,
		viewMenus: 390,
		history: 0,
	},
};

/** How many of the steps are folded at a width, at least `least` (the phone toolbar's). */
export const foldsAt = (width: number, mode: TEditorMode, least: TViewBarFold | null = null) => {
	const needed = ROOM_NEEDED[mode];
	const fromWidth = VIEW_BAR_FOLDS.reduce(
		(count, fold, index) => (width < needed[fold] ? index + 1 : count),
		0,
	);
	const fromLeast = least === null ? 0 : VIEW_BAR_FOLDS.indexOf(least) + 1;
	return Math.max(fromWidth, fromLeast);
};

/**
 * Which of the view bar's steps are folded at its width now, following it as the window or a
 * side panel resizes. Re-renders only when the count changes, not on every pixel of a drag.
 */
export const useViewBarFolds = (
	bar: RefObject<HTMLElement | null>,
	mode: TEditorMode,
	least: TViewBarFold | null = null,
) => {
	const [count, setCount] = useState(0);
	const width = useRef(0);
	const settings = useRef({ mode, least });
	settings.current = { mode, least };

	useLayoutEffect(() => {
		const element = bar.current;
		if (!element) {
			return;
		}
		const update = () =>
			setCount(foldsAt(width.current, settings.current.mode, settings.current.least));
		width.current = element.getBoundingClientRect().width;
		update();
		const observer = new ResizeObserver(([entry]) => {
			width.current = entry.borderBoxSize[0]?.inlineSize ?? element.offsetWidth;
			update();
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	// The mode changes what the bar holds, and so the room it needs.
	useLayoutEffect(() => {
		setCount(foldsAt(width.current, mode, least));
	}, [mode, least]);

	return (fold: TViewBarFold) => VIEW_BAR_FOLDS.indexOf(fold) < count;
};
