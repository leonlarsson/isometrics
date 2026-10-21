import { useHotkeys } from "@tanstack/react-hotkeys";
import { type PointerEvent, useRef, useState } from "react";

import { APP_NAME } from "#/lib/app";
import { clamp } from "#/lib/math";

import styles from "./ResizeHandle.module.css";

const STORAGE_KEY = `${APP_NAME.toLowerCase()}:inspector-width`;
export const INSPECTOR_WIDTH = { min: 260, max: 640, initial: 320 };
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

const readStoredWidth = () => {
	try {
		const stored = Number(localStorage.getItem(STORAGE_KEY));
		return stored
			? clamp(stored, INSPECTOR_WIDTH.min, INSPECTOR_WIDTH.max)
			: INSPECTOR_WIDTH.initial;
	} catch {
		return INSPECTOR_WIDTH.initial;
	}
};

const storeWidth = (width: number) => {
	try {
		localStorage.setItem(STORAGE_KEY, String(width));
	} catch {
		// Storage unavailable (private mode etc.): the width just won't persist.
	}
};

/** Inspector width, persisted per browser. This is a UI preference, not part of the scene. */
export const useInspectorWidth = () => {
	const [width, setWidthState] = useState(readStoredWidth);
	const setWidth = (next: number) => {
		const value = Math.round(clamp(next, INSPECTOR_WIDTH.min, INSPECTOR_WIDTH.max));
		setWidthState(value);
		storeWidth(value);
	};
	return [width, setWidth] as const;
};

interface IResizeHandleProps {
	width: number;
	onResize: (width: number) => void;
}

/** Vertical drag handle on the left edge of a right-hand panel. */
export const ResizeHandle = ({ width, onResize }: IResizeHandleProps) => {
	const drag = useRef<{ startX: number; startWidth: number } | null>(null);
	const handle = useRef<HTMLDivElement>(null);

	// Only while the handle itself has focus. The panel is on the right, so Left widens it.
	useHotkeys(
		[
			{ hotkey: "ArrowLeft", callback: () => onResize(width + KEY_STEP) },
			{ hotkey: "ArrowRight", callback: () => onResize(width - KEY_STEP) },
			{ hotkey: "Shift+ArrowLeft", callback: () => onResize(width + KEY_STEP_LARGE) },
			{ hotkey: "Shift+ArrowRight", callback: () => onResize(width - KEY_STEP_LARGE) },
			{ hotkey: "Home", callback: () => onResize(INSPECTOR_WIDTH.initial) },
		],
		{ target: handle },
	);

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { startX: event.clientX, startWidth: width };
		document.body.dataset.resizing = "true";
	};

	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (!drag.current) {
			return;
		}
		// The panel is on the right, so dragging left makes it wider.
		onResize(drag.current.startWidth + (drag.current.startX - event.clientX));
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
			aria-orientation="vertical"
			aria-label="Resize panel"
			aria-valuenow={width}
			aria-valuemin={INSPECTOR_WIDTH.min}
			aria-valuemax={INSPECTOR_WIDTH.max}
			tabIndex={0}
			title="Drag to resize · double-click to reset"
			className={styles.handle}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={endDrag}
			onLostPointerCapture={endDrag}
			onDoubleClick={() => onResize(INSPECTOR_WIDTH.initial)}
		/>
	);
};
