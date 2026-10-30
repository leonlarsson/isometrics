import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

import type { ISceneItem } from "#/editor/framing";
import { isItemSelected, useEditor } from "#/editor/store";
import { fenceHeightOf } from "#/fences/fenceModel";
import { getPart, resolveProps } from "#/parts/registry";
import { cornerTop, groundHeightAt } from "#/scene/areas";
import type { TScene } from "#/scene/schema";

import { roadBaseY } from "./RoadMesh";
import { livePoses } from "./routeDrop";

const projected = new THREE.Vector3();

interface IScreenBox {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/**
 * What a box on screen holds (ADR-0064): objects whose centre is inside it,
 * and roads, areas and fences whose points all are, so a big area under a district
 * isn't picked by accident. Hidden and locked things are left out.
 */
const itemsInBox = (
	scene: TScene,
	box: IScreenBox,
	camera: THREE.Camera,
	canvas: DOMRect,
): ISceneItem[] => {
	const inside = (x: number, y: number, z: number) => {
		projected.set(x, y, z).project(camera);
		if (projected.z < -1 || projected.z > 1) {
			return false;
		}
		const left = canvas.left + ((projected.x + 1) / 2) * canvas.width;
		const top = canvas.top + ((1 - projected.y) / 2) * canvas.height;
		return left >= box.left && left <= box.right && top >= box.top && top <= box.bottom;
	};
	const items: ISceneItem[] = [];
	for (const entity of scene.entities) {
		if (entity.hidden || entity.locked) {
			continue;
		}
		const part = getPart(entity.kind);
		const height = part ? part.height(resolveProps(part, entity.props)) * entity.scale : 1;
		// A driving vehicle is where it is on screen now, not where it started.
		const live = livePoses.get(entity.id)?.();
		const [x, z] = live?.position ?? entity.position;
		const y = (live?.elevation ?? entity.elevation) + height / 2;
		if (inside(x, y, z)) {
			items.push({ kind: "entity", id: entity.id });
		}
	}
	scene.roads.forEach((road, layer) => {
		const baseY = roadBaseY(layer);
		if (
			!road.hidden &&
			!road.locked &&
			road.points.every(([x, z, height = 0]) => inside(x, baseY + height, z))
		) {
			items.push({ kind: "road", id: road.id });
		}
	});
	for (const area of scene.areas) {
		if (
			!area.hidden &&
			!area.locked &&
			area.points.every((point) => inside(point[0], cornerTop(area, point), point[1]))
		) {
			items.push({ kind: "area", id: area.id });
		}
	}
	for (const fence of scene.fences) {
		if (
			!fence.hidden &&
			!fence.locked &&
			fence.points.every(([x, z, lift]) => inside(x, groundHeightAt(scene.areas, [x, z]) + lift, z))
		) {
			items.push({ kind: "fence", id: fence.id });
		}
	}
	return items;
};

/**
 * The points of the selected road or fence, or corners of the selected area,
 * inside a box on screen (ADR-0065), while one of them is selected.
 */
const pointsInBox = (
	scene: TScene,
	roadId: string | null,
	areaId: string | null,
	fenceId: string | null,
	box: IScreenBox,
	camera: THREE.Camera,
	canvas: DOMRect,
): number[] => {
	const layer = scene.roads.findIndex((r) => r.id === roadId);
	const road = scene.roads[layer];
	const area = scene.areas.find((a) => a.id === areaId);
	const fence = scene.fences.find((f) => f.id === fenceId);
	const spots = road
		? road.points.map(([x, z, height = 0]) => [x, roadBaseY(layer) + height, z])
		: fence
			? // Where their handles are drawn: on the fence's top (render/FenceHandles).
				fence.points.map(([x, z, lift]) => [
					x,
					groundHeightAt(scene.areas, [x, z]) + lift + fenceHeightOf(fence),
					z,
				])
			: (area?.points.map((point) => [point[0], cornerTop(area, point), point[1]]) ?? []);
	return spots.flatMap(([x, y, z], index) => {
		projected.set(x, y, z).project(camera);
		const left = canvas.left + ((projected.x + 1) / 2) * canvas.width;
		const top = canvas.top + ((1 - projected.y) / 2) * canvas.height;
		return left >= box.left && left <= box.right && top >= box.top && top <= box.bottom
			? [index]
			: [];
	});
};

/**
 * B / Shift+B (or the toolbar's Select box): the next drag on the view draws
 * a box that adds what's inside to the selection, or takes it out; holding
 * Ctrl or Cmd when letting go takes it out too (ADR-0064). The drag is taken
 * before the camera sees it, so it never pans. Esc or a right click cancels.
 * ui/SelectionBox draws the box.
 */
export const BoxSelect = () => {
	const mode = useEditor((s) => s.boxSelect);
	const camera = useThree((s) => s.camera);
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);

	useEffect(() => {
		if (!mode) {
			return;
		}
		const store = useEditor.getState;
		let from: { x: number; y: number } | null = null;
		element.style.cursor = "crosshair";

		const swallow = (event: Event) => {
			event.preventDefault();
			event.stopPropagation();
		};
		// Label cards float over the canvas in their own DOM layer, but they're part of the scene.
		const inScene = (target: EventTarget | null) =>
			target instanceof Element &&
			(element.contains(target) || target.closest("[data-label-layer]") !== null);
		const finish = () => {
			from = null;
			store().setBoxSelect(null);
		};
		const boxTo = (event: PointerEvent): IScreenBox | null =>
			from && {
				left: Math.min(from.x, event.clientX),
				top: Math.min(from.y, event.clientY),
				right: Math.max(from.x, event.clientX),
				bottom: Math.max(from.y, event.clientY),
			};
		// The click after the box, which would select or deselect what's under the pointer.
		const swallowNextClick = () => {
			window.addEventListener("click", swallow, { capture: true, once: true });
			setTimeout(() => window.removeEventListener("click", swallow, { capture: true }));
		};

		const onDown = (event: PointerEvent) => {
			if (!inScene(event.target)) {
				return;
			}
			swallow(event);
			if (event.button === 2) {
				finish();
				return;
			}
			if (event.button === 0) {
				from = { x: event.clientX, y: event.clientY };
			}
		};
		/**
		 * What letting go now would add, or take out (only what's selected): points of the selected
		 * road or area while one of them is selected (ADR-0065), else objects, roads and areas.
		 */
		const pick = (
			box: IScreenBox,
			event: PointerEvent,
		): { items: ISceneItem[]; points: number[]; removing: boolean } => {
			const state = store();
			const removing = state.boxSelect === "remove" || event.ctrlKey || event.metaKey;
			const canvas = element.getBoundingClientRect();
			if (state.selectedPointIndex !== null) {
				const { scene, selectedRoadId, selectedAreaId, selectedFenceId } = state;
				const inside = pointsInBox(
					scene,
					selectedRoadId,
					selectedAreaId,
					selectedFenceId,
					box,
					camera,
					canvas,
				);
				const points = removing
					? inside.filter((index) => state.selectedPointIndices.includes(index))
					: inside;
				return { items: [], points, removing };
			}
			const picked = itemsInBox(state.scene, box, camera, canvas);
			const items = removing
				? picked.filter((item) => isItemSelected(state, item.kind, item.id))
				: picked;
			return { items, points: [], removing };
		};
		const onMove = (event: PointerEvent) => {
			const box = boxTo(event);
			if (!box) {
				return;
			}
			swallow(event);
			store().setBoxDrag({
				rect: {
					left: box.left,
					top: box.top,
					width: box.right - box.left,
					height: box.bottom - box.top,
				},
				...pick(box, event),
			});
		};
		const onUp = (event: PointerEvent) => {
			const box = boxTo(event);
			if (!box) {
				return;
			}
			swallow(event);
			swallowNextClick();
			const state = store();
			const { items: picked, points, removing } = pick(box, event);
			if (state.selectedPointIndex !== null) {
				const kept = state.selectedPointIndices.filter((index) => !points.includes(index));
				if (removing) {
					state.selectPoints(kept);
				} else if (points.length > 0) {
					state.selectPoints([...kept, ...points]);
				}
				finish();
				return;
			}
			const isPicked = (item: ISceneItem) =>
				picked.some((other) => other.kind === item.kind && other.id === item.id);
			if (removing) {
				state.selectItems(state.selectedItems.filter((item) => !isPicked(item)));
			} else if (picked.length > 0) {
				state.selectItems([...state.selectedItems.filter((item) => !isPicked(item)), ...picked]);
			}
			finish();
		};
		const onContextMenu = (event: MouseEvent) => {
			if (inScene(event.target)) {
				event.preventDefault();
			}
		};

		store().setCancelGesture(finish);
		window.addEventListener("pointerdown", onDown, { capture: true });
		window.addEventListener("pointermove", onMove, { capture: true });
		window.addEventListener("pointerup", onUp, { capture: true });
		window.addEventListener("contextmenu", onContextMenu, { capture: true });
		return () => {
			element.style.cursor = "";
			window.removeEventListener("pointerdown", onDown, { capture: true });
			window.removeEventListener("pointermove", onMove, { capture: true });
			window.removeEventListener("pointerup", onUp, { capture: true });
			window.removeEventListener("contextmenu", onContextMenu, { capture: true });
			if (store().cancelGesture === finish) {
				store().setCancelGesture(null);
			}
			store().setBoxDrag(null);
		};
	}, [mode, camera, element]);

	return null;
};
