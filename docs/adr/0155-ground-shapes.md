---
status: proposed
date: 2026-11-08
---

# 0155. The ground's shape: any outline, rounded corners, shapes in one click, handles to drag

## Context and problem statement

The ground was a rectangle, width × depth, centred on the origin: set by typing two numbers, never by dragging, and never round, an island or a coastline. Areas could be shaped point by point with handles and the gizmo; the slab under them couldn't. The owner wants the ground as editable as an area, with shapes like a circle or a half circle and rounded corners (2026-11-08). Every world saved must look exactly as it did.

## Decision drivers

- Old worlds open and look exactly as before, drawn by the same code.
- The many places that measure the world by its width and depth (the camera, the grid, the sun's shadows, weather, where things can be placed, pictures) keep working without each learning about shapes.
- Shaping works like an area's corners: drag, select, the move gizmo, add between, double-click to remove.

## Considered options

1. **An outline on the ground** (`ground.points`, null for the rectangle) and `ground.cornerRadius`, width and depth kept as the centred size round it; handles in a shaping mode.
2. Make the ground a selectable item like an area.
3. Hide the ground and draw land as raised areas.

## Decision outcome

Chosen option: **1**. A click on the ground already means "deselect", so it can't also select the ground (2); raised areas aren't the base everything measures by (3).

- **The format:** `ground.points` (corners [x, z] round it, at least 3; null = the rectangle) and `ground.cornerRadius` (grid units, 0 by default). Width and depth stay "size along x / z", now the centred rectangle round the shape: changing the corners keeps them twice the farthest corner along each axis, and changing them (the World tab's sliders) stretches the shape to fill the new size.
- **Drawing** (`render/groundGeometry.ts`): the plain rectangle (no points, no rounding) is the same rounded box as always. A shape, or rounded corners, is its outline (`groundOutlineOf`, rounded as a road's corners are) extruded into a slab with a softened top edge, in the editor and in pictures; the grid takes the outline as its geometry, so it covers the shape only.
- **Shapes in one click** (`GROUND_SHAPES`, the World tab's Ground panel, **Shape**): Rectangle, Rounded, Circle, Half circle, Hexagon, Octagon, L shape, Island, each filling the width × depth; **Corner rounding**; **Its own** shows once it's been reshaped by hand.
- **Shape the ground** (that panel, and the ground's right-click menu): handles in the view (`render/GroundHandles.tsx`, state in `editor/groundShaping.ts`, never saved): a handle on each corner (drag; click to select, Shift- or Ctrl-click for several; the move gizmo on the selected ones; double-click, or Delete on the selected ones, removes; it keeps three), a dot between corners to add one, and on each side of the rectangle (round a shape) a size handle like an object's (ADR-0124), a ball in its axis's colour standing off the side, that resizes it, staying centred and stretching a shape. A bar says what they do, with **Done**; Esc, leaving Edit mode or selecting something else ends it. The camera doesn't re-frame for a size changed while shaping. Drags while shaping may reach past the ground's edge (up to the largest ground).
- **Kept on the shape** (`isOnGround`, `nearestOnGround`): a part dragged in from Add to scene, a dragged object (by itself or with the gizmo), road, area and fence points drawn or dragged, and the paint brush land on the ground as it's shaped: a point past its edge comes in to the nearest spot on it, and the brush paints only what's wholly on it; finding a free spot for a new part keeps to it too.
- **For people and AIs:** the guide, the world format's overview and the fields' descriptions.

### Consequences

- Good: round, island and L-shaped worlds, made in a click or dragged into shape, with no change to anything saved before.
- Bad: where the camera may look, weather and several things moved together still keep to the rectangle round the shape, so they reach past its edge; a shape can be dragged to cross itself (drawn oddly until it's untangled).
- Later: corner heights and peaks on the ground (terrain); a ground off the origin.

## More information

ADR-0021 (areas), ADR-0049 (larger grounds), ADR-0137 (surfaces), ADR-0154 (pick order, handles on top).
