---
status: proposed
date: 2026-11-08
---

# 0156. Shift + drag pans, Ctrl + drag copies, Alt + drag orbits

## Context and problem statement

A left drag with Shift or Ctrl orbited the view (ADR-0028, ADR-0037), except that Ctrl on a selected object dragged a copy (ADR-0067): one key, two jobs, depending on where the drag began. And there was no way to pan from a selected object: a plain drag there moves it. The owner wants one job per key, as other tools have, with defaults people know and the rest left to the viewer (2026-11-08).

## Decision drivers

- One key, one job, wherever the drag starts.
- Defaults as in the tools people come from: map-style left-drag pan and right-drag orbit (ADR-0028), Ctrl + drag to copy (Windows Explorer, ADR-0067), Alt + drag to orbit (Maya, Unity).
- A trackpad without a right button can still orbit.
- What's a habit can be changed by the viewer (Preferences), never by the world.

## Considered options

1. **Shift pans, Ctrl copies, Alt orbits**, the first and third in Preferences.
2. Shift pans, Ctrl copies, only the right button orbits.
3. Middle-button drag orbits (as in Blender), the wheel the only mouse zoom.

## Decision outcome

Chosen option: **1**.

- **Shift + left-drag pans** (`render/CameraControls`), from anywhere: over a selected object (which isn't grabbed), its gizmo and handles (which let the press through, `shiftDragPans`). Shift- and Ctrl-clicks still add to the selection and take out of it.
- **Ctrl/Cmd + left-drag** drags a copy of the selection when it starts on a selected object or its gizmo (ADR-0067); anywhere else it does nothing, never moving the camera.
- **Alt + left-drag orbits** away from what's selected (`leftDragOrbits`); on a selected object, or its gizmo or a handle, Alt still places freely, off the grid.
- **The right button orbits**, the wheel and middle button zoom, a plain left drag pans, as before.
- **Preferences → Camera → Navigation:** **Shift + left-drag** (Pans the view by default, or Orbits the view as before) and **Alt + left-drag orbits** (on by default; off where the desktop moves windows with Alt + drag, as many Linux desktops do).
- A camera following a vehicle is taken back by a pan, Shift or not.

### Consequences

- Good: each key does one thing; panning from a selected object; Ctrl never moves the camera by surprise.
- Bad: Shift + drag no longer orbits for those used to it (a preference brings it back); Ctrl-click on a Mac (its right click) with a drag no longer orbits; Alt + drag can be taken by the desktop.
- Later: more of the mouse in Preferences (a Blender preset, middle-drag orbit) if asked.

## More information

ADR-0028 (map-style camera), ADR-0037 (orbit around the cursor), ADR-0062 (camera settings), ADR-0067 (Ctrl + drag copies).
