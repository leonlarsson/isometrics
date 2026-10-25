---
status: accepted
date: 2026-10-25
---

# 0065. Several points of a road, or corners of an area, at once; Shift no longer lifts a point

## Context and problem statement

Objects, roads and areas can be selected together (ADR-0064), but a road's points and an area's corners could only be edited one at a time: lifting a stretch of road into a bridge, or moving one side of a lake, meant moving each point. Shift+drag on a road point raised it, which predates the point gizmo and now clashes with Shift meaning "add to the selection" everywhere else.

## Decision drivers

- The same keys as for objects (ADR-0064): Shift/Ctrl-click to add or take out, B for a box.
- One gesture is one undo step (ADR-0009).
- Keep road editing simple: points belong to one road.

## Considered options

1. Several points of one road (or corners of one area) at a time.
2. Points of several roads together.

For lifting: keep Shift+drag on a point; or lift only with the gizmo's green arrow, G then Y, and the Height field.

## Decision outcome

Chosen: **points of one road or area at a time** (1), and **Shift no longer lifts**.

- **The store** keeps `selectedPointIndex` as the active point and adds `selectedPointIndices`: every selected point of the selected road (or corner of the selected area), the active one last. Setting the active point alone selects just that one, like `selectedItems`.
- **Selecting:** Shift-, Ctrl- or Cmd-click a point or corner to add it or take it out; Shift/Ctrl-drag orbits the camera, as it does over objects. While a point or corner is selected, **B** (or Shift+B) boxes that road's points or that area's corners instead of things, with the same dashed preview. Pressing on one of several selected points and letting go without moving selects just that one.
- **Moving:** dragging one of the selected points moves them all by as much (the dragged one lands on the grid), and so do G, the arrow keys and, for road points, a gizmo at their middle whose green arrow lifts them. The group stays on the ground as a whole.
- **Deleting** removes them as one step, unless a road would be left with fewer than two points or an area with fewer than three corners (then nothing goes, and a note says why).
- **The properties** show "N points selected" with Height and Width here (Mixed where they differ, ADR-0064), or "N corners selected".
- **Lifting a single point** is its gizmo's green arrow, G then Y, or the Height field.

### Consequences

- Good: one meaning for Shift; bridges and ramps can be raised in one go.
- Bad: lifting one point takes a click to select it first (the gizmo appears on it).
- Bad: points of different roads can't be moved together yet.

## More information

- Related: ADR-0018 (road heights), ADR-0021 (areas), ADR-0064 (several things at once).
- Code: `src/editor/store.ts` (`selectedPointIndices`, `togglePoint`, `selectPoints`, `removeSelectedPoints`), `src/editor/groupTransform.ts` (`pointsStart`, `transformPoints`), `src/render/RoadHandles.tsx`, `src/render/AreaHandles.tsx`, `src/render/BoxSelect.tsx`.
