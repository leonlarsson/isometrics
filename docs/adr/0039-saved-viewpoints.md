---
status: accepted
date: 2026-10-23
---

# 0039. Saved viewpoints are part of the world, and View mode steps through them

## Context and problem statement

Showing a world meant panning and zooming live to each place worth seeing. A presenter (or a world an AI wrote for someone) needs prepared views: "the harbour", "the stadium", each with a line about what the data there says, stepped through like slides. ADR-0003 keeps camera state out of the scene; prepared views are content, not state.

## Decision drivers

- Views travel with the world (files, templates, AI-written worlds), so they belong in the scene document.
- Readable and writable by hand or by an AI, and the same on any screen size.
- Data-first (ADR-0019): a view can carry what it's about.

## Decision outcome

- **Format:** `scene.viewpoints`, an ordered list of `{ id, name, description, target: [x, z], azimuth, elevation, span, perspective }`: what it looks at, from which compass direction (degrees, counter-clockwise from +x seen from above; the default view is 315), how high (degrees above the ground, 15–87), how many grid units fit top to bottom (so it fits any screen), and which camera. Defaults for everything but the id; repaired like the other lists (ADR-0026). The live camera position, zoom and the last viewpoint gone to stay runtime state.
- **Camera:** `goToViewpoint` switches camera type if needed (ADR-0038) and asks `CameraFlight` to glide there (0.8 s, eased, turning the short way round; spans blend in proportion). Grabbing or scrolling the scene stops a flight. `render/viewpoints.ts` turns a camera into a pose and back (unit-tested).
- **Edit mode:** a **Views** menu in the toolbar lists them (click, or keys 1–9), saves the current view and opens the Scene tab's **Viewpoints** section, where they're renamed in place, re-saved from the current view, described and deleted.
- **View mode:** the same menu and keys, plus a bar at the top with ◀ ▶ (and ←/→) stepping through them, showing each one's name and description.
- Brightwater ships with four (Overview, Downtown, Stadium, Marina), so the feature is visible and the example worlds show the format.

### Consequences

- Good: prepared tours of a world, in the file, written by people or AIs.
- Bad: no reordering yet (new views go last); a world saved before this keeps no viewpoints until some are added.

## More information

Builds on ADR-0037 (orbit) and ADR-0038 (perspective). Code: `src/scene/schema.ts` (`ViewpointSchema`), `src/render/viewpoints.ts`, `src/render/CameraFlight.tsx`, `src/ui/ViewpointsSection.tsx`, `src/ui/ViewpointsMenu.tsx`, `src/ui/ViewpointBar.tsx`.
