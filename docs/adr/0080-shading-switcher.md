---
status: proposed
date: 2026-10-26
---

# 0080. A shading switcher in the toolbar: wireframe, Standard, Nice, Ultra

## Context and problem statement

The graphics presets (ADR-0072) live on Preferences → Graphics, three clicks away. The owner wanted to move between them as easily as Blender's viewport shading buttons (wireframe, solid, material, rendered), and asked for a wireframe view (2026-10-26).

## Decision drivers

- One click to each preset, the current one visible at a glance.
- The presets stay the one Graphics setting (no second notion of "quality").
- Wireframe: see the world's shapes, quick on any device.

## Considered options

1. **Wireframe · Standard · Nice · Ultra**, one button per preset plus wireframe.
2. **Blender's four** (wireframe, solid clay, material = Standard, rendered = Nice or Ultra).

## Decision outcome

Chosen option: **1** (the owner's choice), with one shading for Edit and View mode.

- Round buttons in the toolbar (`ui/ShadingSwitcher.tsx`): Wireframe, Standard, Nice, Ultra, and a ▾ that opens Preferences on the Graphics page (`setPreferencesOpen(true, "graphics")`). Picking a preset sets the Graphics preset (and leaves wireframe); the tooltip says when the current preset's settings were changed on the Graphics page.
- **Wireframe** is a preference of its own (`showWireframe`, per browser, off by default) on top of the preset: every standard material (what the world's parts, ground, roads and areas are drawn with) draws its triangles' edges in its own colour (`render/Wireframe.tsx`, looked for each frame and put back when it's off). The editor's gizmo, handles and lines and the painted lights keep their look. It draws as plainly as it can: Standard's graphics (no composer, so no tilt-shift either; no real lights or reflections), and the sun casts no shadows. The Graphics page still shows the preset's settings.
- Phones: the same choices as a **Shading** group in the toolbar's More menu (`ShadingMenuGroup`), where the View cluster's buttons go too.

### Consequences

- Good: a preset or wireframe is one click; the preset in use is shown in the toolbar.
- Bad: four more buttons in the toolbar; wireframe of small, round parts (trees) is dense enough to look solid.
- Later: a solid clay shading, and the overlays (compass, view label, grids) in a dropdown beside the switcher, like Blender's.

## More information

Code: `src/ui/ShadingSwitcher.tsx`, `src/render/Wireframe.tsx`, `src/editor/graphics.ts` (`drawnGraphicsOf`), `src/editor/preferences.ts` (`showWireframe`), `src/render/SceneLights.tsx` (`castsShadows`), `src/ui/SettingsDialog.tsx` (`openOnPage`), `src/ui/Icon.tsx` (the orbs). Related: ADR-0062, ADR-0072, ADR-0073.
