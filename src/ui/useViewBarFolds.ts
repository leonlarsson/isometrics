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
 * before it folded, measured in the browser, and 8px to spare. View mode's bar is the window's
 * width, never below 700px, so only its first steps can come into play.
 */
const ROOM_NEEDED: Record<TEditorMode, Record<TViewBarFold, number>> = {
	edit: {
		shading: 920,
		viewsLabel: 738,
		view: 692,
		modeLabels: 666,
		tools: 586,
		viewMenus: 474,
		history: 276,
	},
	view: {
		shading: 730,
		viewsLabel: 548,
		view: 502,
		modeLabels: 476,
		tools: 0,
		viewMenus: 400,
		history: 0,
	},
};

/**
 * How many of the steps are folded at a width. On phones (`fixed`, the bar inside the app row)
 * exactly as far as the phone toolbar always was, whatever the width: up to that step.
 */
export const foldsAt = (width: number, mode: TEditorMode, fixed: TViewBarFold | null = null) => {
	if (fixed !== null) {
		return VIEW_BAR_FOLDS.indexOf(fixed) + 1;
	}
	const needed = ROOM_NEEDED[mode];
	return VIEW_BAR_FOLDS.reduce(
		(count, fold, index) => (width < needed[fold] ? index + 1 : count),
		0,
	);
};

/**
 * Which of the view bar's steps are folded at its width now, following it as the window or a
 * side panel resizes. Re-renders only when the count changes, not on every pixel of a drag.
 */
export const useViewBarFolds = (
	bar: RefObject<HTMLElement | null>,
	mode: TEditorMode,
	fixed: TViewBarFold | null = null,
) => {
	const [count, setCount] = useState(0);
	const width = useRef(0);
	const settings = useRef({ mode, fixed });
	settings.current = { mode, fixed };

	useLayoutEffect(() => {
		const element = bar.current;
		if (!element) {
			return;
		}
		const update = () =>
			setCount(foldsAt(width.current, settings.current.mode, settings.current.fixed));
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
		setCount(foldsAt(width.current, mode, fixed));
	}, [mode, fixed]);

	return (fold: TViewBarFold) => VIEW_BAR_FOLDS.indexOf(fold) < count;
};
