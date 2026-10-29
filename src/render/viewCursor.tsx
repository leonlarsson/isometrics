import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";

import { keepOnHotReload } from "#/lib/hot";

/**
 * The cursor over the view while the pointer is on something it can act on (an object, a road, a
 * handle, the gizmo), set on the element around the view rather than the page's body. A cursor is
 * inherited, so changing the body's restyles every element on the page: with a painted world's
 * outliner that's tens of thousands, about 15 ms a time, and the pointer crosses many objects a
 * second in a wood (PERFORMANCE.md). Around the view, it's a handful. It sits above the view's own
 * element and canvas, so the tools' crosshairs set there still win, as they did over the body's.
 */
const view = keepOnHotReload("viewCursor", () => ({ element: null as HTMLElement | null }));

export const setViewCursor = (cursor: string) => {
	(view.element ?? document.body).style.cursor = cursor;
};

/** Finds the element around the view for setViewCursor. Mount once in the canvas. */
export const ViewCursor = () => {
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);
	useLayoutEffect(() => {
		const around = element.parentElement ?? document.body;
		view.element = around;
		return () => {
			around.style.cursor = "";
			if (view.element === around) {
				view.element = null;
			}
		};
	}, [element]);
	return null;
};
