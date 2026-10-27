import { type PointerEvent, useEffect, useRef } from "react";

import { clamp } from "#/lib/math";

/** How close to the window's edges a dragged dialog may come. */
const EDGE_MARGIN = 8;

/** The dialog the handle is in: Base UI's popup, a dialog or an alert dialog. */
const popupOf = (handle: Element) =>
	handle.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]');

/** How far the dialog has been moved from the centre, in pixels (0 until it's dragged). */
const offsetOf = (popup: HTMLElement) => ({
	x: Number.parseFloat(popup.style.getPropertyValue("--drag-x")) || 0,
	y: Number.parseFloat(popup.style.getPropertyValue("--drag-y")) || 0,
});

const moveTo = (popup: HTMLElement, x: number, y: number) => {
	popup.style.setProperty("--drag-x", `${x}px`);
	popup.style.setProperty("--drag-y", `${y}px`);
};

/** Moves the dialog back inside the window if any of it is outside, e.g. after the window shrank. */
const keepOnScreen = (popup: HTMLElement) => {
	const rect = popup.getBoundingClientRect();
	const offset = offsetOf(popup);
	const x = clamp(0, EDGE_MARGIN - rect.left, window.innerWidth - EDGE_MARGIN - rect.right);
	const y = clamp(0, EDGE_MARGIN - rect.top, window.innerHeight - EDGE_MARGIN - rect.bottom);
	if (x !== 0 || y !== 0) {
		moveTo(popup, offset.x + x, offset.y + y);
	}
};

/**
 * Lets a dialog be moved by its title bar: spread the returned handlers on
 * the title bar, and position the popup with `--drag-x` / `--drag-y` added to
 * its centring transform. It stays inside the window, and opens in the centre
 * again: the offset lives on the popup element, which closing removes, so
 * nothing is stored. Presses on buttons in the bar (a Close button) don't drag.
 */
export const useDialogDrag = () => {
	const drag = useRef<{
		popup: HTMLElement;
		startX: number;
		startY: number;
		/** The farthest it may move each way from where the drag started: it stays inside the window. */
		limits: { left: number; right: number; up: number; down: number };
		from: { x: number; y: number };
	} | null>(null);
	// The dialog last dragged, kept inside the window when the window changes size.
	const moved = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const onResize = () => {
			if (moved.current?.isConnected) {
				keepOnScreen(moved.current);
			}
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	const endDrag = () => {
		if (drag.current) {
			delete drag.current.popup.dataset.dragging;
		}
		drag.current = null;
	};

	const onPointerDown = (event: PointerEvent<HTMLElement>) => {
		const popup = popupOf(event.currentTarget);
		if (
			event.button !== 0 ||
			!popup ||
			(event.target as Element).closest("button, a, input, select, textarea")
		) {
			return;
		}
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		const rect = popup.getBoundingClientRect();
		drag.current = {
			popup,
			startX: event.clientX,
			startY: event.clientY,
			limits: {
				left: EDGE_MARGIN - rect.left,
				right: window.innerWidth - EDGE_MARGIN - rect.right,
				up: EDGE_MARGIN - rect.top,
				down: window.innerHeight - EDGE_MARGIN - rect.bottom,
			},
			from: offsetOf(popup),
		};
		// No easing while it follows the pointer.
		popup.dataset.dragging = "";
		moved.current = popup;
	};

	const onPointerMove = (event: PointerEvent<HTMLElement>) => {
		const current = drag.current;
		if (!current) {
			return;
		}
		const { limits } = current;
		const dx = clamp(
			event.clientX - current.startX,
			limits.left,
			Math.max(limits.left, limits.right),
		);
		const dy = clamp(event.clientY - current.startY, limits.up, Math.max(limits.up, limits.down));
		moveTo(current.popup, current.from.x + dx, current.from.y + dy);
	};

	return {
		onPointerDown,
		onPointerMove,
		onPointerUp: endDrag,
		onLostPointerCapture: endDrag,
	};
};
