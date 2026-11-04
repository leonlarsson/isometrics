---
status: proposed
date: 2026-11-04
---

# 0139. A tour steps through the viewpoints on its own in View mode

## Context and problem statement

View mode steps through a world's viewpoints like slides (ADR-0039), but only by hand. A world left on a wall screen, or shown to someone who doesn't know the arrows, has only the turntable (ADR-0062) to keep it moving, and that circles one view. The viewpoints are the places worth seeing, each with a line about what its data says; they should be able to play by themselves.

## Decision drivers

- Like the turntable: View mode only, stopped by any camera input, and the world can say it starts by itself.
- Going to a viewpoint on the tour is the same as going there by hand: the same glide, and its mood (ADR-0078).
- Old worlds open as they were (ADR-0106): nothing starts that didn't.

## Considered options

1. A play button on the viewpoint bar, and a world setting `camera.tour` (`enabled`, `holdSeconds`) to start it by itself.
2. Only a world setting, started after a while without input like the turntable.
3. Only the play button, nothing saved in the world.

## Decision outcome

Chosen option: **1**: the button makes the tour discoverable in any world with viewpoints, and the setting lets a world made for a screen start it.

- **Format:** `scene.camera.tour`, `{ enabled: false, holdSeconds: 6 }` (1–600). `enabled` (ADR-0128): the tour starts by itself when the world opens in View mode (a shared link, a world opened while in View mode) or when View mode is switched on. The play button starts it in any world either way. Not a look setting, so not in moods; **Reset the camera** keeps it, like the turntable.
- **Stepping** (`editor/viewpointTour.ts`, no React): started by the button, it moves on at once, to the viewpoint after the one last gone to (or the first); started as a world opens, it holds at the view the world opened at first. Each stop lasts the glide (this browser's glide time) plus `holdSeconds`, round and round. It needs two viewpoints or more: with fewer the button is greyed out, saying so.
- **Running** (`render/ViewpointTour`, the store's runtime `runningTour`): each stop goes through `goToViewpoint`, so a viewpoint's mood comes too, as by hand. It stops on any camera input: a press or scroll on the view, a camera key, following a vehicle, the bar's arrows (or ← →), leaving View mode, or any camera request it didn't make itself (a viewpoint picked from the menu or with 1–9, re-centring, the navigation gizmo), which it notices as a flight or view request that isn't its own. Once stopped it stays stopped until played again.
- **Turntable:** waits while the tour runs; stopping the tour starts its wait again.
- **Inspector:** a **Tour** panel in the Camera tab, by the turntable's: **Start the tour in View mode** and **Holds each viewpoint for**, each with Default / Reset, and a note with **Open the Viewpoints tab** while the world has fewer than two viewpoints.

### Consequences

- Good: a world can present itself, from the viewpoints it already has; `/api/worlds/schema` describes the setting for people and AIs writing worlds.
- Bad: once stopped by input it doesn't come back after a while without input, as the turntable does; a wall screen that's touched stays still until played again.
- Still to do (TODO.md): a tour that flies to whatever crossed a threshold in the data.

## More information

Builds on ADR-0039 (viewpoints), ADR-0062 (camera settings, the turntable), ADR-0078 (moods), ADR-0128 (`enabled`). Code: `src/scene/schema.ts` (`TourSchema`), `src/editor/viewpointTour.ts`, `src/render/ViewpointTour.tsx`, `src/ui/ViewpointBar.tsx`, `src/ui/CameraTab.tsx`.
