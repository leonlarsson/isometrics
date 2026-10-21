---
status: accepted
date: 2026-10-21
---

# 0016. Keyboard shortcuts use TanStack Hotkeys

## Context and problem statement

The first shortcuts were a hand-written `window` `keydown` listener with its own "am I typing?" check. Adding more shortcuts (Space to pause, keyboard resizing of the inspector) means re-solving the same problems every time: text fields, focused buttons, key repeat, `Mod` on macOS vs Ctrl elsewhere, and browser defaults.

## Decision outcome

All keyboard handling goes through **`@tanstack/react-hotkeys`** (`useHotkey` / `useHotkeys`). Install only the React adapter; it re-exports `@tanstack/hotkeys`, and a second copy would break scopes.

- App-wide editor shortcuts live in `src/editor/useShortcuts.ts`. Shortcuts that belong to one widget are registered in that widget, with `target: ref`, so they only fire while it has focus (e.g. arrow keys on the inspector's resize handle in `src/ui/ResizeHandle.tsx`).
- Rely on the defaults: single keys are skipped while typing in text fields, `Mod` chords and `Escape` still fire, and matched keys are `preventDefault`ed.
- Modifiers match exactly: register `Shift+Q` / `Shift+ArrowLeft` as separate hotkeys rather than checking `event.shiftKey`.
- Use `enabled` for single-key shortcuts that only apply in some states. Keep `Mod` chords enabled and return early instead, because a disabled hotkey lets the browser act (`Mod+D` would bookmark).
- Toggles use `requireReset: true` so holding the key doesn't flicker.
- **Space (pause/play)** sets `ignoreInputs: false` so it also works while a button has focus; otherwise the last-clicked toolbar button would be pressed again. It still returns early for text fields and calls `preventDefault` itself.
- Give each hotkey `meta: { name }`, ready for a future shortcut cheat sheet.

Enforcement: by convention and review, not lint. Don't add `addEventListener("keydown" | "keyup" | "keypress", …)` or JSX `onKey*` props.

This replaces the "Keyboard" implementation note in ADR-0009; the shortcuts themselves are unchanged apart from adding Space.

### Consequences

- Good: one consistent mechanism; typing, focus, platform and browser-default handling come from the library; there's a clear path to rebindable shortcuts and a cheat sheet (`defineAppHotkeys`, `useAppHotkeyList`).
- Bad: the library is in beta (0.x), so expect API changes on upgrade. Single-letter shortcuts (Q/E) should eventually get an off switch for WCAG 2.1.4, via app hotkeys or a setting.
