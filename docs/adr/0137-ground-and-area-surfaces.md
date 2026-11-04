---
status: proposed
date: 2026-11-04
---

# 0137. Surfaces with texture: grass, sand, gravel, paving and more on the ground and areas

## Context and problem statement

The ground and every area are a flat colour (ADR-0021). Up close a lawn, a beach and a car park read only by their colour, and a big ground is an empty sheet. The owner's TODO (*Ground textures*): more than a flat colour for the ground and areas (grass, sand, gravel, concrete, snow…), subtle patterns that fit the low-poly look, a surface type for the whole ground and for areas first; brushing textures freely is too much for now.

## Decision drivers

- Every world ever saved looks exactly as it did (ADR-0106), and Standard keeps its look and cost (ADR-0072) unless the world asks for textures.
- The colours people set (by hand or from data, ADR-0060) keep working: a texture is drawn in the surface's own colour, never instead of it.
- Low-poly: soft, quiet patterns that read in the miniature, never photographic; no shimmer or moiré from afar or in the diorama's overview.
- One click to see a world textured, then fine-tuning per area; every setting with Default / Reset (ADR-0027, ADR-0105).
- Snow and rain (ADR-0102) still lie on the ground, ideally better for the texture.
- Cheap: the ground fills most of the screen.

## Considered options

**How the patterns are made**

1. **Procedural, in the shader** of the standard material (world-space noise, cells and joints), each pattern faded out where its detail gets smaller than a few pixels.
2. **Small generated textures** (a canvas or a data texture per surface, tiled): mipmaps handle distance, but tiling repeats show over a big ground, every surface needs its own texture (and a normal map for relief), and colour comes from multiplying a grey image.
3. **Image files**: against the project's no-assets style, and photographic.

**How a world asks for them**

A. **A world switch** (`surface.enabled`, ADR-0128), off by default: on, the ground draws its own surface and each area its kind's (grass → Grass, sand → Sand, plaza → Paving, raised land → Dirt), unless the area picks another.
B. **No switch: each area's surface follows its kind from now on.** Every old world's lawns and plazas would change: against the first driver.
C. **No switch, everything Plain until set one by one.** Safe, but no area follows its kind, and texturing a world is a click per area.

## Decision outcome

Chosen options: **1** and **A**.

### The format

- `surface` (the world's, `SurfaceSchema`): `enabled` (false), `patternStrength` (0–1, 0.5: the patterns as designed; 1 is twice as strong), `patternScale` (0.25–4, 1: as designed; 2 = everything twice as big).
- `ground.surface.kind` (`GroundSurfaceSchema`): `plain` (the default), `grass_01`, `sand_01`, `gravel_01`, `paving_01`, `concrete_01`, `cobbles_01`, `dirt_01` or `snow_01` (`SurfaceKindSchema`; numbered so each can get variants, like area kinds, ADR-0050).
- An area's `surface` (`AreaSurfaceSchema`): `kind` (null = its area kind's, `AREA_KINDS[kind].surface`), `patternStrength` and `patternScale` (null = the world's). An area's overrides of a world group sit in a group of the same name (as an area's `water` overrides the world's).
- Water areas are never textured (they have ripples, ADR-0075); their kind's surface is `plain`.
- All new fields have defaults that draw worlds as they were, so nothing needs repairing; `SCENE_VERSION` stays 1. Patches merge `surface` like any setting (ADR-0118).
- `scene/surfaces.ts` has the kinds (name, what each is) and `surfaceOf` / `groundSurfaceOf`, which say what's drawn: null for plain (the switch off, the kind `plain`, water), else a kind, strength and scale. No React or three.

### Drawing

- `render/surfaceShading.ts`: an addition to the standard material's shader, like the weather's (ADR-0102), installed in the same hook on `MeshStandardMaterial.prototype`. Only a material whose `userData.surface` names a kind takes it, compiled with that kind's pattern alone (`SURFACE_KIND` define); a plain one compiles exactly as before, so a world with the switch off draws with the shaders it always had, on every graphics preset. Strength and scale are uniforms (sliding them never recompiles); picking another kind gives the mesh a new material, compiled once (a few programs a world at most).
- Each pattern is a function of the point's world position on the ground (x, z), so the ground and the areas on it, and neighbouring areas of the same surface, meet without a seam. It returns a shade (around 1, multiplying the surface's colour), a warm or cool tint for some (dry patches on grass, damp ones on dirt), a slope (tilting the normal, so cobbles, gravel and sand ripples catch the sun), and how hollow the point is (the joints, the gaps between stones, ripples' troughs).
  - **Grass:** soft patches at two sizes, the lighter ones a little drier and yellower, and fine tufts.
  - **Sand:** wind ripples, gentle on one side and steeper on the other, bending and fading in and out, over soft mottling and a fine grain.
  - **Gravel:** small stones (Voronoi cells), each its own brightness, rounded, with dark gaps.
  - **Paving:** square slabs with thin joints and bevelled edges, each slab a little lighter or darker.
  - **Concrete:** large panels with joints, quiet mottling and a few faint stains.
  - **Cobbles:** rounded stones in staggered rows, each its own shade, in dark joints.
  - **Dirt:** blotchy damp and dry earth and scattered pebbles.
  - **Snow:** the colour mixed most of the way to the weather's snow white (a snowfield in the area's own tint), soft drifts lit by the sun and faint glints.
- **No shimmer:** every feature fades to its average as it gets smaller than about six pixels (`fwidth` of the position), so from afar a surface is its colour with the big patches only, and joints never alias into moiré. The pattern shows on what faces up; the ground's rounded edge and sides and raised land's cliffs stay plain.
- **Weather:** snow and wetness are worked out after the pattern, from the tilted normal, and know the hollows: thin snow lies in the joints and gaps first, and wet ground is wettest there, like puddles in the joints.
- Clay and wireframe (ADR-0080) leave patterns as they are: clay sets every material's colour, and the pattern shades that colour.
- World pictures (ADR-0047) draw the same surfaces as the view.

### Moods

Surfaces are **not** kept by moods (ADR-0078). Moods are the light and the air over a world (the time, sky, water, weather and the lens); surfaces are what it's made of, like its colours and its areas' kinds, which moods don't hold either. A mood put on doesn't turn a lawn to cobbles, and moods saved before this would otherwise switch textures off when put on (they'd get the default, off). Seasonal snow is the weather's snow cover, which moods keep, and it lies on textured ground.

### Data

A surface's colour still follows data (a district coloured by demand keeps its paving), and the weather's snow and rain from data lie on it (ADR-0019). Choosing the kind itself from a value (a field by harvest, a pitch by season) needs a binding that picks one of a list, which bindings don't have yet (they switch, scale and colour): left for later.

### The properties

- **World → Ground:** **Textured ground and areas** (the switch), then the ground's **Surface**, **Pattern strength** and **Pattern size**, each with Default and Reset.
- **Area → Look:** **Surface** (From kind while it follows its kind; Reset), **Pattern strength** and **Pattern size** (From scene; Reset). While the world's switch is off they're greyed out, with a note saying so and a **Turn on textures** button (nothing hidden that isn't available yet).

### Consequences

- Good: a world can look built rather than painted, in a click, in its own colours; old worlds and Standard are untouched; no assets, nothing to load.
- Good: the patterns are world-anchored, so an area that is moved shows the pattern under it, not moving with it (as a lawn cut from a field), and areas meet seamlessly.
- Bad: a textured surface costs a little more per pixel than a plain one (a few noise lookups, nine for gravel's cells); measured roughly in SwiftShader, whose times are only good for comparisons. The ground covers most pixels, so it's the cost to watch on phones.
- Bad: snow, sand and the other patterns are designed for colours near their area kinds' defaults; on an odd colour (a red lawn) they still shade it, but a red snowfield is pale pink.
- Bad: the shader addition is GLSL kept as strings, relying on three's `#include <normal_fragment_maps>` and `#include <project_vertex>` as the weather already does; a three update that renames them turns the patterns off (and the pictures show it).
- Later: surfaces for roads and the cliffs of raised land; a kind from data; variants (`grass_02`, a meadow with flowers); painted surfaces inside an area; a shoreline where water meets land (TODO: Area polish).

## More information

`src/scene/schema.ts` (`SurfaceKindSchema`, `SurfaceSchema`, `GroundSurfaceSchema`, `AreaSurfaceSchema`), `src/scene/surfaces.ts`, `src/scene/areas.ts` (`AREA_KINDS[…].surface`), `src/render/surfaceShading.ts`, `src/render/weatherShading.ts`, `src/render/Ground.tsx`, `src/render/AreaMesh.tsx`, `src/render/scenePictures.tsx`, `src/ui/WorldTabs.tsx`, `src/ui/AreaInspector.tsx`. Related: ADR-0021, ADR-0027, ADR-0060, ADR-0072, ADR-0078, ADR-0102, ADR-0105, ADR-0128.
