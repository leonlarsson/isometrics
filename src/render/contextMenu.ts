import type { ThreeEvent } from "@react-three/fiber";

import type { ISceneItem } from "#/editor/framing";
import { useEditor } from "#/editor/store";
import { isClick, pastDragThreshold } from "#/lib/pointer";
import type { TVec2 } from "#/scene/schema";

/**
 * Run `open` at the pointer for a right-click in Edit mode, but not for a
 * right-drag, which orbits the camera (ADR-0037): only when the pointer barely
 * moved. Browsers disagree on when `contextmenu` comes: on Windows after the
 * button is released (`dragged` says how far it moved since the press), on
 * macOS and Linux as soon as it's pressed, so there it waits for the release.
 * The browser's own menu never shows.
 */
const onRightClick = (
	native: MouseEvent,
	dragged: boolean,
	open: (x: number, y: number) => void,
) => {
	native.preventDefault();
	const { mode, drawing, placingKind } = useEditor.getState();
	if (mode !== "edit" || drawing || placingKind) {
		return;
	}
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

/**
 * An item's menu (ui/ItemContextMenu) for any `contextmenu` event, a label
 * card's say: `dragged` says whether the pointer moved far from the press.
 */
export const openContextMenuUnlessDragged = (
	item: ISceneItem,
	native: MouseEvent,
	dragged: boolean,
) => onRightClick(native, dragged, (x, y) => useEditor.getState().openContextMenu(item, { x, y }));

/** `onContextMenu` for a viewpoint's camera in the world: its menu (ui/ViewpointContextMenu). */
export const openViewpointMenuOnClick = (id: string) => (event: ThreeEvent<MouseEvent>) => {
	event.stopPropagation();
	onRightClick(event.nativeEvent, !isClick(event), (x, y) =>
		useEditor.getState().openViewpointMenu(id, { x, y }),
	);
};

/** `onContextMenu` for an object, road or area in the scene: its menu (ui/ItemContextMenu). */
export const openContextMenuOnClick = (item: ISceneItem) => (event: ThreeEvent<MouseEvent>) => {
	// The nearest thing under the pointer gets the menu, not what's behind it.
	event.stopPropagation();
	openContextMenuUnlessDragged(item, event.nativeEvent, !isClick(event));
};

/** `onContextMenu` for the ground: its menu (ui/GroundContextMenu) for the point clicked. */
export const openGroundMenuOnClick = (event: ThreeEvent<MouseEvent>) => {
	event.stopPropagation();
	const point: TVec2 = [event.point.x, event.point.z];
	onRightClick(event.nativeEvent, !isClick(event), (x, y) =>
		useEditor.getState().openGroundMenu(point, { x, y }),
	);
};
