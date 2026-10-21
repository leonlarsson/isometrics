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

## Ideas backlog (2026-10-21)

Ideas from the owner, not designed yet. Each needs a design pass (and usually an ADR) before building. Per ADR-0019, note how each could be driven by data.

- [ ] **Switching road styles:** already possible via **Style** in the road inspector (Road / Dirt path / Hidden route). Still to do: when the width is still the old style's default, adopt the new style's default width (a hidden route turned into a road is too narrow).
- [ ] **People:** pedestrians as a part, walking along paths, pavements or hidden routes; maybe standing crowds. *Data:* crowd size or walking speed from a value (visitors, queue length).
- [ ] **Building clusters:** one object that grows with a number: more, taller or bigger buildings as the value rises (abstract; needs exploring). *Data:* naturally driven by a value, e.g. revenue or headcount per city block.
- [ ] **Multiple areas / cities (SimCity-like):** several districts or grounds in one world, maybe linked by roads, each with its own name and data. Affects the scene model (ground is a single slab today), camera framing and navigation between areas.
- [ ] **Smooth vehicle motion:** vehicles snap their heading between centre-line samples and at sharp corners. Smooth the heading (look ahead along the path or ease rotation), and make lane offsets follow corners smoothly.
- [ ] **Weather:** fog, rain, snow, maybe clouds. Scene-level setting, possibly per area. *Data:* weather from a value or a live feed.
- [ ] **Sun position and time of day:** dawn / day / dusk / night, with lamps, windows and vehicle lights switching on. *Data:* time of day could follow real time or a value.
- [ ] **More camera freedom:** the locked isometric angle shouldn't be strict. Allow a wider orbit, a perspective option, saved viewpoints, maybe follow-a-vehicle. Keep a "reset to iso" button. Revisit ADR-0004.
- [ ] **Traffic behaviour / passing:** faster vehicles currently drive through slower ones on the same road. Add following distance (slow down behind), and maybe overtaking on multi-lane roads. *Data:* traffic density or speeds from values.
- [ ] **Connected road networks (junctions):** roads that join at intersections, with vehicles routing across roads instead of staying on one. Builds on ADR-0017/0018; the current "join" merges two roads into one but doesn't create junctions.
