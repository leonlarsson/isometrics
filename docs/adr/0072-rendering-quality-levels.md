---
status: proposed
date: 2026-10-26
---

# 0072. Quality levels for the 3D view: rebalanced light, ambient occlusion, real night lights and a Render button

## Context and problem statement

The 3D view looks flat. A building's shaded side is barely darker than its sunlit side (the fill lights are strong next to the sun), nothing darkens where objects meet the ground or each other (no ambient occlusion), and night lights are painted on (ADR-0052, ADR-0058): they glow but light nothing. A study with a working prototype (docs/rendering-study, the *render lab*) tried ambient occlusion, bloom, real point lights, soft shadows, environment maps, tone mappings, tilt-shift, a WebGPU renderer with TSL effects, and a path tracer, on Brightwater at noon, golden hour and night.

## Decision drivers

- Worlds exist to show data (ADR-0019): depth and light should make the places with data stand out, not compete with the cards.
- Phones must stay smooth (ADR-0030); heavier looks are opt-in, like Blender's viewport and render modes.
- The look of existing worlds may change only on purpose, and old worlds must still open as they were (ADR-0056).
- Night lights are already a data-capable system (ADR-0058, ADR-0061); real light should come from it, not beside it.
- Keep the renderer change (WebGPU) separate from the look, so each can be judged on its own.

## Considered options

1. **Quality levels on today's WebGL renderer:** rebalance sun and fill for everyone; post-processing (ambient occlusion, night-only bloom, SMAA, tilt-shift in the same pass) and capped real point lights from the lights system at Nice and Ultra; a path-traced Render button.
2. **Move to WebGPU first** (`WebGPURenderer`, TSL effects: GTAO, SSGI, clustered lighting for hundreds of lights).
3. **Only rebalance the light** and keep everything else as it is.

## Decision outcome

Proposed: **1**, with WebGPU as a later, separate decision.

- **Light balance** (`scene/theme.ts`): a stronger sun and weaker fill in both palettes, at every level. The prototype used sun ×1.3, fill ×0.55; the real values need a design pass on both themes and a check against old worlds.
- **A Quality preference** per browser (Preferences, like the camera settings of ADR-0062), never stored in the world: **Fast** (no post-processing, painted night lights only), **Nice** (ambient occlusion with N8AO at half resolution, bloom scaled by the time of day's darkness, up to ~16 real point lights nearest the view, SMAA), **Ultra** (full-resolution ambient occlusion, soft contact shadows, more real lights, a light colour grade). Default: Nice on desktop, Fast on phones and when frames are slow.
- **One composer** (`@react-three/postprocessing` with `n8ao`) for all effects; the camera's tilt-shift (ADR-0062) moves into it instead of its own pass. The diorama's backdrop (ADR-0070) is drawn in the canvas while effects are on, since they don't keep the canvas transparent cleanly.
- **Real lights from the lights system:** a part's light can also be a real point light (its colour, strength and reach, its on/off and data from `resolveLights`); the renderer picks the nearest N for the level. The painted glow and pools stay, and are all Fast draws.
- **Render button:** a path-traced still of the current view with `three-gpu-pathtracer`, saved as a PNG. Needs the scene prepared for it (docs/rendering-study lists what).
- **Not now:** a sky environment map (little effect on matte low-poly surfaces; revisit with shinier water and glass), AgX tone mapping (the palettes are tuned for ACES), WebGPU.

### Consequences

- Good: the biggest change for the least cost comes first (light balance, ambient occlusion); night scenes light up around their lights, and data-driven lights light their surroundings too; phones keep today's cost.
- Bad: five new dependencies (`@react-three/postprocessing`, `postprocessing`, `n8ao`, `three-gpu-pathtracer`, `three-mesh-bvh`); Nice costs several times today's frame on weak GPUs; the default look of every world changes (light balance), which needs a deliberate check.
- Later: WebGPU (its own ADR) for clustered lighting, bounce light (SSGI) and voxel GI; it needs the sky dome, tilt-shift, drei `Line`, `Text` and `Grid` rewritten in TSL (docs/rendering-study lists six fixes).

## More information

docs/rendering-study (findings, pictures, costs, the render lab and its switches); the prototype: `src/render/labFlags.ts`, `src/render/RenderLab.tsx`, `src/render/RenderLabGpu.tsx`, `src/lab/three-hybrid.js`, `scripts/render-lab/`. Related: ADR-0007, ADR-0052, ADR-0058, ADR-0061, ADR-0062, ADR-0070.
