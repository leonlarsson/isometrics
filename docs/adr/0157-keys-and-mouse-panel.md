---
status: proposed
date: 2026-11-08
---

# 0157. Keys and mouse: a panel of every key, click and drag

## Context and problem statement

What each key and drag does was only found by trying, in menus' shortcut hints and in a few bars. With ADR-0156 moving orbit off Shift + drag, the owner went looking for it and found nothing that said where it went (2026-11-08). The app needs one place that says what every key, click and drag does, and it must not go stale as shortcuts are added or the viewer changes the preferences.

## Decision drivers

- One place, opened the way other tools do it (? in Figma, GitHub, Gmail).
- It can't go stale: a new shortcut appears by itself.
- It says what this browser does now, with the viewer's preferences.

## Considered options

1. **A panel built from the editor's hotkey registrations**, the mouse written by hand from the preferences.
2. A hand-written list of every key and gesture.
3. Only the mouse and camera, the part that changed.

## Decision outcome

Chosen option: **1**.

- **Keys and mouse** (`ui/ControlsDialog`), opened with **?** (Shift + /) or the app menu's **Keys and mouse…**, with a search.
- **Keys** come from `useHotkeyRegistrations()`: every editor-wide shortcut names its group in `meta.group` (`KEY_GROUP` in `editor/controls.ts`: App, View, Flying, Selection, With something selected, Drawing and painting), and the panel lists them by group, one row per name with every key that does it. A widget's own keys (a list's arrows, a field's Enter) have no group and aren't listed; a test checks every shortcut in `useShortcuts.ts` has one. Keys print as on the keyboard (← , = Esc, Cmd and Option on a Mac); a run of single keys reads first to last (1 to 9).
- **Mouse and touch** are written in `mouseGroupsOf`, from the preferences: Shift and Alt with a drag say what they do now, and the panel opens Preferences to change them.
- The keys of drawing, painting and keyboard transforms show in their bars while in use; the panel says so rather than listing keys that do nothing until then.
- It's mounted only while open: the registrations re-render it on every key press.

### Consequences

- Good: one place to look; new shortcuts appear by themselves; it follows the preferences.
- Bad: mouse rows are written by hand and must be kept in step with the camera and handles (ADR-0156).
- Later: the bars' keys in the panel, if wanted, by keeping their definitions where the panel can read them.

## More information

ADR-0016 (keyboard shortcuts through `@tanstack/react-hotkeys`), ADR-0156 (Shift, Ctrl and Alt drags), ADR-0062 (camera preferences).
