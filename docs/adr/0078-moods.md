---
status: proposed
date: 2026-10-26
---

# 0078. Moods: named looks saved in a world, and viewpoints that put one on

## Context and problem statement

A world's look is many settings across Sun & sky and the Camera tab: the time of day and how it passes, the sun, the contrast between sun and shade, the sky and clouds, the water's ripples and reflections, tilt-shift. Getting a world back to "golden hour, paused, tilt-shift on" means setting them one by one, and a shot like the `scripts/shots.mjs` pictures can't be reproduced from the UI. The owner asked for presets per world, and for viewpoints that carry a look (2026-10-26).

## Decision drivers

- One click to a look, and back; undoable like any edit (ADR-0009).
- Saved and shared with the world, as a world's look is (ADR-0072: the look is the world's, graphics are the viewer's).
- Stepping through viewpoints in View mode can tell a story: the town at golden hour, the promenade at night.
- Old worlds open as they were (ADR-0056).

## Considered options

1. **Moods: full snapshots of the look settings**, saved in the world, put on by copying them back.
2. **Partial presets** that only set what they name (the time of day, say), on top of whatever the world has.
3. **Looks kept with each viewpoint** only, not on their own.

## Decision outcome

Chosen option: **1**.

- `scene.moods`: each has an id, a name and copies of `lighting` (the time of day and how it passes included), `sky`, `water`, and the tilt-shift settings of `camera`. Missing parts get the defaults, like the world's own fields.
- **Putting on a mood** copies them into the world as one edit (undoable). A mood whose time cycles starts its day cycle again from the mood's time. The list shows which mood the world wears now, by comparing the settings.
- **Viewpoints** can name a mood (`moodId`, null = leave the look as it is); going to the viewpoint (the list, the Views menu, keys 1–9, the View mode bar) puts it on. Opening a world doesn't: it opens with its own look. A viewer can opt out (a preference, per browser: **Viewpoints put on their moods**, on by default, in Preferences → Camera and as a checkbox in the Views menu); then viewpoints only move the camera.
- UI: Sun & sky → **Moods** (click to put one on; save the current look as a new mood or over one; rename; delete, which leaves viewpoints that had it as they are); the selected viewpoint's **Mood with “…”** field in the Viewpoints tab; the moods in the toolbar's Views menu, so viewers can switch in View mode.
- A new setting that is part of the world's look goes into moods too (`scene/moods.ts`: `moodOf`, `putOnMood`), with its own field in `MoodSchema`.
- Lantern Bay ships The evening passes (its own look, a day cycle from 18:18), Golden hour, Blue hour and Night; its viewpoints put them on.

### Consequences

- Good: a world's looks are one click away and travel with it; viewpoints can show a world at different times of day; shots can be reproduced.
- Bad: putting on a mood in View mode changes the world (as other edits in View mode don't), so it's saved and undoable like an edit; full snapshots mean a mood saved before a new look setting existed puts that setting's default on.
- Later: partial moods (only the time of day) if worlds want them; a world recommending a graphics preset (not now).

## More information

Code: `src/scene/moods.ts`, `src/scene/schema.ts` (`MoodSchema`, a viewpoint's `moodId`), `src/editor/store.ts` (`saveMood`, `putOnMood`, `resaveMood`, `renameMood`, `removeMood`, `goToViewpoint`), `src/ui/MoodsSection.tsx`, `src/ui/ViewpointsSection.tsx`, `src/ui/ViewpointsMenu.tsx`, `src/templates/lanternBay.ts`. Related: ADR-0039, ADR-0052, ADR-0062, ADR-0070, ADR-0072, ADR-0075.
