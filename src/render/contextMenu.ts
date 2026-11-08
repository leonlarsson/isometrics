import type { ThreeEvent } from "@react-three/fiber";

import type { ISceneItem } from "#/editor/framing";
import { rightButtonPress } from "#/editor/keyboardCamera";
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
	// Flying with W A S D while holding the button isn't a right-click.
	const flew = () => rightButtonPress.movedByKeys;
	if ((native.buttons & 2) === 0) {
		if (!dragged && !flew()) {
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
		if (!pastDragThreshold(from, up) && !flew()) {
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

/**
 * What one right-click found under the pointer so far, in pick order (render/pickOrder): every
 * object, road, fence and area there hears of it in the same go, so the menu can offer to select
 * any of them (its Select list), a park under a hidden district or an area under a building.
 */
let gathering: { native: MouseEvent; items: ISceneItem[] } | null = null;

const isGathering = (native: MouseEvent) => gathering?.native === native;

/**
 * An item under a right-click: the first to hear of it owns the menu, which opens once everything
 * under the pointer has added itself (all of them hear of it before this event is over).
 */
const gatherForMenu = (
	event: ThreeEvent<MouseEvent>,
	item: ISceneItem,
	open: (under: readonly ISceneItem[]) => void,
) => {
	const native = event.nativeEvent;
	if (gathering && isGathering(native)) {
		if (!gathering.items.some((known) => known.kind === item.kind && known.id === item.id)) {
			gathering.items.push(item);
		}
		return;
	}
	// The browser's own menu never shows, so this can't wait.
	native.preventDefault();
	const found = { native, items: [item] };
	gathering = found;
	queueMicrotask(() => {
		if (gathering === found) {
			gathering = null;
		}
		open(found.items);
	});
};

/** `onContextMenu` for a viewpoint's camera in the world: its menu (ui/ViewpointContextMenu). */
export const openViewpointMenuOnClick = (id: string) => (event: ThreeEvent<MouseEvent>) => {
	event.stopPropagation();
	// Behind something whose menu is opening: that one's.
	if (isGathering(event.nativeEvent)) {
		return;
	}
	onRightClick(event.nativeEvent, !isClick(event), (x, y) =>
		useEditor.getState().openViewpointMenu(id, { x, y }),
	);
};

/** `onContextMenu` for an object, road or fence in the scene: its menu (ui/ItemContextMenu). */
export const openContextMenuOnClick = (item: ISceneItem) => (event: ThreeEvent<MouseEvent>) => {
	// The nearest thing under the pointer gets the menu; what's behind it is listed in it.
	const dragged = !isClick(event);
	gatherForMenu(event, item, (under) =>
		onRightClick(event.nativeEvent, dragged, (x, y) =>
			useEditor.getState().openContextMenu(item, { x, y }, undefined, under),
		),
	);
};

/** `onContextMenu` for an area: its menu, knowing the point clicked on it (for "Add a peak here"). */
export const openAreaMenuOnClick = (id: string) => (event: ThreeEvent<MouseEvent>) => {
	const point: TVec2 = [event.point.x, event.point.z];
	const dragged = !isClick(event);
	gatherForMenu(event, { kind: "area", id }, (under) =>
		onRightClick(event.nativeEvent, dragged, (x, y) =>
			useEditor.getState().openContextMenu({ kind: "area", id }, { x, y }, point, under),
		),
	);
};

/** `onContextMenu` for a ground: its menu (ui/GroundContextMenu) for the point clicked, and which ground. */
export const openGroundMenuOnClick = (groundId?: string) => (event: ThreeEvent<MouseEvent>) => {
	event.stopPropagation();
	// Under something whose menu is opening: that one's.
	if (isGathering(event.nativeEvent)) {
		return;
	}
	const point: TVec2 = [event.point.x, event.point.z];
	onRightClick(event.nativeEvent, !isClick(event), (x, y) =>
		useEditor.getState().openGroundMenu(point, { x, y }, groundId),
	);
};
