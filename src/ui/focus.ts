import type { MouseEvent } from "react";

/**
 * After a mouse or touch click, let go of focus. Otherwise the next shortcut
 * key (H, F, …) counts as keyboard use and the browser draws its focus ring on
 * the clicked button. Clicks from the keyboard (Enter, Space: `detail` 0) keep
 * focus, so keyboard users don't lose their place.
 */
export const releaseFocusAfterPointerClick = (event: MouseEvent<HTMLElement>) => {
	if (event.detail > 0) {
		event.currentTarget.blur();
	}
};
