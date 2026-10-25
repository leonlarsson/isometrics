---
status: accepted
date: 2026-10-25
---

# 0063. A world says what shows on screen over it

## Context and problem statement

Some worlds are meant to be looked at without anything in the way: on a wall screen, in a presentation, or as a clean picture. Everything drawn over the world was always there: the title, subtitle and time of day in the corner, every label card that's switched on, the details panel that opens when an object is clicked in View mode, and the viewpoint bar in View mode. Hiding them meant changing each object, or not at all.

## Decision drivers

- One place per world, and it travels with the world (a shared file opens as clean as it was made).
- The same in Edit and View mode, so what you set up is what you see.
- Old worlds keep showing everything (ADR-0026, ADR-0056).

## Considered options

1. A world setting with a switch per thing on screen.
2. One "clean view" switch for everything.
3. A per-browser preference.

## Decision outcome

Chosen option: **1**, `scene.onScreen` with `title`, `subtitle`, `timeOfDay`, `labelCards`, `details` and `viewpointBar`, all true by default. The World tab's **On screen** panel has a switch for each, with Default / Reset (ADR-0027) and a hint where it needs one. Label cards off hides every card, whatever each object says (an object's own card is still switched in its Label tab); the viewpoint bar off still lets ← and → step through the viewpoints in View mode.

### Consequences

- Good: a world can be made presentation-clean once, for everyone who opens it.
- Bad: with the title off in Edit mode, the time-of-day shortcut to Sun & sky goes with it (the tab is still there).

## More information

- Code: `scene/schema.ts` (`OnScreenSchema`), `ui/WorldTabs.tsx` (`OnScreenSection`), `ui/AppShell.tsx` (`SceneTitle`), `ui/LabelLayer.tsx`, `ui/DetailSheet.tsx`, `ui/ViewpointBar.tsx`.
