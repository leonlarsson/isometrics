---
status: accepted
date: 2026-10-26
---

# 0074. Real night lights: a part's light also lights its surroundings, the nearest ones to the view

## Context and problem statement

The lights system (ADR-0058, ADR-0061) draws every light painted on: lit panes, glowing cabins, a pool on the ground under a lamp, a beam ahead of a car. Nothing else is lit by them: the wall next to a lamp, the water round a yacht and the car passing a lit tower stay in the moonlight. ADR-0072 decided that real light comes from the lights system, the nearest N to the view per graphics setting. three.js draws point lights forward, every light on every surface it might reach, and rebuilds every material's shader when the number of lights changes, so neither "every light" nor "as many as are lit now" works.

## Decision drivers

- One source of truth: a light's colour, strength, reach and on/off (dark, schedule, driving, data) are `resolveLights`'s, so data-driven lights light their surroundings too.
- Standard stays the view as it always was (ADR-0072): nothing new mounts there.
- No shader rebuild while the view moves or the evening comes.
- Parts stay in charge of where their lights are (ADR-0058).

## Considered options

1. **A real light per lit light**, as many as there are.
2. **A fixed number of point lights, given to the lit lights nearest the view each frame**, with a part saying where each of its lights shines from.
3. **Clustered lighting** (hundreds of lights), on the WebGPU renderer only (ADR-0072 leaves WebGPU for later, and the render lab's clustered lights lit nothing as wired).

## Decision outcome

Chosen option: **2**.

- A light opts in with `realLight(props)` in the part (`parts/types.ts`): a point in the part's own space and, for lights without a reach of their own (windows, glows), how far it lights round it; beams and pools use their own reach, as set on the object. Lamps (their heads), the Light part, office towers (the Windows light, not the Screens: four sources, out on the street off each side, low enough to light the ground and the buildings across from it and only graze the tower's own wall), houses and the warehouse (in front of their windows and doors), yacht cabins, and car, van and truck headlights (ahead of the lamps) have one. A part with several lights in one place gives it to one of them; a light that shines from several places returns several sources.
- Each lit object puts a source there (`RealLightSource` in `EntityNode`), inside the object, so it moves, turns and scales with it; the sources are kept in a registry that survives hot reloads.
- `RealLights` keeps `realLightCount` point lights (a graphics setting, Real lights at night: none, 8, 16, 32 or 64; Standard none, Nice 16, Ultra 64) and each frame gives them to the lit sources nearest the middle of the view. A point light keeps its source while that is still among the nearest; one handed a new source fades it in over a quarter of a second, so lights don't pop on while panning. Unused point lights are at zero strength, never removed: the number of lights changes only with the setting.
- A real light is as bright as the light is now (its level, and for windows how many panes are lit), times a brightness per shape, reaches 2.6 times its reach, and falls off by its shape (lamps and headlights steeply, window light in a broad wash). The painted glows, pools and beams stay as they are.
- Point lights cast no shadows (six shadow maps each would be far too slow); light passes through walls, which reads as the glow of a lit street.

### Consequences

- Good: at night the streets round lit towers, the water round yachts and the road ahead of cars are lit, at every quality where it's on, from the same settings and data as the painted lights; no shader rebuilds at dusk or while panning; Standard is untouched.
- Bad: each real light costs on every surface it might reach (64 lights: about 1.3 ms more per frame on an RTX 4080 SUPER in the overview at 1600×1000); the nearest-to-the-view choice means far lights in a wide view stay painted only.
- Later: shadows for a few nearest lights, spot lights for beams; clustered lighting with WebGPU (ADR-0072).

## More information

Code: `src/render/RealLights.tsx`, `src/render/EntityNode.tsx`, `src/parts/types.ts` (`realLight`), the parts' `lights`, `src/editor/graphics.ts`, `src/ui/GraphicsPreferences.tsx`. Related: ADR-0058, ADR-0061, ADR-0072, ADR-0073.
