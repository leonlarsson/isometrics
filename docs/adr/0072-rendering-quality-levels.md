---
status: proposed
date: 2026-10-26
---

# 0072. Graphics settings for the 3D view: presets with overrides, a world's sun and shade contrast, real night lights

## Context and problem statement

The 3D view looks flat. A building's shaded side is barely darker than its sunlit side (the fill lights are strong next to the sun), nothing darkens where objects meet the ground or each other (no ambient occlusion), and night lights are painted on (ADR-0052, ADR-0058): they glow but light nothing. A study with a working prototype (docs/rendering-study, the *render lab*) tried ambient occlusion, bloom, real point lights, soft shadows, environment maps, tone mappings, tilt-shift, a WebGPU renderer with TSL effects, and a path tracer, on Brightwater at noon, golden hour and night, first on a software GPU and then on a real one (an RTX 4080 SUPER, in Chrome on Windows).

The owner wants graphics to be customisable like a video game's: the app starts on today's look, and each viewer can raise the quality with a preset, with individual settings, or both.

## Decision drivers

- Worlds exist to show data (ADR-0019): depth and light should make the places with data stand out, not compete with the cards.
- Nothing changes unless someone asks for it: the default is today's look and cost, on every device, phones included (ADR-0030).
- Old worlds open as they were (ADR-0056).
- What a world looks like is the author's choice and travels with the world; how much a viewer's device draws is the viewer's choice and stays in their browser (like camera navigation, ADR-0062).
- Night lights are already a data-capable system (ADR-0058, ADR-0061); real light should come from it, not beside it.
- Keep the renderer change (WebGPU) separate from the look, so each can be judged on its own.

## Considered options

1. **Graphics settings per browser, presets with overrides, on today's WebGL renderer;** the balance of sun and shade as a world setting.
2. **Fixed quality levels** (Fast / Nice / Ultra, the study's first proposal): the light rebalanced for everyone, Nice by default on desktop.
3. **Move to WebGPU first** (`WebGPURenderer`, TSL effects: GTAO, SSGI, clustered lighting for hundreds of lights).
4. **Only rebalance the light** and keep everything else as it is.

## Decision outcome

Proposed: **1**, with WebGPU as a later, separate decision.

### Sun and shade contrast: a world setting

A new lighting field, **Sun and shade contrast** (`sunShadeContrast`, Scene → Sun & sky), sets how much stronger the sun is than the flat fill (hemisphere and ambient light). Its default is today's balance, so existing worlds look exactly as they did; raising it gives the study's stronger sun and weaker fill (`?fx=key`: sun ×1.3, fill ×0.55). It costs nothing, so it isn't a graphics setting: it's part of the world's look, saved and shared with it, and templates may set it. It applies in both themes' palettes (`scene/theme.ts`) and at every hour; its effect on moonlit nights needs checking when it's built.

### Graphics: a Preferences page

A **Graphics** page in Preferences (per browser, never saved in a world): a **Preset** and the settings it sets. Each setting follows the preset (`null`, the label row says **From preset**) until it's changed, then offers **Reset** (ADR-0027); changing the preset keeps what was changed, and the preset field says how many settings differ from it.

| Setting (key) | Standard (default) | Nice | Ultra |
|---|---|---|---|
| Ambient occlusion (`ambientOcclusion`: off, half resolution, full resolution) | off | half resolution | full resolution |
| Glow after dark (`showGlowAfterDark`: bloom, scaled by the time of day's darkness) | off | on | on |
| Real lights at night (`realLightCount`: 0, 8, 16, 32) | 0 | 16 | 32 |
| Soft shadows (`useSoftShadows`: PCSS) | off | off | on |
| Anti-aliasing (`antiAliasing`: multisample, SMAA) | multisample | SMAA | SMAA |
| Highest pixel density (`maxPixelDensity`: 1, 1.5, 2) | 2 | 2 | 2 |

**Standard** is today's renderer exactly: no effects composer is mounted, painted night lights only. The names and the exact numbers per preset are for the implementation to settle with real measurements; the rule is that Standard never changes.

### How it's drawn

- **One effects composer** (`@react-three/postprocessing` with `n8ao`), mounted only when a setting needs it. With effects on it uses SMAA, not the canvas's multisampling: on the real GPU, ambient occlusion alone on a multisampled buffer cost more than all of Nice with SMAA (4.9 against 3.0 ms at 2× density).
- **Tilt-shift** stays the camera's world setting (ADR-0062); when the composer is on it's drawn as one of its effects instead of its own pass.
- **The diorama's backdrop** (ADR-0070) is drawn in the canvas while the composer is on: effects don't keep the canvas's transparency cleanly (a light rim round the ground).
- **Real lights from the lights system** (ADR-0058): a part's light can also be a real point light, with its colour, strength, reach and on/off from `resolveLights` (so data-driven lights light their surroundings too). The renderer keeps the `realLightCount` lights nearest the view. The number of three.js lights stays fixed per setting (unused ones at zero strength, never hidden), since three rebuilds its shaders whenever the number of lights changes. The painted glow and pools stay as they are.
- **Bloom** is scaled by the time of day's darkness: in daylight it puts a halo on bright ground.

### Not now

- **A colour grade** (the lab's `?fx=grade`): on a real GPU it turns saturated colours black (the gold tower, yellow cars), which the software GPU didn't show. Revisit after tone mapping, or as a lookup table.
- **A path-traced Render button** (`three-gpu-pathtracer`): it works with the live scene, but needs the scene prepared for it (docs/rendering-study lists what). A later step.
- **WebGPU:** on real WebGPU, GTAO fails with the multisampled scene pass, a camera jump loses its zoom and projection, the post-processing pipeline turns the backdrop black, and clustered lighting lit nothing as the lab wires it, so its main reason (hundreds of lights) is unproven. Its own ADR when a feature needs it.
- **A sky environment map** (little effect on matte low-poly surfaces; revisit with shinier water and glass) and **AgX tone mapping** (the palettes are tuned for ACES).

### Cost

GPU time per frame on an RTX 4080 SUPER (WebGL timer queries, a downtown close-up, noon / 22:00):

| | 1280×800 | 1920×1080 at 2× density |
|---|---|---|
| Standard (today) | 0.4 / 0.6 ms | 0.6 / 1.0 ms |
| Nice-like (`?fx=ao,bloom,lamps,smaa`) | 1.4 / 1.7 ms | 3.0 / 4.6 ms |
| Ultra-like | 1.4 / 1.8 ms | 3.7 / 5.1 ms |

Ambient occlusion is most of it and grows with the number of pixels; 24 real lights add about 1.2 ms at night at 2×. Integrated laptop GPUs are many times slower, so Nice and Ultra stay opt-in.

### Consequences

- Good: nobody's view changes, or gets slower, unless they ask; viewers with a strong GPU get ambient occlusion and real night light; authors can give a world more contrast for everyone at no cost; data-driven lights light their surroundings.
- Bad: new dependencies (`@react-three/postprocessing`, `postprocessing`, `n8ao`; the path tracer's `three-gpu-pathtracer` and `three-mesh-bvh` only with the Render button); two drawing paths (with and without the composer) to keep looking the same; a world's look now depends a little on the viewer's settings (ambient occlusion, real lights), so the template pictures (ADR-0047) are drawn at Standard.
- Later: WebGPU (its own ADR); maybe a hint to lower the preset when frames are slow.

## More information

docs/rendering-study (findings, pictures, costs, the render lab and its switches); the prototype: `src/render/labFlags.ts`, `src/render/RenderLab.tsx`, `src/render/RenderLabGpu.tsx`, `src/lab/three-hybrid.js`, `scripts/render-lab/`. The lab is removed, or kept dev-only with its own ADR, once these features land. Related: ADR-0007, ADR-0027, ADR-0030, ADR-0047, ADR-0052, ADR-0056, ADR-0058, ADR-0061, ADR-0062, ADR-0070.
