---
status: proposed
date: 2026-11-08
---

# 0156. Shift + drag pans, Ctrl + drag copies

## Context and problem statement

A left drag with Shift or Ctrl orbited the view (ADR-0028, ADR-0037), except that Ctrl on a selected object dragged a copy (ADR-0067): one key, two jobs, depending on where the drag began. And there was no way to pan from a selected object: a plain drag there moves it. The owner wants one job per key, as other tools have, with defaults people know and the rest left to the viewer (2026-11-08).

## Decision drivers

- One key, one job, wherever the drag starts.
- Defaults as in the tools people come from: map-style left-drag pan and right-drag orbit (ADR-0028), Ctrl + drag to copy (Windows Explorer, ADR-0067).
- A trackpad without a right button can still orbit.
- What's a habit can be changed by the viewer (Preferences), never by the world.
- As few settings as do the job.

## Considered options

1. **Shift pans, Ctrl copies**, Shift's job in Preferences.
2. The same, and Alt + drag orbits (as in Maya and Unity), in Preferences too.
3. Middle-button drag orbits (as in Blender), the wheel the only mouse zoom.

## Decision outcome

Chosen option: **1**. Option 2 was built and taken out: the owner wasn't sold on Alt + drag doing anything, many Linux desktops take Alt + drag for moving windows, and Shift set to orbit already serves a trackpad.

- **Shift + left-drag pans** (`render/CameraControls`), from anywhere: over a selected object (which isn't grabbed), its gizmo and handles (which let any Shift press through to the camera, `shiftDragMovesView`, so it orbits there too when the preferences say Shift orbits). Shift- and Ctrl-clicks still add to the selection and take out of it.
- **Ctrl/Cmd + left-drag** drags a copy of the selection when it starts on a selected object or its gizmo (ADR-0067); anywhere else it does nothing, never moving the camera.
- **Alt + left-drag** does nothing of its own away from the selection (it pans, as a plain drag); on a selected object, its gizmo or a handle, Alt still places freely, off the grid, as before.
- **The right button orbits**, the wheel and middle button zoom, a plain left drag pans, as before.
- **Preferences → Camera → Navigation: Shift + left-drag**: Pans the view (the default), or Orbits the view (as before, and for a trackpad without a right button).
- A camera following a vehicle is taken back by a pan, Shift or not.

### Consequences

- Good: each key does one thing; panning from a selected object; Ctrl never moves the camera by surprise; one setting.
- Bad: Shift + drag no longer orbits for those used to it (the preference brings it back); Ctrl-click on a Mac (its right click) with a drag no longer orbits.
- Later: more of the mouse in Preferences (a Blender preset, middle-drag orbit) if asked.

## More information

ADR-0028 (map-style camera), ADR-0037 (orbit around the cursor), ADR-0062 (camera settings), ADR-0067 (Ctrl + drag copies), ADR-0157 (Keys and mouse).
