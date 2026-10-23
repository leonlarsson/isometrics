---
status: accepted
date: 2026-10-23
---

# 0046. Phones: a More menu in the toolbar, the sheet toggle in its tab bar, bars at the bottom in View mode

## Context and problem statement

The narrow layout ([ADR-0030](0030-narrow-layout-bottom-sheet.md)) kept every toolbar button. On a 360–390 px phone they didn't fit: the File menu shrank to "F", undo and redo were drawn over the Edit/View switch (View couldn't be tapped at all), and the theme button ran off the screen. The status banner wrapped to two lines, the bottom sheet spent a whole row on its hide/show chevron, and in View mode the viewpoint bar covered the world's title and said "Press →".

## Decision drivers

- The scene is the product; chrome on a phone should take as little height as it can.
- Every control stays reachable, and the Edit/View switch is always tappable.
- No separate phone components: the same toolbar, with CSS deciding what shows.

## Considered options

1. Let the toolbar scroll sideways.
2. Shrink the buttons further.
3. Keep the most used buttons and move the rest into a More (⋯) menu.

## Decision outcome

Chosen option: **3**, at the toolbar's existing `max-width: 700px` breakpoint:

- **Toolbar:** File, the Edit/View switch, undo and redo, Views (camera icon only) and **More**. More holds Play motion, Perspective view and Snap to grid as checkbox items, then Re-centre camera and the theme. The toolbar is 48 px tall. Both sets of buttons are rendered and CSS shows one (`wideOnly` / `narrowOnly`), so there's no JS breakpoint to keep in sync.
- **Menu kit:** `Menu.CheckboxItem` (a tick on the right, closes the menu when picked) and `Menu.Trigger chevron={false}` for an icon-only trigger.
- **Status banner:** one line that is cut off rather than wrapped, with a shorter text.
- **Sheet:** the hide/show chevron sits at the end of the tab bar (`Tabs barEnd`), so the folded sheet is a single row.
- **Bars in View mode:** on narrow screens (`max-width: 900px`, like the sheet) the floating bars sit at the bottom of the scene, in thumb reach and clear of the title. Touch screens (`hover: none`) get "Tap the arrow to start" instead of a key hint.

### Consequences

- Good: everything fits on a 360 px phone, including View; about 60 px more of the scene shows with the sheet folded.
- Bad: play, perspective and the theme are one more tap away on phones.
- Bad: the More menu duplicates the wide toolbar's buttons in markup, so a new toolbar action needs adding in both places.

## More information

`src/ui/Toolbar.tsx`, `Toolbar.module.css`, `src/ui/Menu.tsx`, `src/ui/Tabs.tsx`, `src/ui/AppShell.tsx`, `src/ui/DrawingBar.module.css` (shared bar styles), `src/ui/StatusBanner.module.css`. Builds on [ADR-0030](0030-narrow-layout-bottom-sheet.md).
