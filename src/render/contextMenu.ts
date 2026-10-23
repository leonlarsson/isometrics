import type { ThreeEvent } from "@react-three/fiber";

import type { ISceneItem } from "#/editor/framing";
import { useEditor } from "#/editor/store";
import { isClick, pastDragThreshold } from "#/lib/pointer";

/**
 * `onContextMenu` for an object, road or area in the scene: a right-click opens
 * its menu (ui/ItemContextMenu), but a right-drag orbits the camera (ADR-0037),
 * so the menu only opens when the pointer barely moved. Browsers disagree on
 * when the event comes: on Windows after the button is released (R3F's `delta`
 * says how far it moved), on macOS and Linux as soon as it's pressed, so there
 * it waits for the release.
 */
export const openContextMenuOnClick = (item: ISceneItem) => (event: ThreeEvent<MouseEvent>) => {
	// The nearest thing under the pointer gets the menu, not what's behind it.
	event.stopPropagation();
	openContextMenuUnlessDragged(item, event.nativeEvent, !isClick(event));
};

/**
 * The same for any `contextmenu` event (a label card's, say): `dragged` says
 * whether the pointer moved far from where the button was pressed, for
 * browsers that fire the event on release.
 */
export const openContextMenuUnlessDragged = (
	item: ISceneItem,
	native: MouseEvent,
	dragged: boolean,
) => {
	native.preventDefault();
	const { mode, drawing, placingKind } = useEditor.getState();
	if (mode !== "edit" || drawing || placingKind) {
		return;
	}
	const open = (x: number, y: number) => useEditor.getState().openContextMenu(item, { x, y });

	if ((native.buttons & 2) === 0) {
		if (!dragged) {
			open(native.clientX, native.clientY);
		}
		return;
	}
	const from = { clientX: native.clientX, clientY: native.clientY };
	const onUp = (up: PointerEvent) => {
		if (up.button !== 2) {
			return;
		}
		window.removeEventListener("pointerup", onUp);
		if (!pastDragThreshold(from, up)) {
			open(up.clientX, up.clientY);
		}
	};
	window.addEventListener("pointerup", onUp);
};
