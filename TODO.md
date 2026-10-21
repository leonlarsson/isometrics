# TODO

Planned work that has been discussed and agreed but not built yet. Write an ADR when starting anything that changes the editing model or data format (see `docs/adr/`).

## Blender-style transform gizmo

Decided with the owner (2026-10-21). This changes the editing model in ADR-0009 (grid drag + panel), so it needs a new ADR when work starts.

- [ ] **Scope:** objects and road points.
  - Selecting an object (building, vehicle, tree, …) shows a gizmo to move, rotate and scale it.
  - Selecting a road point shows a move gizmo, including an up arrow for height. Points have no rotation or scale.
- [ ] **Style: all-in-one gizmo**, with no mode switching:
  - Coloured arrows to move along X (red), Y/up (green) and Z (blue).
  - Small squares to slide on a plane.
  - Rings to rotate.
  - Handles to scale.
  - Like Blender's combined transform gizmo or Figma. Look at drei's `PivotControls` as a starting point.
- [ ] **Blender keyboard transforms.** With something selected:
  - **G** grabs (moves), **R** rotates, **S** scales.
  - While transforming: move the mouse, optionally press **X / Y / Z** to lock to an axis, or type a number for an exact value.
  - **Enter** or click confirms; **Esc** or right-click cancels.
  - Register keys through TanStack Hotkeys (ADR-0016), probably in an exclusive scope while a transform is active.
- [ ] **Keep direct drag:** dragging an object itself still slides it on the ground with grid snapping. The gizmo adds precise axis, height, rotation and scale control on top.
- [ ] Each gizmo gesture and each keyboard transform is one undo step: coalesce like other drags (ADR-0009).
- [ ] Map gizmo changes onto the scene model:
  - Objects: `position` [x, z], `elevation` (Y), `rotation` (degrees around Y), `scale` (uniform).
  - Road points: `[x, z, height]`.
  - Decide how non-uniform scale and rotation around X/Z should behave, since the model only has a uniform scale and a Y rotation.
- [ ] Update README, AGENTS.md and the ADR index; verify in the browser (see "Verifying visually" in AGENTS.md).
