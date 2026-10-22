---
status: accepted
date: 2026-10-23
---

# 0038. A perspective camera next to the orthographic diorama view

## Context and problem statement

ADR-0004 chose an orthographic camera for the clean diorama look. The owner wants more camera freedom, and the planned ride-along and first-person views need perspective (near things bigger, a horizon).

## Decision drivers

- Keep the diorama look as the default; perspective is an option.
- Switching mustn't jump: same place, same angle, same size on screen.
- Everything that measured the view in "orthographic zoom" (gizmo size, drag sensitivity, framing) must work in both.

## Decision outcome

- **Toggle:** **P** or the cube button in the toolbar. Runtime UI state (`perspective` in the editor store), not saved in the world; saved viewpoints can carry it later.
- **Switch:** `ProjectionSwitch` (in `render/CameraRig.tsx`) keeps the canvas's orthographic camera and one perspective camera (40° field of view), and swaps the default camera with R3F's `set`. The new camera looks at the same target from the same direction, at the distance (or zoom) that shows the target at the same scale. OrbitControls is rebuilt for the new camera, so the target is put back once it exists. CameraRig only re-frames on re-centre, F or ground changes, not on a camera swap.
- **One measure for both:** `pixelsPerUnitAt(camera, point, height)` (`render/cameraMath.ts`) replaces `camera.zoom` for the gizmo's on-screen size, lifting by dragging (gizmo, G+Y, road points) and framing. The narrow layout's view offset works with both cameras. Zoom limits: zoom 2–160 for orthographic, distance 2–400 for perspective.

### Consequences

- Good: a real 3D look on demand, with the same controls; the base for ride-along and first-person.
- Bad: snapping a dragged vehicle onto an elevated road is a little less exact in perspective (the drag's shifted ray is parallel, not from the camera); flat roads are unaffected.
- Thumbnails and the hover preview stay orthographic (their own canvases).

## More information

Amends ADR-0004 (orthographic only). Related: ADR-0037 (orbit), ADR-0030 (view offset on phones).
