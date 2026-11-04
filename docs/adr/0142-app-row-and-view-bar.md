---
status: proposed
date: 2026-11-04
---

# 0142. The top bar in two rows: an app row across the window, a view bar over the view

## Context and problem statement

The toolbar was one row across the window: the logo, File, AI and the save status on the left, the Edit/View switch in the middle, then undo and redo, the tools, Views, Overlays, the shading switcher, the camera and the theme. As it filled up (the shading switcher, ADR-0080; the Overlays menu, ADR-0141), the left group and the switch in the middle met: in the owner's screenshot "Not saved yet" ran under the Edit/View switch. And what's about the app (File, Preferences, the theme) sat in the same row as what's about the 3D view, which also folded by the window's width while the view between the side panels is much narrower.

## Decision drivers

- The save status and the Edit/View switch never collide, at any width.
- What's about the app and this browser apart from what's about editing and looking at the view.
- The side panels keep their full height; the bars over the view (FloatingBar and the others) stay clear of the toolbar.
- Phones keep their one-row toolbar (ADR-0046) and the bottom sheet (ADR-0030).
- Every control keeps its accessible name.

## Considered options

1. Keep one row, and fold it sooner.
2. **An app row across the window, and a view bar over the view only** (the owner's choice), like Blender's top bar and its 3D view's header.
3. Two rows, both across the window.

## Decision outcome

Chosen option: **2**.

- **The app row** (`ui/AppRow.tsx`, 44px, as tall as a panel's header, so its buttons have room above and below their hover): the logo (the app menu), File, the AI button and the save status on the left; on the right a tray of the app's and this browser's own switches: the side panels' toggle (Edit mode, wide layout; it sits here so it stays under the pointer while the panels and the view bar's edges move), Preferences… (a cog, new as a button; Ctrl+, and the app menu still open it) and the theme (only while a world is open: the theme is saved with the world). With the room the row now has, the logo keeps its name and the save status its words down to the phone width.
- **The view bar** (`ui/ViewBar.tsx`, 44px): the top of the view's own column, between the side panels, which now reach up to the app row. The stage is under it, so the bars over the view, the world's title and the loading screen start below it. Its clusters are in groups by meaning, a clear gap between groups:
  - Left, editing: the Edit/View switch; History (undo, redo); **Tools**, one at a time like a paint program's tool bar: Select (the default, whenever no other tool is on), Select with a box, Paint; the one in use shows pressed; and **Snapping** (Snap to grid) on its own, a switch on where moves land with any tool, not a tool.
  - Right, looking: **View** (Views, Overlays, and the shading switcher beside them), **Motion** (play/pause), **Camera** (the camera menu, Re-centre camera).
  - The tools stay in the bar rather than in a vertical strip at the view's left edge: that edge has the world's title and label cards, a strip would take width from the world and need a second home on phones and in the narrow layout, and three tools fit in the bar.
- **Folding by the bar's own width** (`ui/useViewBarFolds.ts`, a ResizeObserver, so hiding or resizing a side panel counts as much as the window): in steps, the shading switcher becomes one Shading menu in the View cluster (its icon the shading shown now); Views shows just its icon; play and Re-centre camera move into More; Edit and View show just their icons; the tools and Snap to grid move into More; then the shading, overlays and camera menus (as on phones); and last undo and redo, for a view squeezed between two wide panels. More keeps the bar's order (history, tools, snapping, view, motion, camera). The widths are measured per mode (View mode has no history or tools). More lists only what's folded; the bar re-renders only when a step changes, not on every pixel of a drag; past its last step it clips rather than drawing over the panels.
- **Phones** (below 700px): one row as before (ADR-0046): the view bar comes into the app row after File and the save status, folded as the phone toolbar was, with the theme in its More and the app menu's items at the end of File. The narrow layout's sheet is unchanged.
- **Home screen and while a link opens:** only the app row; there's no view to have a bar.
- **Decided with the owner (2026-11-04):** the theme stays the world's; no present/fullscreen button; the side panels' toggle stays in the app row; the shorter view is accepted.

### Consequences

- Good: the app row and the view bar can't run into each other, and each has room; the view's tools fold as its own width runs out, side panels included.
- Good: the side panels reach the app row, their headers in line with the view bar.
- Good: which tool the view's drags use is always shown; Snap to grid no longer reads as a fourth tool.
- Bad: the view is 32px shorter than under the one 56px row (88px of bars).
- Bad: the fold widths are numbers measured in the browser: a new button in the view bar needs them measured again (the end-to-end check fails if the bar overflows).

## More information

`src/ui/AppRow.tsx`, `src/ui/ViewBar.tsx`, `src/ui/useViewBarFolds.ts`, `src/ui/useThemeCycle.ts`, `src/ui/AppShell.tsx` (the view's column), `src/ui/ShadingSwitcher.tsx` (`ShadingMenu`), `src/ui/Menu.module.css` (a menu button in a cluster), `src/ui/Icon.tsx` (`cog`, `pointer`), `docs/handover/menus-proposal.md` (root menus, not built), `e2e/layout.spec.ts`. Replaces `src/ui/Toolbar.tsx`. Builds on ADR-0030, ADR-0046, ADR-0055, ADR-0057, ADR-0080, ADR-0141.
