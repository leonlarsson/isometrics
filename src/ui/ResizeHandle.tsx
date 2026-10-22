import { useHotkeys } from "@tanstack/react-hotkeys";
import { type PointerEvent, useRef, useState } from "react";

import { APP_NAME } from "#/lib/app";
import { clamp } from "#/lib/math";

import styles from "./ResizeHandle.module.css";

interface ISizeLimits {
	min: number;
	max: number;
	initial: number;
}

export const INSPECTOR_WIDTH: ISizeLimits = { min: 260, max: 640, initial: 320 };
/** The outliner's height on top of the inspector (the column caps it so the inspector stays usable). */
export const OUTLINER_HEIGHT: ISizeLimits = { min: 140, max: 900, initial: 360 };
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

/** A panel size in pixels, persisted per browser. A UI preference, not part of the scene. */
const useStoredSize = (name: string, limits: ISizeLimits) => {
	const key = `${APP_NAME.toLowerCase()}:${name}`;
	const [size, setSizeState] = useState(() => {
		try {
			const stored = Number(localStorage.getItem(key));
			return stored ? clamp(stored, limits.min, limits.max) : limits.initial;
		} catch {
			return limits.initial;
		}
	});
	const setSize = (next: number) => {
		const value = Math.round(clamp(next, limits.min, limits.max));
		setSizeState(value);
		try {
			localStorage.setItem(key, String(value));
		} catch {
			// Storage unavailable (private mode etc.): the size just won't persist.
		}
	};
	return [size, setSize] as const;
};

export const useInspectorWidth = () => useStoredSize("inspector-width", INSPECTOR_WIDTH);
export const useOutlinerHeight = () => useStoredSize("outliner-height", OUTLINER_HEIGHT);

interface IResizeHandleProps {
	size: number;
	onResize: (size: number) => void;
	/**
	 * vertical (default): on the left edge of a right-hand panel; dragging left widens it.
	 * horizontal: under a top pane; dragging down makes the pane taller.
	 */
	orientation?: "vertical" | "horizontal";
}

/** A drag handle that resizes a panel; arrow keys while focused, double-click resets. */
export const ResizeHandle = ({ size, onResize, orientation = "vertical" }: IResizeHandleProps) => {
	const drag = useRef<{ start: number; startSize: number } | null>(null);
	const handle = useRef<HTMLDivElement>(null);
	const vertical = orientation === "vertical";
	const limits = vertical ? INSPECTOR_WIDTH : OUTLINER_HEIGHT;
	// The key (and pointer direction) that grows the panel.
	const [grow, shrink] = vertical ? ["ArrowLeft", "ArrowRight"] : ["ArrowDown", "ArrowUp"];

	// Only while the handle itself has focus.
	useHotkeys(
		[
			{ hotkey: grow as "ArrowLeft", callback: () => onResize(size + KEY_STEP) },
			{ hotkey: shrink as "ArrowRight", callback: () => onResize(size - KEY_STEP) },
			{
				hotkey: `Shift+${grow}` as "Shift+ArrowLeft",
				callback: () => onResize(size + KEY_STEP_LARGE),
			},
			{
				hotkey: `Shift+${shrink}` as "Shift+ArrowRight",
				callback: () => onResize(size - KEY_STEP_LARGE),
			},
			{ hotkey: "Home", callback: () => onResize(limits.initial) },
		],
		{ target: handle },
	);

	const position = (event: PointerEvent) => (vertical ? event.clientX : event.clientY);

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { start: position(event), startSize: size };
		document.body.dataset.resizing = orientation;
	};

	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (!drag.current) {
			return;
		}
		const moved = position(event) - drag.current.start;
		// A right-hand panel grows to the left; a top pane grows downwards.
		onResize(drag.current.startSize + (vertical ? -moved : moved));
	};

	const endDrag = () => {
		drag.current = null;
		delete document.body.dataset.resizing;
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: an <hr> can't be focused or dragged; role="separator" is the ARIA pattern for splitters
		<div
			ref={handle}
			role="separator"
			aria-orientation={vertical ? "vertical" : "horizontal"}
			aria-label={vertical ? "Resize panel" : "Resize outliner"}
			aria-valuenow={size}
			aria-valuemin={limits.min}
			aria-valuemax={limits.max}
			tabIndex={0}
			title="Drag to resize · double-click to reset"
			className={styles.handle}
			data-orientation={orientation}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={endDrag}
			onLostPointerCapture={endDrag}
			onDoubleClick={() => onResize(limits.initial)}
		/>
	);
};
