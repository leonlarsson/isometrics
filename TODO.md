# TODO

Planned work that has been discussed and agreed but not built yet. Write an ADR when starting anything that changes the editing model or data format (see `docs/adr/`).

## Before going public

- [ ] Remove the `noindex, nofollow` robots meta tag and the `X-Robots-Tag` header in `src/routes/__root.tsx`.
- [ ] Make `og:image` in `src/routes/__root.tsx` an absolute URL once the production domain is set (most link previews ignore relative ones), and refresh `public/og.png` if the look has changed. (Description, Open Graph, `theme-color` and favicon: done.)

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

- [ ] **File menu, Save as:** the File menu has New empty world, Start from a template, Open file and Save to file. Add **Save / Save as** (and recent worlds) with the save slots below.
- [ ] **Multiple save slots:** keep several worlds in the browser, each with a name and last-edited time, with open, rename, duplicate and delete. Today there's one autosaved world plus backups (ADR-0006, ADR-0020). Needs an ADR for the storage layout.
- [ ] **People:** pedestrians as a part, walking along paths, pavements or hidden routes; maybe standing crowds. *Data:* crowd size or walking speed from a value (visitors, queue length).
- [ ] **Building clusters:** one object that grows with a number: more, taller or bigger buildings as the value rises (abstract; needs exploring). *Data:* naturally driven by a value, e.g. revenue or headcount per city block.
- [ ] **Multiple areas / cities (SimCity-like):** several districts or grounds in one world, maybe linked by roads, each with its own name and data. Affects the scene model (ground is a single slab today), camera framing and navigation between areas.
- [ ] **Weather:** fog, rain, snow, maybe clouds. Scene-level setting, possibly per area. *Data:* weather from a value or a live feed.
- [ ] **Sun position and time of day:** dawn / day / dusk / night, with lamps, windows and vehicle lights switching on. *Data:* time of day could follow real time or a value.
- [ ] **More camera freedom:** the locked isometric angle shouldn't be strict. Allow a wider orbit, a perspective option, saved viewpoints, maybe follow-a-vehicle. Also a **first-person mode**: walk or drive through the world at street level, e.g. ride along in a vehicle on its road, or free-walk with WASD + mouse look. Keep a "reset to iso" button. Revisit ADR-0004.
- [ ] **Google Maps-style camera controls:** plain drag pans the map; Ctrl+drag or Shift+drag orbits (rotates and tilts) around the point under the cursor; scroll zooms towards the cursor. Mind the clashes in edit mode: dragging an object moves it, and Shift+drag on a road point raises it, so object/handle drags must win over panning.
- [ ] **Take control of a vehicle or person:** first just ride along (camera follows it, view only), then actually drive or walk it yourself (keyboard/gamepad), leaving its road while you steer and rejoining afterwards. Builds on first-person mode above; needs people as a part.
- [ ] **Traffic behaviour / passing:** faster vehicles currently drive through slower ones on the same road. Add following distance (slow down behind), and maybe overtaking on multi-lane roads. *Data:* traffic density or speeds from values.
- [ ] **Connected road networks (junctions):** roads that join at intersections, with vehicles routing across roads instead of staying on one. Builds on ADR-0017/0018; the current "join" merges two roads into one but doesn't create junctions.
- [ ] **Area polish (ADR-0021):** an animated water surface and shoreline, holes (an island in a lake), smoother outlines, and terrain that roads and entities snap to on raised land.
- [ ] **Drag from the Add to scene panel:** drag a part from the palette straight onto the scene, with a live preview of the object following the cursor (snapped to the grid) before it's dropped. Clicking to add keeps working. One undo step per drop (ADR-0009).
- [ ] **Drop a vehicle onto a road to follow it:** dragging a vehicle onto a road (an existing one in the scene, or a new one from the palette) asks whether it should follow that road's route.
- [ ] **Ground textures:** more than a flat colour for the ground and areas: grass, sand, gravel, concrete, snow…, possibly with subtle patterns (a texture or a procedural shader that fits the low-poly look). Start with a surface type for the whole ground and for zones. Paintable ground (brushing textures freely) is probably too much for now; zones with surface types cover most of it. *Data:* surface could reflect state (e.g. snow by season, a field's colour by harvest).
