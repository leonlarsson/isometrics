---
status: accepted
date: 2026-10-27
---

# 0086. Objects that look the same are drawn together (automatic instancing)

## Context and problem statement

Every object is its own set of meshes, each drawn on its own, and drawn again for the shadows. On a real GPU the cost is all on the CPU, about 2.5 µs per draw: a tree is 4 draws, a house 8, an office tower 22, the race car 93. 500 trees take 5 ms a frame, 3,000 trees or 1,500 houses 46 ms (78 ms on Ultra) (measured 2026-10-27). Grounds go up to 500 per side (ADR-0049), and a library of hundreds of parts is planned, so worlds will hold far more objects than this.

## Decision drivers

- Parts stay plain React components, written as today (ADR-0043): the library is written in batches, by hand and by agents.
- Objects keep everything they do: clicks, dragging, the gizmo, labels, lights, data, driving.
- Nothing looks different.

## Considered options

1. **Automatic:** the renderer finds the meshes of different objects that are the same (the same shape, the same material) and draws each such set as one instanced mesh.
2. **Opt-in per part:** each part declares which of its pieces are instanced, and draws them through a shared instancing helper.

## Decision outcome

Chosen option: **1, automatic**, because no part has to be written for it and every part, built-in or to come, benefits.

How it works (`render/instancing.ts`, `render/InstancedParts.tsx`):

- `EntityNode` draws a part inside a group it registers. After each render of the object, its meshes are looked through: a mesh that can be shared gets a key from its geometry and its material (type, colours, roughness, flat shading, texture…). Geometries are known by their type and parameters (three's own shapes), or by the shape a part names a hand-built one by (`shareGeometryAs` in `parts/primitives`: the gable roof, `Taper`, rounded boxes, the yacht's hull); otherwise a geometry is only itself.
- A key that at least two meshes share is drawn together: its originals move to a layer cameras don't draw (`INSTANCED_ORIGINALS_LAYER`), which the pointer's raycaster tests too, so they still take clicks, hovers and drags as before. A look only one mesh has is drawn as it is (a batch of one costs the GPU more).
- Each shared look is one three.js `BatchedMesh`, with a copy of the material, drawing every original with that key where it is: their world matrices are copied in its render hooks, before each frame's shadow and main passes, so moving, driving and leaning objects need nothing more, and an original that is hidden (by itself or a parent) is hidden there too. A `BatchedMesh` rather than an `InstancedMesh`: it leaves out the instances outside each pass's camera (the view, the shadows, reflections), and takes its matrices after those hooks. An `InstancedMesh` uploads its matrices before them (a frame late) and can only be culled as a whole, which made close-ups of a world dearer on the GPU than before.
- Not shared, and drawn as before: meshes with several materials, transparent ones, instanced, skinned or morphing meshes, materials other than standard, basic and Lambert, materials or meshes with their own shader or render hooks (text), and meshes marked `userData.notInstanced`: a part that changes a mesh's material or geometry outside React (in `useFrame`) marks it so, since only its position is followed (the beacon's ring). A test checks that part files using `useFrame` say whether they need it.
- A different colour is a different material, so a set of red houses and a set of blue ones are two draws each, not one.

### Consequences

- Good: draws scale with the number of different looks, not of objects.
- Good: parts and the rest of the editor are unchanged.
- Bad: each object still costs React and its meshes' matrices are still worked out each frame (cheap next to draws), and culling each instance costs a little CPU; a later step could skip those for objects that don't move.
- Bad: on the GPU a close-up of Brightwater on Standard costs about 0.2 ms more a frame (batches read their matrices from a texture); overviews and Ultra cost the same or less.
- Bad: a part that changes its meshes outside React must remember `notInstanced`, or the change won't show.

## More information

Measurements (a temporary script on the real GPU, Windows' Chrome, a 200 × 200 ground, frame time on Standard / Ultra):

| | before | after |
|---|---|---|
| 500 trees | 5.2 / 11.3 ms | 0.8 / 1.4 ms |
| 3,000 trees | 46 / 78 ms | 4.3 / 6.1 ms |
| 1,500 houses | 46 / 77 ms | 5.4 / 6.8 ms |

Draws per 100 objects went from 400–9,300 to 2–15 for every part but the grandstand (its spectators are instanced already), the beacon (see-through ring) and text (its own shader). Follows the *Many objects* item of the TODO.
