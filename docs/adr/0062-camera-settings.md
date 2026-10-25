---
status: accepted
date: 2026-10-25
---

# 0062. The camera remembers where it was per world, worlds have an opening view, and a Camera tab holds its settings

## Context and problem statement

Reloading the page or reopening a world always went back to the whole world from the default angle, so every visit started by finding your place again. A world also had no say in where it opens for others (a shared file, View mode on a wall screen). And the camera's behaviour was fixed in code: a 40° field of view, how far it zooms and tilts, how fast it turns, how smoothly it settles, how long a glide takes. The camera is runtime state (AGENTS.md), so where it is mustn't be saved in the world, but some of how it behaves belongs to the world and some to the person.

## Decision drivers

- Orbiting must never change the world: no undo steps, no autosave, no "unsaved" status, no differing files.
- A world should still open nicely for someone seeing it for the first time.
- Settings that are about the world (how it's framed and shown) travel with it; settings that are about a person's hands (speeds, inverted zoom) stay with them, in every world.
- Keyboard camera keys mustn't clash with the transform keys (G, R, S, Q/E, X/Y/Z, 1–9; ADR-0029, ADR-0039).
- Old worlds keep opening (ADR-0026, ADR-0056).

## Considered options

1. **Where the last camera lives:** per world in this browser (localStorage, keyed by the stored world's id); in the world document; or one for the whole browser.
2. **Where a world opens for others:** a viewpoint marked as the opening view; a separate start view setting; nothing.
3. **Personal settings:** a panel in a new Camera tab; a Preferences dialog; a popover by the camera buttons.
4. **Keyboard:** arrows when nothing is selected; Blender's numpad keys; both.

## Decision outcome

Chosen: **1, per world in this browser; 2, a marked viewpoint; 3, a panel in the Camera tab; 4, arrows when nothing is selected.**

- **Remembered camera** (`editor/cameraMemory.ts`, key `isometrics:camera`): world id → pose (target, azimuth, elevation, span, projection; the viewpoint pose of ADR-0039). `render/CameraMemory` stores it half a second after the camera stops moving, before another world opens and when the page closes. Opening a world (page load, File → Open, New, a copy) puts the camera there with no glide; a copy starts where the original's camera was. Deleting a world forgets its camera. Unreadable entries are dropped one by one, never migrated. A world that was never stored (the untouched starter) has no id, so its camera isn't remembered.
- **Opening view** (`scene.camera.openingViewpointId`, null = none): picked in the Viewpoints tab (*Opening view*: The whole world or a viewpoint). A world with no remembered camera in this browser opens there, and **re-centring** (the toolbar button, Home) glides there; without one both show the whole world from the default angle as before. An id no viewpoint has counts as none, and deleting the viewpoint clears it. Switching to View mode leaves the camera where it is.
- **A Camera tab** in the world's properties (ADR-0054). Its per-world panels are stored in `scene.camera` (every field with a default that keeps today's behaviour): the perspective camera's **field of view**, shown as a full-frame lens's focal length in mm with the angle it gives under it, as on a Blender camera (a viewpoint can keep its own; null = the world's; the world stores degrees), the **closest and farthest zoom** (in grid units across the view's height, the same in both cameras; the farthest is automatic from the ground's size until set), the **lowest and steepest tilt**, **keep the camera over the ground** (on, as before), a **turntable** that slowly circles the view after a few idle seconds in View mode and stops at any input, and a **tilt-shift** blur (the miniature look) shown in View mode only, with a preview switch while setting it up. Personal settings, stored per browser like the panel sizes, are in **Preferences** (File → Preferences…, and a button in the Camera tab), as Blender keeps navigation in its preferences and a camera's lens on the camera: **camera control**, Simple (stays above the world, within the world's zoom and tilt) or Free (orbit anywhere, under the ground and straight up, any zoom, like Blender); orbit and zoom speed, inverted scroll zoom, smoothing, how long a glide takes, keyboard speed, and a composition grid over the view for lining up viewpoints; its hint says these apply to every world in this browser.
- **Limits:** with Simple camera control the lowest and steepest tilt are 0°–90°; Free control has none, so a view can look up from under the ground (a viewpoint keeps the height of the point it looks at, `targetHeight`). The Camera tab's Zoom and tilt, Turntable and Tilt-shift panels start folded; its View panel holds the camera type, lens and opening view. Zoom limits and the field of view take typed values far past their sliders (sliderMin / sliderMax on the kit's SliderField).
- **Flying** (ground work for first-person): in View mode W A S D move along the ground and Q E down and up; in any mode, holding the right mouse button, they fly as in Blender's fly mode or Unreal: W and S along the view, and once a key has moved the camera the drag is mouse look, turning the camera in place with no tilt limits. A view left past the world's tilt limits stays there; orbiting only brings it back towards them. While flying nothing else moves the camera (keep-over-ground waits; the look-at point settles back onto the ground along the line of sight when the button is let go), flying speed is set when the button goes down and scrolling makes it faster or slower (kept between flights, shown in the view label). With simple camera control the keys stop the camera at the ground and the world's edges, cutting the move short.
- **Keyboard** (ADR-0016, in `useShortcuts`): with nothing selected, the arrows pan; with a selection they nudge it as before, and in View mode ←/→ still step through viewpoints. Shift+←/→ turn the view and Shift+↑/↓ tilt it, + and − zoom, Home goes back to the opening view. No new letter keys.

- **Overlays** (each set in Preferences to show Off, in Edit mode, in View mode or in both; the camera menu's ticks switch them for the mode you're in; the gizmo and the label in Edit mode by default, viewpoints in the world and the grid off; the label also fades in while moving with the keys where it isn't shown): a **navigation gizmo** in the view's top-right corner, a compass that turns and flattens with the camera (click a point to look that way, which brings it to the top; the middle to look straight down, drag to turn and tilt); a **view label** in the bottom-left corner saying what the camera shows ("Perspective · 40° · Downtown"); and **viewpoints in the world**, each drawn like a camera in Blender (a little camera with a short pyramid of what it sees and its name; click to select it, double-click to go there, right-click for its menu). They read the camera from `render/liveCamera`, written every frame, so they move without re-rendering React.

### Consequences

- Good: reloading or coming back to a world continues where you were; a shared world opens where its author meant; nothing about looking around touches the world or its history.
- Good: the world's look (field of view, tilt-shift, turntable) travels with it; personal feel follows the person.
- Bad: the remembered camera stays in one browser, so the same world on another device opens at its opening view.
- Bad: the arrows do two things (camera or nudge) depending on the selection; Escape first to move the camera with something selected.

## More information

- Builds on ADR-0028 (map-style camera), ADR-0037 (orbit around the cursor), ADR-0038 (perspective camera), ADR-0039 (saved viewpoints), ADR-0054 (properties editor).
- Code: `editor/cameraMemory.ts`, `render/CameraMemory.tsx`, `render/CameraFlight.tsx` (instant jumps wait for a camera switch to finish), `editor/fileActions.ts`.
