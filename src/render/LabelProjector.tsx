import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { type ILabelItem, type ILabelPlacement, type IRect, layoutLabels } from "#/lib/labelLayout";

import {
	gizmoArea,
	labelAnchors,
	labelElements,
	labelLeaders,
	labelPins,
	labelSizes,
} from "./labelRegistry";

const point = new THREE.Vector3();

/** Cards this far (px) from the gizmo can't overlap it, so they skip the precise check. */
const NEAR_GIZMO = 400;
/** Until a card or chip has been measured, the layout assumes this size (px). */
const GUESS_CARD = { width: 140, height: 52 };
const GUESS_CHIP = { width: 72, height: 24 };
/** The card's bottom sits this far above the end of its leader line (see `.card` in LabelLayer). */
const CARD_LIFT = 6;
/** How quickly a card glides to a new spot (per second); higher is snappier. */
const GLIDE = 14;
/** A card that shrank to a chip stays one at least this long (s), so it doesn't flicker. */
const CHIP_HOLD = 0.8;
/** How far the boxes around the canvas reach: they keep cards inside it. */
const OFF_CANVAS = 10_000;

/** Elements floating over the scene that cards step aside for: the title, bars and sheets. */
const OBSTACLES = "[data-label-obstacle]";

/** Whether a card's on-screen box overlaps the gizmo's area. */
const overGizmo = (element: HTMLElement, canvas: DOMRect, x: number, y: number) => {
	if (!gizmoArea.active) {
		return false;
	}
	const centerX = (gizmoArea.left + gizmoArea.right) / 2;
	const centerY = (gizmoArea.top + gizmoArea.bottom) / 2;
	if (Math.abs(x - centerX) > NEAR_GIZMO || Math.abs(y - centerY) > NEAR_GIZMO) {
		return false;
	}
	// Whichever is showing: the card, or its chip.
	const part = element.hasAttribute("data-compact") ? "chip" : "card";
	const box = element.querySelector(`[data-label-part="${part}"]`)?.getBoundingClientRect();
	if (!box) {
		return false;
	}
	return (
		box.right - canvas.left > gizmoArea.left &&
		box.left - canvas.left < gizmoArea.right &&
		box.bottom - canvas.top > gizmoArea.top &&
		box.top - canvas.top < gizmoArea.bottom
	);
};

/**
 * The UI over the canvas, and what's above and below it, as boxes in canvas
 * pixels. Not its sides: there cards slide under the side panels (the layer
 * clips them at the canvas's edge) like the world does, instead of stepping
 * inwards as a panel opens (ADR-0099).
 */
const readObstacles = (canvas: DOMRect): IRect[] => {
	const { height } = canvas;
	const boxes: IRect[] = [
		{ left: -OFF_CANVAS, top: -OFF_CANVAS, right: OFF_CANVAS, bottom: 0 },
		{ left: -OFF_CANVAS, top: height, right: OFF_CANVAS, bottom: OFF_CANVAS },
	];
	for (const element of document.querySelectorAll(OBSTACLES)) {
		const box = element.getBoundingClientRect();
		if (box.width > 0 && box.height > 0) {
			boxes.push({
				left: box.left - canvas.left,
				top: box.top - canvas.top,
				right: box.right - canvas.left,
				bottom: box.bottom - canvas.top,
			});
		}
	}
	return boxes;
};

/** Where each card is drawn right now, easing towards its place from the layout. */
const shown = new Map<string, { dx: number; dy: number }>();
/** Last frame's layout, so cards keep a spot while it's free. */
const previous = new Map<string, ILabelPlacement>();
/** When each chip last shrank from a card (clock seconds). */
const shrankAt = new Map<string, number>();

/**
 * Projects every label to screen space, lays the cards out so they don't
 * overlap each other or the UI over the scene (lib/labelLayout), and moves
 * the cards and their leader lines. Cards over the transform gizmo get
 * `data-under-gizmo`, which fades them and lets the pointer through to the
 * handles. See docs/adr/0008 and 0048.
 */
export const LabelProjector = () => {
	const camera = useThree((s) => s.camera);
	const gl = useThree((s) => s.gl);

	// The frame's own size, not one from the last render: a frame can be drawn right after a resize
	// (InstantResize), before React has re-rendered.
	useFrame(({ clock, size }, delta) => {
		// No cards, nothing to lay out: skip reading the page's layout every frame for nothing.
		if (labelElements.size === 0) {
			return;
		}
		const now = clock.elapsedTime;
		// Read everything first (sizes, obstacles), then write, so the browser never lays out mid-frame.
		const canvas = gl.domElement.getBoundingClientRect();
		const obstacles = readObstacles(canvas);
		const { selectedId, playing, scene } = useEditor.getState();
		// Cards on driving vehicles move anyway, so they're the ones that step aside.
		const driving = new Set(
			playing ? scene.entities.filter((entity) => entity.follow).map((entity) => entity.id) : [],
		);
		const items: ILabelItem[] = [];
		const pins = new Map<string, { x: number; y: number }>();
		const underGizmo = new Set<string>();

		for (const [id, element] of labelElements) {
			const anchor = labelAnchors.get(id);
			if (!anchor) {
				continue;
			}
			anchor.getWorldPosition(point).project(camera);
			if (Math.abs(point.z) > 1) {
				continue;
			}
			const x = ((point.x + 1) / 2) * size.width;
			const y = ((1 - point.y) / 2) * size.height;
			const depth = point.z;
			const pin = labelPins.get(id);
			if (pin) {
				pin.getWorldPosition(point).project(camera);
				pins.set(id, {
					x: ((point.x + 1) / 2) * size.width,
					y: ((1 - point.y) / 2) * size.height,
				});
			}
			const sizes = labelSizes.get(id);
			const last = previous.get(id);
			// A card already on its own spot keeps it, so a moving card doesn't push it out.
			const holding = last !== undefined && last.dx === 0 && last.dy === 0 && !last.compact;
			items.push({
				id,
				x,
				y: y - CARD_LIFT,
				card: sizes?.card ?? GUESS_CARD,
				chip: sizes?.chip ?? GUESS_CHIP,
				// The selected card first, then ones holding their own spot, then nearer ones; cards on
				// driving vehicles last.
				priority:
					(id === selectedId ? 10 : 0) + (holding ? 4 : 0) - (driving.has(id) ? 6 : 0) - depth,
				previous: last,
				chipOnly: now - (shrankAt.get(id) ?? Number.NEGATIVE_INFINITY) < CHIP_HOLD,
			});
			// Read here too, before any writes.
			if (overGizmo(element, canvas, x, y)) {
				underGizmo.add(id);
			}
		}

		const layout = layoutLabels(items, obstacles);
		const ease = Math.min(1, delta * GLIDE);
		const placedIds = new Set<string>();

		for (const item of items) {
			const element = labelElements.get(item.id);
			const placement = layout.get(item.id);
			if (!element || !placement) {
				continue;
			}
			placedIds.add(item.id);
			if (placement.compact && !previous.get(item.id)?.compact) {
				shrankAt.set(item.id, now);
			}
			previous.set(item.id, placement);
			const current = shown.get(item.id);
			const dx = current ? current.dx + (placement.dx - current.dx) * ease : placement.dx;
			const dy = current ? current.dy + (placement.dy - current.dy) * ease : placement.dy;
			shown.set(item.id, { dx, dy });

			const x = item.x + dx;
			const y = item.y + dy + CARD_LIFT;
			element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
			element.style.visibility = "visible";
			if (placement.compact !== element.hasAttribute("data-compact")) {
				element.toggleAttribute("data-compact", placement.compact);
			}
			const covering = underGizmo.has(item.id);
			if (covering !== element.hasAttribute("data-under-gizmo")) {
				element.toggleAttribute("data-under-gizmo", covering);
			}

			const leader = labelLeaders.get(item.id);
			const pin = pins.get(item.id);
			if (leader && pin) {
				leader.setAttribute("x1", pin.x.toFixed(1));
				leader.setAttribute("y1", pin.y.toFixed(1));
				leader.setAttribute("x2", x.toFixed(1));
				leader.setAttribute("y2", y.toFixed(1));
				leader.style.visibility = "visible";
			}
		}

		// Off screen, or no anchor yet: hidden, and placed afresh when it's back.
		for (const [id, element] of labelElements) {
			if (!placedIds.has(id)) {
				element.style.visibility = "hidden";
				const leader = labelLeaders.get(id);
				if (leader) {
					leader.style.visibility = "hidden";
				}
				shown.delete(id);
				previous.delete(id);
				shrankAt.delete(id);
			}
		}
	});

	return null;
};
