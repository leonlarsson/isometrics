# TODO

Planned work that has been discussed and agreed but not built yet. Write an ADR when starting anything that changes the editing model or data format (see `docs/adr/`).

## Bugs and polish (2026-10-23)

- [ ] **Phone gestures on label cards move the page:** pinching or dragging with a finger on a label card zooms or scrolls the whole page instead of the world. Touches that start on a card should reach the camera controls (or the page should block browser zoom/scroll there), while a tap still opens the card.
- [ ] **Phone layout UI pass:** the narrow layout (ADR-0030) feels crowded. Review the toolbar, bottom sheet and bars for what can be merged, hidden behind a menu or made smaller.

## Before going public

- [ ] Remove the `noindex, nofollow` robots meta tag and the `X-Robots-Tag` header in `src/routes/__root.tsx`.
- [ ] Make `og:image` in `src/routes/__root.tsx` an absolute URL once the production domain is set (most link previews ignore relative ones), and refresh `public/og.png` if the look has changed. (Description, Open Graph, `theme-color` and favicon: done.)

## Ideas backlog (2026-10-21)

Ideas from the owner, not designed yet. Each needs a design pass (and usually an ADR) before building. Per ADR-0019, note how each could be driven by data.

- [ ] **New world flow, like Photoshop's New Document:** File → New world… opens a dialog instead of the current New empty world item and template submenu. Two ways in: **start from scratch** (name, ground size, maybe theme and driving side, with sensible defaults) or **pick a starter** (the templates as cards with their rendered pictures and a short description). Remember the last choices. *Data:* a starter could come with sample data already wired to labels, so it shows how data fits in.
- [ ] **People:** pedestrians as a part, walking along paths, pavements or hidden routes; maybe standing crowds. *Data:* crowd size or walking speed from a value (visitors, queue length).
- [ ] **Building clusters:** one object that grows with a number: more, taller or bigger buildings as the value rises (abstract; needs exploring). *Data:* naturally driven by a value, e.g. revenue or headcount per city block.
- [ ] **Multiple areas / cities (SimCity-like):** several districts or grounds in one world, maybe linked by roads, each with its own name and data. Affects the scene model (ground is a single slab today), camera framing and navigation between areas.
- [ ] **Weather:** fog, rain, snow, maybe clouds. Scene-level setting, possibly per area. *Data:* weather from a value or a live feed.
- [ ] **Sun position and time of day:** dawn / day / dusk / night, with lamps, windows and vehicle lights switching on. *Data:* time of day could follow real time or a value.
- [ ] **Lighting system:** placeable lights (street lamps, spotlights, floodlights, glowing signs) with colour, brightness and range, that light up their surroundings, especially at dusk and night (pairs with time of day above). Mind performance: many real lights are expensive in three.js, so likely a few real ones plus cheap glow/fake light pools. *Data:* a light's colour or brightness from a value (e.g. red when a threshold is crossed, brighter with more activity).
- [ ] **More camera freedom:** orbit around the cursor, a perspective view, saved viewpoints, and following or riding along with a vehicle are done (ADR-0037–0040). Still to do: a **first-person mode** to free-walk with WASD + mouse look.
- [ ] **Take control of a vehicle or person:** riding along (view only) is done (ADR-0040); next, actually drive or walk it yourself (keyboard/gamepad), leaving its road while you steer and rejoining afterwards. Needs people as a part for walking.
- [ ] **More traffic behaviour:** following and overtaking are done (ADR-0042). Still to do: multi-lane roads (two lanes per direction, passing without the oncoming lane), vehicles meeting head-on on roads without lanes (a ferry route driven both ways), and maybe a per-road "no overtaking" setting. *Data:* traffic density or speeds from values.
- [ ] **Connected road networks (junctions):** roads that join at intersections, with vehicles routing across roads instead of staying on one. Builds on ADR-0017/0018; the current "join" merges two roads into one but doesn't create junctions.
- [ ] **Area polish (ADR-0021):** an animated water surface and shoreline, holes (an island in a lake), smoother outlines, and terrain that roads and entities snap to on raised land.
- [ ] **Ground textures:** more than a flat colour for the ground and areas: grass, sand, gravel, concrete, snow…, possibly with subtle patterns (a texture or a procedural shader that fits the low-poly look). Start with a surface type for the whole ground and for zones. Paintable ground (brushing textures freely) is probably too much for now; zones with surface types cover most of it. *Data:* surface could reflect state (e.g. snow by season, a field's colour by harvest).
- [ ] **Rotation in all three axes:** objects only turn around the vertical axis (pitch exists, −60–60°, but is only set automatically on ramps). Needs a design pass and an ADR: yaw/pitch/roll in degrees in the schema (readable for people and AIs), keeping tilted objects on the ground (lift by the tilted bounding box), footprints and selection frames that assume an upright box, gizmo rings for X and Z, keyboard R with X/Y/Z axis locks and snapped turns, how it combines with a vehicle's road tilt, and where label cards anchor. A cheap first step: pitch and roll sliders in the inspector, no gizmo. *Data:* a tilt could follow a value (a gauge needle, a leaning sign).
- [ ] **Asset browser (Add to scene) feels undercooked:** tiles now show a rendered picture of each part (ADR-0036) and a hover card with a live, turning model, but there's more to do. Ideas: collapsible categories, favourites and recently used at the top, and presets/variants per part (e.g. "Tall office tower", "Red truck") so one click gives a styled object. A list/grid toggle once there are many more parts. *Data:* presets could come with a label already bound, e.g. "Warehouse with an orders card".
