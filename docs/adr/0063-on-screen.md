---
status: accepted
date: 2026-10-25
---

# 0063. A world says what viewers see over it in View mode

## Context and problem statement

Some worlds are meant to be looked at without anything in the way: on a wall screen, in a presentation, or as a clean picture. Everything drawn over the world was always there: the title, subtitle and time of day in the corner, every label card that's switched on, the details panel that opens when an object is clicked in View mode, and the viewpoint bar in View mode. Hiding them meant changing each object, or not at all.

## Decision drivers

- One place per world, and it travels with the world (a shared file opens as clean as it was made).
- Edit mode is for building: the author still needs to see (and edit) what viewers won't, as Blender keeps *hide in render* apart from *hide in viewport*.
- Old worlds keep showing everything (ADR-0026, ADR-0056).

## Considered options

1. A world setting with a switch per thing on screen.
2. One "clean view" switch for everything.
3. A per-browser preference.

## Decision outcome

Chosen option: **1**, `scene.onScreen` with `title`, `subtitle`, `timeOfDay`, `labelCards`, `details` and `viewpointBar`, all true by default, each saying whether it **shows in View mode**. Edit mode always shows everything, and draws what View mode won't faded (struck-through lines in the title block, faded label cards), so it's clear what viewers miss. The World tab's **Shown in View mode** panel has a switch for each, with Default / Reset (ADR-0027). Label cards off hides every card in View mode, whatever each object says (an object's own card is still switched in its Label tab); the viewpoint bar off still lets ← and → step through the viewpoints. Details on click and the viewpoint bar only ever appear in View mode.

Per-mode choices (Off / Edit / View / Both) were considered and left to the personal overlays in Preferences (ADR-0062): the world's on-screen items are for viewers, the overlays are tools.

### Consequences

- Good: a world can be made presentation-clean once, for everyone who opens it.
- Good: nothing the author works on disappears while editing.

## More information

- Code: `scene/schema.ts` (`OnScreenSchema`), `ui/WorldTabs.tsx` (`OnScreenSection`), `ui/AppShell.tsx` (`SceneTitle`), `ui/LabelLayer.tsx`, `ui/DetailSheet.tsx`, `ui/ViewpointBar.tsx`.
