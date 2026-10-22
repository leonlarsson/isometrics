# TODO

Planned work that has been discussed and agreed but not built yet. Write an ADR when starting anything that changes the editing model or data format (see `docs/adr/`).

## Before going public

- [ ] Remove the `noindex, nofollow` robots meta tag and the `X-Robots-Tag` header in `src/routes/__root.tsx`.
- [ ] Make `og:image` in `src/routes/__root.tsx` an absolute URL once the production domain is set (most link previews ignore relative ones), and refresh `public/og.png` if the look has changed. (Description, Open Graph, `theme-color` and favicon: done.)

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
- [ ] **Orbit around the cursor:** right-drag orbits around the view's centre (ADR-0028); orbiting around the point under the cursor would feel more like Google Maps.
- [ ] **Take control of a vehicle or person:** first just ride along (camera follows it, view only), then actually drive or walk it yourself (keyboard/gamepad), leaving its road while you steer and rejoining afterwards. Builds on first-person mode above; needs people as a part.
- [ ] **Traffic behaviour / passing:** faster vehicles currently drive through slower ones on the same road. Add following distance (slow down behind), and maybe overtaking on multi-lane roads. *Data:* traffic density or speeds from values.
- [ ] **Connected road networks (junctions):** roads that join at intersections, with vehicles routing across roads instead of staying on one. Builds on ADR-0017/0018; the current "join" merges two roads into one but doesn't create junctions.
- [ ] **Area polish (ADR-0021):** an animated water surface and shoreline, holes (an island in a lake), smoother outlines, and terrain that roads and entities snap to on raised land.
- [ ] **Text part:** a text object in the Add to scene panel for titles, street names or signs placed in the world (e.g. flat on the ground or standing up), with font size and colour. *Data:* the text could show a value.
- [ ] **Drop a vehicle onto a road to follow it:** dragging a vehicle onto a road (an existing one in the scene, or a new one from the palette) asks whether it should follow that road's route.
- [ ] **Outliner (scene object list):** a list of everything in the scene, like Blender's outliner: entities, roads, areas and labels, with their names. Click to select (and frame on double-click or a button), double-click a name to rename it, an eye toggle to hide/show, maybe a lock to make an item unselectable, plus a search/filter and grouping by kind. Visibility and lock are document state (saved with the world, unlike selection), so they need schema fields with defaults. Ties in with multi-select later (Shift/Ctrl-click ranges) and possibly groups/folders. On phones it could live as a tab in the bottom sheet (ADR-0030). *Data:* show each item's bound value in the list, and filter to items that have data.
- [ ] **Ground textures:** more than a flat colour for the ground and areas: grass, sand, gravel, concrete, snow…, possibly with subtle patterns (a texture or a procedural shader that fits the low-poly look). Start with a surface type for the whole ground and for zones. Paintable ground (brushing textures freely) is probably too much for now; zones with surface types cover most of it. *Data:* surface could reflect state (e.g. snow by season, a field's colour by harvest).
