---
status: accepted
date: 2026-10-22
---

# 0029. Transform gizmo and Blender-style keyboard transforms

## Context and problem statement

Objects could only be slid on the ground by dragging them (ADR-0009). Height, rotation and size were sliders in the inspector, and road point heights needed Shift+drag or the panel. Precise placement was slow, and since ADR-0028 only a selected object can be dragged at all.

## Decision drivers

- Precise moves along one axis, plus height, turning and resizing, directly in the scene.
- Fast keyboard editing for people who know Blender, without getting in the way of those who don't.
- Stay within the scene model: objects have `position` [x, z], `elevation`, `rotation` (degrees around Y) and a uniform `scale`.

## Considered options

1. drei's `PivotControls`
2. Our own gizmo with handles that match the model
3. Extend the model with per-axis scale and tilt, then use a full gizmo

## Decision outcome

Chosen option: **2**. `PivotControls` always pairs its rings and per-axis scalers, so it can't show only a vertical-axis ring and a uniform size handle. Extending the model (3) is a bigger change than the editing need justifies.

Gizmo (`src/render/TransformGizmo.tsx`), shown on the selected, unlocked object in Edit mode:

- **Handles:** arrows move along X (red), Z (blue) and up (green, the object's Lift). A square slides freely on the ground, a ring turns the object around the vertical axis, and a knob outside the ring resizes it uniformly. It is aligned with the world, the same size on screen at any zoom, and drawn on top of the scene.
- **Events:** a `GizmoFirst` event filter puts gizmo hits ahead of the surfaces behind them, since the arrows run through the object.
- **Raw values:** the gizmo only reports offsets (ground offset, lift, turn in degrees, size ratio). `src/render/transforms.ts` applies them.
- **Snapping:** positions snap to the grid, turns to 15° steps relative to the start, size to 0.05 and lift to 0.25. Alt or snapping off makes them free.
- **Road vehicles:** a vehicle following a road only gets lift, turn and size, because the road sets its position.
- **Road points:** the selected road point gets the move handles (X, Z, ground square, and up for its height).

Keyboard (`src/render/KeyboardTransform.tsx`, `src/ui/TransformBar.tsx`):

- **G R S:** with an object selected, **G** moves, **R** turns and **S** resizes, following the mouse without holding a button. On a selected road point, **G** moves it.
- **Axis lock and typed values:** while moving, **X / Y / Z** lock to an axis (Y is height). Typing a number gives an exact value: a distance, degrees or a size factor.
- **Confirm and cancel:** **Enter** or a left click confirms; **Esc** or a right click cancels.
- **Key scope:** the bar holds the keys in an exclusive hotkey scope (ADR-0016), so Backspace edits the number instead of deleting the object, and Esc cancels instead of deselecting.

History: every gizmo drag and keyboard transform is one undo step. Commits pass `{ coalesce: token, gesture: true }`, which merges however long the gesture pauses. Cancelling calls `revertTo(before)`, which restores the scene and drops the step. Esc cancels a gizmo drag too, through the store's `cancelGesture`.

### Consequences

- Good: exact placement, height, turning and size without leaving the scene. One shared apply-and-snap path for the gizmo and the keyboard.
- Good: dragging a selected object still slides it on the ground, so the simple path stays simple.
- Bad: no per-axis size or tilt. That needs a model change if it's ever wanted.
- Bad: keyboard transforms are hidden until learned. The inspector hint and the bar's key hints point to them.

## More information

Builds on [ADR-0009](0009-editor-interaction-and-history.md) (history and coalescing) and [ADR-0028](0028-map-style-camera-and-click-to-select.md) (only the selected object can be dragged). Area corners don't get a gizmo yet.
