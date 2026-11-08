import type { HotkeyRegistrationView } from "@tanstack/react-hotkeys";
import { create } from "zustand";

import type { TPreferences } from "./preferences";

/**
 * Keys and mouse (ADR-0157): what every key, click and drag does, in a panel
 * opened with ? or from the app menu. The keys come from the editor's own
 * hotkey registrations, by their `meta.group`, so a new shortcut shows up by
 * itself; the mouse and touch are written here, following the preferences.
 */

/** The groups the panel shows keys in, in this order; a shortcut names one in its `meta.group`. */
export const KEY_GROUP = {
	app: "App",
	view: "View",
	flying: "Flying (View mode, or holding the right button)",
	selection: "Selection",
	selected: "With something selected",
	drawing: "Drawing and painting",
} as const;

export type TKeyGroup = (typeof KEY_GROUP)[keyof typeof KEY_GROUP];

const GROUP_ORDER: readonly string[] = Object.values(KEY_GROUP);

/** Whether the Keys and mouse panel is open. */
export const useControlsPanel = create<{ isOpen: boolean }>(() => ({ isOpen: false }));

export const openControls = (isOpen: boolean) => useControlsPanel.setState({ isOpen });

/** A row: what to press (each a key cap, or a word like "drag"), and what it does. */
export interface IControl {
	press: readonly string[];
	does: string;
}

export interface IControlGroup {
	title: string;
	controls: IControl[];
}

/**
 * What to press for a row: "or" between the keys that do the same (Delete or
 * Backspace), and a run of single keys as its first to its last (1 to 9).
 */
const pressOf = (keys: readonly string[][]) => {
	if (keys.length > 3 && keys.every((caps) => caps.length === 1)) {
		return [keys[0][0], "to", keys[keys.length - 1][0]];
	}
	return keys.flatMap((caps, index) => (index === 0 ? caps : ["or", ...caps]));
};

/** Key names as they're printed on keys: arrows and punctuation as signs, Esc. */
const KEY_LABELS: Readonly<Record<string, string>> = {
	ArrowLeft: "←",
	ArrowRight: "→",
	ArrowUp: "↑",
	ArrowDown: "↓",
	Comma: ",",
	Equal: "=",
	Minus: "−",
	Slash: "/",
	Escape: "Esc",
};

/** Shifted punctuation as the sign it types (US layout, as the shortcuts are written): ? and +. */
const SHIFTED: Readonly<Record<string, string>> = { "/": "?", "=": "+" };

/**
 * A hotkey's key caps from its formatted parts (`formatForDisplay` with
 * `parts`): key names as printed, and Shift + / as ?.
 */
export const keyCapsOf = (parts: readonly string[]) => {
	const caps = parts.map((part) => KEY_LABELS[part] ?? part);
	const last = caps[caps.length - 1];
	if (caps.length === 2 && caps[0] === "Shift" && SHIFTED[last]) {
		return [SHIFTED[last]];
	}
	return caps;
};

/**
 * The editor's keys by group, from its hotkey registrations: one row per name,
 * with every key that does it (Delete and Backspace), in the order they were
 * registered. Registrations without a group (a list's arrows, a field's Enter)
 * belong to their widget, not the editor, and are left out. `format` turns a
 * hotkey into its key caps for this platform.
 */
export const keyGroupsOf = (
	registrations: readonly HotkeyRegistrationView[],
	format: (hotkey: HotkeyRegistrationView["hotkey"]) => string[],
): IControlGroup[] => {
	const groups = new Map<string, Map<string, string[][]>>();
	for (const registration of registrations) {
		const { name, group } = registration.options.meta ?? {};
		if (!name || !group) {
			continue;
		}
		const rows = groups.get(group) ?? new Map<string, string[][]>();
		groups.set(group, rows);
		const keys = rows.get(name) ?? [];
		const caps = format(registration.hotkey);
		if (!keys.some((known) => known.join("+") === caps.join("+"))) {
			keys.push(caps);
		}
		rows.set(name, keys);
	}
	const rank = (title: string) => {
		const index = GROUP_ORDER.indexOf(title);
		return index < 0 ? GROUP_ORDER.length : index;
	};
	return [...groups]
		.sort(([a], [b]) => rank(a) - rank(b))
		.map(([title, rows]) => ({
			title,
			controls: [...rows].map(([does, keys]) => ({ press: pressOf(keys), does })),
		}));
};

/** The modifier keys' names on this platform: Cmd and Option on a Mac. */
export const modifierNames = (platform: "mac" | "windows" | "linux") =>
	platform === "mac"
		? { ctrl: "Cmd", alt: "Option", shift: "Shift" }
		: { ctrl: "Ctrl", alt: "Alt", shift: "Shift" };

/**
 * The mouse and touch, as the preferences set them (ADR-0156): what Shift and
 * Alt do with a left drag says what this browser does now.
 */
export const mouseGroupsOf = (
	preferences: Pick<TPreferences, "shiftDrag" | "altDrag">,
	platform: "mac" | "windows" | "linux",
): IControlGroup[] => {
	const key = modifierNames(platform);
	return [
		{
			title: "Moving the view",
			controls: [
				{ press: ["Drag"], does: "Pans the view" },
				{
					press: [key.shift, "drag"],
					does:
						preferences.shiftDrag === "orbit"
							? "Orbits the view, from anywhere: over what's selected and its handles too"
							: "Pans the view, from anywhere: over what's selected and its handles too",
				},
				{
					press: [key.alt, "drag"],
					does:
						preferences.altDrag === "orbit"
							? "Orbits the view (on what's selected, moves it off the grid)"
							: "Pans the view (on what's selected, moves it off the grid)",
				},
				{ press: ["Right-drag"], does: "Orbits the view round the spot under the pointer" },
				{ press: ["Wheel"], does: "Zooms towards the pointer" },
				{ press: ["Middle-drag"], does: "Zooms" },
				{ press: ["Hold right button", "W A S D"], does: "Flies: Q and E go down and up" },
			],
		},
		{
			title: "Selecting",
			controls: [
				{ press: ["Click"], does: "Selects what's under the pointer" },
				{
					press: [key.shift, "or", key.ctrl, "click"],
					does: "Adds to the selection, or takes out of it",
				},
				{ press: ["Right-click"], does: "A menu: Select what's here, paste and more" },
			],
		},
		{
			title: "What's selected",
			controls: [
				{ press: ["Drag it"], does: "Moves it, on the grid" },
				{ press: [key.alt, "drag it"], does: "Moves it off the grid" },
				{ press: [key.ctrl, "drag it"], does: "Drags a copy" },
				{ press: ["Drag a handle"], does: "Moves a point, or resizes it" },
			],
		},
		{
			title: "Touch",
			controls: [
				{ press: ["One finger"], does: "Pans the view" },
				{ press: ["Two fingers"], does: "Pinch to zoom, twist to turn" },
			],
		},
	];
};
