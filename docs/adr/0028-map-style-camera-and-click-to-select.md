---
status: accepted
date: 2026-10-22
---

# 0028. Map-style camera, and clicks select while drags move the camera

## Context and problem statement

Getting around the scene felt bad, and pointer gestures were ambiguous. Left-drag orbited the camera, but a press on an object selected it and started dragging it at once (ADR-0009). Roads and areas selected on press too. So orbiting or panning over a busy scene grabbed buildings, selected roads and zones, and a click that wobbled a pixel or two nudged an object a grid cell.

## Decision drivers

- Non-technical users: the camera should behave like the maps they already know.
- One rule for every pointer gesture, so nothing is selected or moved by accident.
- Precise moves come from the transform gizmo (planned), so dragging an object doesn't have to be the only way to move it.

## Considered options

1. Keep left-drag orbit; only add zoom-to-cursor and a drag threshold.
2. Map-style camera (left-drag pans, right-drag orbits), clicks select, and only the selected object can be dragged.
3. Map-style camera, and objects move only with the gizmo.

## Decision outcome

Chosen option: **2**.

Camera (`src/render/CameraControls.tsx`):

- Left-drag pans by grabbing the ground: the point under the cursor stays under it, which OrbitControls' own pan doesn't do on a tilted view.
- Right-drag, or Ctrl/Shift + left-drag (trackpads), orbits. The wheel zooms towards the cursor. Polar and zoom limits stay as in ADR-0004.
- The view's centre is kept over the ground, so the world can't be panned away. The re-centre button still resets the view.
- Touch: one finger pans, two pinch to zoom and twist to orbit.

Pointer rule (`src/lib/pointer.ts`):

- **Clicks select, never presses.** A click is a press and release that moved less than `DRAG_THRESHOLD_PX` (6 px); every scene `onClick` checks `isClick()`. A drag that started over anything is a camera move and selects nothing.
- **Only the selected object can be dragged.** A press on an unselected object goes to the camera. A selected, unlocked object moves on the ground as before (ADR-0009). Road points and area corners only exist on a selected road or area.
- A drag starts only after the pointer travels `DRAG_THRESHOLD_PX`, and an object drag grabs from that point, so a sloppy click never moves anything.
- Only a left click on nothing deselects; a right-click starts an orbit.

### Consequences

- Good: panning and orbiting over a busy scene is safe, and one rule covers objects, roads, areas and the ground.
- Good: maps-like navigation that keeps the ground under the cursor.
- Bad: moving an unselected object takes a click first, then a drag. The gizmo makes that second step the natural one.
- Bad: right-drag orbit is less discoverable than left-drag; the README lists the controls.

## More information

Supersedes the camera controls part of [ADR-0004](0004-react-three-fiber-orthographic-diorama.md) (OrbitControls with left-drag orbit) and the "pointer-down on an entity selects it" part of [ADR-0009](0009-editor-interaction-and-history.md). History and coalescing in ADR-0009 are unchanged.
