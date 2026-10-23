import { HotkeysProvider, useHotkeys } from "@tanstack/react-hotkeys";
import { useEffect } from "react";

import {
	selectSelectedEntity,
	type TTransformAxis,
	type TTransformMode,
	useEditor,
} from "#/editor/store";
import { getPart } from "#/parts/registry";

import { Button } from "./Button";
import { roadName, useRouteHint } from "./FollowOfferBar";
import { Kbd } from "./fields";

// Same floating bar as road drawing: both are short modal states over the scene.
import styles from "./DrawingBar.module.css";

const VERBS: Record<TTransformMode, string> = {
	grab: "Moving",
	rotate: "Turning",
	scale: "Resizing",
};

const UNITS: Record<TTransformMode, string> = { grab: "", rotate: "°", scale: "×" };

const AXIS_LABELS: Record<TTransformAxis, string> = {
	x: "along X",
	y: "up and down",
	z: "along Z",
};

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const TransformControls = () => {
	const transform = useEditor((s) => s.transform);
	const entity = useEditor(selectSelectedEntity);
	const route = useRouteHint();

	const update = useEditor.getState().updateTransform;
	const typed = transform?.typed ?? "";
	// Read the latest typed text when a key arrives, not the text from the last render.
	const edit = (change: (text: string) => string) =>
		update({ typed: change(useEditor.getState().transform?.typed ?? "") });
	const confirm = () => {
		const store = useEditor.getState();
		store.setCancelGesture(null);
		store.endTransform();
	};
	const cancel = () => useEditor.getState().cancelGesture?.();
	const lockAxis = (axis: TTransformAxis) =>
		update({ axis: useEditor.getState().transform?.axis === axis ? null : axis });

	// Keys go to the transform, not to whatever button was focused last (Enter would press it).
	useEffect(() => {
		const focused = document.activeElement;
		if (focused instanceof HTMLElement && !focused.matches("input, textarea, select")) {
			focused.blur();
		}
	}, []);

	useHotkeys([
		{
			hotkey: "Enter",
			callback: confirm,
			options: { ignoreInputs: false, meta: { name: "Confirm transform" } },
		},
		{
			hotkey: "Escape",
			callback: cancel,
			options: { ignoreInputs: false, meta: { name: "Cancel transform" } },
		},
		...(transform?.mode === "grab"
			? (["x", "y", "z"] as const).map((axis) => ({
					hotkey: axis.toUpperCase() as "X" | "Y" | "Z",
					callback: () => lockAxis(axis),
					options: { meta: { name: `Lock to ${axis.toUpperCase()}` } },
				}))
			: []),
		...DIGITS.map((digit) => ({
			hotkey: digit,
			callback: () => edit((text) => text + digit),
			options: { meta: { name: "Type a value" } },
		})),
		{
			hotkey: ".",
			callback: () => edit((text) => (text.includes(".") ? text : `${text}.`)),
			options: { meta: { name: "Decimal point" } },
		},
		{
			hotkey: "-",
			callback: () => edit((text) => (text.startsWith("-") ? text.slice(1) : `-${text}`)),
			options: { meta: { name: "Negative value" } },
		},
		{
			hotkey: "Backspace",
			callback: () => edit((text) => text.slice(0, -1)),
			options: { meta: { name: "Delete typed digit" } },
		},
	]);

	if (!transform) {
		return null;
	}

	const what = entity ? entity.name || getPart(entity.kind)?.name || "object" : "road point";
	const how = transform.axis ? ` ${AXIS_LABELS[transform.axis]}` : "";
	const value = typed ? `${typed}${UNITS[transform.mode]}` : null;
	// A vehicle moved over a road snaps onto it (see render/routeDrop).
	const routeHint = !route
		? null
		: !route.road
			? "Off the roads: confirm to park it here."
			: route.rerouting
				? `On “${roadName(route.road)}”: confirm and it drives on from here.`
				: `On “${roadName(route.road)}”: confirm, then choose whether it drives along it.`;
	const hint = routeHint
		? routeHint
		: transform.mode === "grab"
			? "Move the mouse, or type a distance."
			: transform.mode === "rotate"
				? "Move the mouse around it, or type an angle."
				: "Move the mouse away or closer, or type a factor.";

	return (
		<div className={styles.bar} data-label-obstacle="" role="status">
			<div className={styles.text}>
				<strong>{`${VERBS[transform.mode]} ${what}${how}${value ? ` · ${value}` : ""}`}</strong>

				<span>{hint}</span>

				{transform.mode === "grab" ? (
					<span className={styles.keys}>
						<Kbd>X</Kbd> <Kbd>Y</Kbd> <Kbd>Z</Kbd> lock an axis · hold <Kbd>Alt</Kbd> to skip
						snapping
					</span>
				) : (
					<span className={styles.keys}>
						Hold <Kbd>Alt</Kbd> to skip snapping
					</span>
				)}

				<span className={styles.keys}>
					<Kbd>Enter</Kbd> or click to confirm · <Kbd>Esc</Kbd> or right-click to cancel
				</span>
			</div>

			<div className={styles.actions}>
				<Button onClick={cancel}>Cancel</Button>

				<Button variant="primary" onClick={confirm}>
					Done
				</Button>
			</div>
		</div>
	);
};

/**
 * Shown during a keyboard transform (G / R / S). Its keys live in an exclusive
 * scope, so Backspace edits the typed number instead of deleting the object,
 * and Esc cancels the transform instead of deselecting.
 */
export const TransformBar = () => {
	const active = useEditor((s) => s.transform !== null);
	if (!active) {
		return null;
	}

	return (
		<HotkeysProvider scope="transform" exclusive>
			<TransformControls />
		</HotkeysProvider>
	);
};
