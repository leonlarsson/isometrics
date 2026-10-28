---
status: proposed
date: 2026-10-28
---

# 0101. Peaks inside areas: round hills and hollows

## Context and problem statement

Corners with their own heights (ADR-0096) make slopes, ramps and wedges, but heights only at the outline put a hill's top on its edge, with a cliff behind it. A round hill needs a height inside the area.

## Decision drivers

- A hill made in a few clicks, rising evenly from its edges to its top.
- The same editing as corners: a handle to drag, the green arrow, a Height field, Delete.
- Saved worlds unchanged; water stays level (ADR-0096).
- `scene/` stays free of three.js; objects stand on the same surface that's drawn (ADR-0098).

## Considered options

1. **Points inside an area with heights** (peaks), triangulated with the corners.
2. **A smooth height field** (a grid or noise) per area: rounder, but not low-poly, and much more to edit.
3. **One "hill" setting** (a dome): no control over where or how many.

## Decision outcome

Chosen option: **1**.

- An area has `peaks`: points inside it as `[x, z, lift]`, the top rising (or, negative, dipping) to its height plus the lift there, like a corner's lift; never below the ground. Default none, so worlds don't change. Water ignores them.
- **The surface** (`topSurface`, `triangulateWithPoints` in `scene/areas`): the outline is cut into triangles as before (ear clipping), then each peak is put into the triangle it's in, which splits in three, and edges are flipped where the triangle beyond would be better turned (Lawson flips, never the outline's own edges). So a peak in the middle joins every corner and the hill rises evenly to it. The drawing, `areaTopAt` (what objects and painting stand on) and `isRaised` all use it. Peaks outside the outline are left out.
- **Editing:** a round handle with a little cone on the top for each peak: drag it to move it across the ground, click to select it. A selected peak gets the move gizmo with a lift arrow, and the Peak panel in the Shape tab (position, height, delete); Delete removes it. **Add a peak** (Whole area) puts one in the area's middle (`middleOf`: its centroid, or its biggest triangle's for L and C shapes), flush with the top there (nothing changes until it's lifted), and selects it, its lift arrow ready; so do right-clicking the area (Add a peak here), double-clicking it once selected, and pressing the small triangle in the middle of each face of its top. For water they're greyed out or absent, saying why.
- Peaks move, turn, resize, copy and paste with their area, keeping their heights.

### Consequences

- Good: round hills, ridges (two or three peaks) and hollows, low-poly, with the tools corners have.
- Bad: G and the arrow keys don't move a selected peak yet (its handle and gizmo do); box selection doesn't pick peaks.
- Later: several peaks selected together; a smoother hill (more rings of points round a peak).
