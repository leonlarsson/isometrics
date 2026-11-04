---
status: proposed
date: 2026-11-04
---

# 0141. An Overlays menu beside the shading switcher

## Context and problem statement

The overlays drawn over the view (the navigation gizmo, the view label, viewpoints in the world, the composition grid; ADR-0062) were switched in two places: Preferences → Overlays, where each is set to show Off, in Edit mode, in View mode or in both, and a group of ticks in the camera menu for the mode you're in. The ground's grid had no setting: it showed in Edit mode, always. ADR-0080 left for later "the overlays in a dropdown beside the switcher, like Blender's".

## Decision drivers

- One place in the toolbar to show or hide what's drawn over the view, as Blender's Overlays dropdown.
- Overlays stay this browser's preferences (ADR-0062, ADR-0072), never the world's: the world's own on-screen items (title, label cards, the viewpoint bar; ADR-0063) are for viewers, the overlays are tools.
- No second setting for the same thing: the menu switches the same preferences as Preferences → Overlays.

## Considered options

1. **An Overlays menu beside the shading switcher**, its ticks for the mode you're in, and the camera menu's group taken out.
2. The same menu, keeping the camera menu's group as well.

## Decision outcome

Chosen option: **1**.

- `ui/OverlaysMenu.tsx`: a menu button (two overlapping circles, the tooltip "Overlays") just before the shading switcher, in the same slot, so it folds into More below 1300px with it (there as an **Overlays** submenu). Its group, **Overlays in Edit mode** or **Overlays in View mode**, ticks each overlay shown in the mode you're in; ticking switches it there and keeps the other mode as it was (`overlayPlaceWith`), and the menu stays open to flip several. **Overlay settings…** opens Preferences on the Overlays page, where both modes are set.
- The camera menu's group of the same ticks is taken out: the two menus sit side by side, and one place is the point.
- **Ground grid** is a new overlay preference (`groundGrid`, Edit mode by default, as the grid always was), on Preferences → Overlays and in the menu. Snap to grid works with it hidden.
- The world's label cards and other on-screen items (ADR-0063) stay in the world's settings: they're what viewers see, saved with the world, not the editor's tools.

### Consequences

- Good: every overlay is a click away, named as on Preferences → Overlays; the ground grid can be hidden while editing, or shown in View mode.
- Bad: one more button in the toolbar; the camera menu no longer switches overlays, for anyone used to it there.

## More information

Code: `src/ui/OverlaysMenu.tsx`, `src/ui/Toolbar.tsx`, `src/editor/preferences.ts` (`groundGrid`, `TOverlay`), `src/render/Ground.tsx`, `src/ui/PreferencesDialog.tsx`, `src/ui/Icon.tsx` (`overlays`). Related: ADR-0062, ADR-0063, ADR-0072, ADR-0080.
