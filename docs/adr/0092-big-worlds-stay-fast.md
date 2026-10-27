---
status: proposed
date: 2026-10-27
---

# 0092. Big worlds stay fast: what doesn't change costs nothing

## Context and problem statement

Painting (ADR-0091) makes worlds of thousands of objects. A painted world of 2,888 trees, logs and grass drew at 42 fps in the editor, and dragging one object in it ran at 4 fps: each frame walked every object in the scene to work out matrices that hadn't changed, copied every instance into the batches (ADR-0086), and every change to the world rebuilt every batch and rendered every object's React component, every outliner row and the whole app. Costs grew with the size of the world, not with what changed.

## Decision drivers

- A frame should cost what's moving, not what's in the world.
- A change should cost what it touches: moving one object shouldn't redraw thousands.
- Standard's look stays exactly as it was (ADR-0072); nothing in the world format changes.

## Considered options

1. Keep three's and React's defaults and limit how many objects a world can have.
2. **Do per frame and per change only what moved or changed**, and draw objects that look alike in as few draws as possible.

## Decision outcome

Chosen: **option 2**.

**Per frame (the 3D view)**
- Objects that stand still settle their matrices: worked out once per render (`settleMatrices` in `render/EntityNode`), not every frame. An object *moves* when it's driving, selected or in a selection box, or its part says `movesOnItsOwn` (parts with a `useFrame` that moves pieces of themselves: a lighthouse beam, a beacon's ring; a test checks parts using `useFrame` say so).
- The scene's own matrix walk is off (`StillScene` in `render/Viewport`): before each render, only scene children that haven't settled update theirs.
- A batch places all its instances once after it changes, then only those of moving objects. A part whose every mesh is batched hides its own group (`batchedAway`), so the renderer doesn't walk it; clicks still find it (the raycaster ignores `visible`).
- Batches are by look, not by shape: one BatchedMesh holds every shape with the same material (but for colour), data layout and shadow settings. Each instance has its own colour (the batch's material is white). A shape used 64 times or more gets its own batch, which the GPU draws more cheaply. Big batches (64+ instances) cull instance by instance; small ones are culled as a whole by their bounding sphere once their objects stand still (culling one by one re-uploads a draw list every pass).
- n8ao (ambient occlusion) only visits what's drawn when it looks for see-through things (`walkOnlyWhatIsDrawn` in `render/Effects`), not every object every frame.

**Per change (the editor)**
- Batches change only where their members changed: an object that rendered with the same meshes, looks and shapes just has its instances placed and coloured again. Batches keep their instances when refitted.
- Each object subscribes only to itself (`useEntity`, `editor/useEntity.ts`: one store subscription tells only the objects that changed). What all objects share (mode, palette, graphics, selection, roads, data) is read once in `Entities` (`render/Viewport`), which hands each `EntityNode` only what concerns it: its road, its own selected/boxed/hovered flags, the data if it follows data, the hour if it has a light on a schedule. `EntityNode` reads nothing from the store itself.
- The outliner follows a deferred copy of the world, caches each item's row while the item is the same, and draws rows in memoised chunks of 100.
- App-wide hooks (`useShortcuts` in AppShell) subscribe to exactly what they use (booleans), never to whole objects: AppShell re-rendering re-renders the whole UI.
- Selection lookups are sets cached per list (`includesItem`), not searches of the list.
- The React Compiler memoises components (ADR-0093).

### Consequences

- Good: in the 2,888-object world, an editor frame went from 23.6 ms to 3.1 ms, View on Ultra from 20 ms to 4.1 ms, and dragging an object from 283 ms a frame to 20 ms. Brightwater on Ultra went from 1,244 draws a frame to 300 (15.9 ms to 3.5 ms).
- Good: `PERFORMANCE.md` lists the findings and the rules; `scripts/bench.mjs` measures frames, draws and where the time goes.
- Bad: more to keep in mind: a part that moves itself must say `movesOnItsOwn`; a new per-object component must take its shared values as props, not subscribe; code that changes an object's matrices outside React must mark it moving.
- Bad: whole-batch culling uses a bounding sphere worked out when the batch settles; one with a moving object is always drawn.

## More information

`render/instancing.ts`, `render/InstancedParts.tsx`, `render/EntityNode.tsx`, `render/Viewport.tsx`, `render/Effects.tsx`, `editor/useEntity.ts`, `ui/Outliner.tsx`. Extends ADR-0086. Findings and how to keep things fast: `PERFORMANCE.md`.
