---
status: accepted
date: 2026-10-26
---

# 0075. Reflective water: the world mirrored in rippling water, added as reflected light

## Context and problem statement

Water is a flat, fairly matte surface (roughness 0.4). With real night lights (ADR-0074) each light makes a soft oval smear on it, which reads as neither water nor light. Real water at night shows the lights and the lit buildings round it reflected, broken by ripples into streaks. The top graphics setting should look as good as it can (ADR-0072: opt-in, cost is no argument there).

## Decision drivers

- At night the reflections of lit windows, lamps and cabins matter most, so a reflection must not be dimmed by the dark.
- No visible pattern in the ripples; they move.
- Standard and Nice cost nothing new; old worlds draw as they did.

## Considered options

1. **Screen-space reflections** in the composer: only what's on screen reflects, with gaps at the edges.
2. **A planar reflection** per flat water area (drei's `MeshReflectorMaterial`), with its shader changed.
3. **An environment map** of the sky: no buildings or lights reflected.

## Decision outcome

Chosen option: **2**.

- A graphics setting, **Water reflections** (`showWaterReflections`; Nice and Ultra on, Standard off; at first Ultra only, until the shared reflection made it cheap). With it, each flat water area in the editor's view draws with `ReflectiveWaterMaterial` (`render/Water.tsx`): the world mirrored at the water's height (one more render of the scene a frame, 512² and blurred a little, shared by every flat water area: they all lie on the ground, layers apart by under a thousandth of a unit, so the first draws it with all of them hidden and each maps it onto itself), on the water's own lit surface. Raised water and world pictures (ADR-0047) keep the plain material.
- drei's material multiplies the water's colour by the reflection, which scene lighting then dims; the shader is changed so the reflection is **added as reflected light**, by a Fresnel term on top of a base amount (`mirror`), so lights reflect at night and the water reflects more at a low angle.
- **How rippled** water is belongs to the world, like cloud cover: `water.rippleStrength` (Sky & water → Water, default 50%), and each water area can set its own (`rippleStrength`, null = the world's, From scene / Reset). 0 is mirror-calm; the strength scales how much the ripples tilt the surface and shift the reflection. The fields say ripples show where Water reflections are on, with the way to Preferences.
- **Where two water areas meet** (`waterSeams` in `scene/areas.ts`: the pieces of an area's outline with other flat water just beyond), its own ripples and reflections fade into the world's over 2 units, so neighbouring water with different settings (Lantern Bay's calm basin and its rippling bay) meets without a line; edges against land keep the area's own look.
- **Ripples** are a tiling normal map of smooth noise at four scales (sine waves interfere into a crosshatch), drifting slowly; the reflection is shifted through the same moving normals, a little (drei's shift was a twentieth of the view), so it breaks into streaks.
- **The reflection is drawn exactly as onto the canvas** (its buffer flagged as an XR target, as the composer's scene pass, ADR-0073) and decoded from sRGB in the water's shader. Drawn into a plain buffer, every material in the world switched shader programs twice a frame per water area (tone-mapped and sRGB for the view, neither for the reflection): about 4 ms of CPU per area.
- **How strongly** water mirrors the world belongs to the world too: `water.reflectionStrength` (Sky & water → Water, Reflections on the water, default 50%), and each water area can set its own. 0% shows only the ripples catching the lights (and skips drawing the mirrored world).
- **The mirror is drawn here** (`aimMirror` in `render/Water.tsx`) into drei's reflector material: drei's own component cut off what's below the water with a near plane in a form that only works for perspective cameras, which cut the whole reflection away in the diorama. The general form (row 3 of the projection = the clip plane scaled to the view's far corner, less row 4) works for both, and the mirror camera is orthographic when the view is. The Fresnel term takes the view direction as three does, the same everywhere in the diorama.
- The mirror's plane comes from the water mesh's turn, so a mirroring water area turns its mesh rather than its geometry.

### Consequences

- Good: at night lights reflect as rippled streaks and the town round the water is mirrored; by day the sky and boats are; the real lights' smears are gone where reflections are on.
- Bad: one more scene render a frame (Lantern Bay on an RTX 4080 SUPER at 1600×1000: Nice 1.8–4.0 ms a frame without reflections, 2.8–4.4 ms with; Ultra 3.1–6.4 ms; one render per water area cost 4.0–7.5 ms on Nice and 4.5–7.6 ms on Ultra); relies on two strings in drei's shader, which a drei update could change (the change does nothing then, and the pictures in `scripts/shots.mjs` would show it).

## More information

Code: `src/render/Water.tsx`, `src/render/AreaMesh.tsx`, `src/ui/WaterSettings.tsx`, `src/ui/AreaInspector.tsx`, `src/scene/schema.ts` (`WaterSchema`, an area's `rippleStrength`), `src/editor/graphics.ts`, `src/ui/GraphicsPreferences.tsx`. Related: ADR-0072, ADR-0073, ADR-0074.
