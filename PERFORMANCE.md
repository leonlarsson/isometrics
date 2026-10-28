# Performance

What makes the editor slow, what we did about it, and the rules that keep it fast. The decisions are in ADR-0086 (drawing alike objects together), ADR-0092 (what doesn't change costs nothing) and ADR-0093 (the React Compiler).

**The one rule:** a frame should cost what's moving, and a change should cost what it touches, never what's in the world. Painting (ADR-0091) makes worlds of thousands of objects; anything that runs once per object per frame, or once per object per change, will show.

## Measuring

`scripts/bench.mjs` opens the editor on a world and measures 4 seconds of frames: frame time (median and 90th percentile), the CPU time of each frame's callbacks, and draw calls per frame.

```sh
node.exe scripts/bench.mjs brightwater edit,view-ultra          # on WSL: Windows' node, the real GPU
node.exe scripts/bench.mjs my-world.json edit-drag --profile edit-drag --react
```

- **Worlds:** a template id (`brightwater`, `lantern_bay`, …) or a world file. Keep a big painted world around for this (thousands of objects); the numbers below are from one with 2,888 (1,174 tall grass, 945 logs, 328 birches, 178 pines…).
- **Runs:** `edit` or `view`, then words: a Graphics preset (`standard`, `nice`, `ultra`), `close` (a close perspective view instead of the overview), `drag` (the first object selected and moved every frame, as a drag does).
- **`--profile <run>`:** a CPU profile: self time by function, the app's own functions with what they call, and who makes React elements.
- **`--react`:** which components rendered again, by time, and for the top-level ones which hook changed. The fastest way to find a component that re-renders for nothing.
- **`--passes`:** one frame's draws by framebuffer (shadow map, reflections, the view, effects).
- The dev server runs React's development build, which is several times slower than a build: compare runs with each other (before and after a change), not with a budget. Without `node.exe` on WSL, Chromium uses SwiftShader and the times mean nothing.
- `scripts/shots.mjs` measures GPU time per frame (timer queries) for the look of the view (ADR-0072).

## Results

Windows Chrome on the real GPU, React's development build, overview camera.

| | Before | After |
|---|---|---|
| 2,888 objects, Edit, Standard | 23.6 ms (42 fps) | 3.1 ms |
| 2,888 objects, View, Standard | 19 ms | 3.8 ms |
| 2,888 objects, View, Ultra | 20 ms | 4.1 ms |
| 2,888 objects, dragging an object | 283 ms (4 fps) | 20 ms |
| Brightwater, Edit, Standard | 4.7 ms, 656 draws | 1.7 ms, 146 draws |
| Brightwater, View, Ultra | 15.9 ms, 1,244 draws | 3.5 ms, 300 draws |
| Brightwater, dragging an object | 46 ms | 11 ms |
| Lantern Bay, Edit, Standard | 5.6 ms | 1.5 ms |
| Lantern Bay, View, Ultra | 10.8 ms | 2.3 ms |

A drag's time is mostly React's development build rendering the properties of the dragged object; a production build is several times faster.

## Findings, and what we did

### Per frame: the 3D view

1. **three walks every object every frame to work out world matrices.** `scene.updateMatrixWorld()` recurses through every node, and each object's `updateMatrix()` forces all its children to recompute. A painted world is tens of thousands of nodes. *Now:* objects that stand still settle their matrices once per render (`settleMatrices`, `render/EntityNode`) and the scene's own walk is off (`StillScene`, `render/Viewport`): before each render only children that haven't settled update.
2. **Batches copied every instance's matrix every frame.** *Now:* a batch places all its instances once after it changes, then only those of moving objects (driving, selected, boxed, or a part with `movesOnItsOwn`).
3. **Hidden originals were still walked.** The originals of batched meshes sit on a layer cameras don't draw, but the renderer still walked into them. *Now:* a part whose every mesh is batched hides its group (`batchedAway`). Clicks still find it: the raycaster tests layers, not `visible`.
4. **Draw calls are the CPU's main cost per pass.** Every pass (shadow map, reflections, the view) costs a few microseconds per draw. Batches were by shape and colour: two trees of different green, or a box and a cylinder of the same paint, were separate draws. *Now:* a batch holds every shape with the same material and data layout, and each instance has its own colour (the batch's material is white; the shader multiplies). Brightwater went from 656 draws to 146.
5. **…but one batch of many shapes can be slower than several of one shape** when there are thousands of instances (the driver handles each shape's range). *Now:* a shape used 64 times or more gets a batch of its own (`OWN_BATCH_FROM`).
6. **Culling every instance re-uploads a draw list every pass.** BatchedMesh's per-instance culling rewrites and uploads its index texture for each pass of each frame. That's worth it for many instances spread over the world, not for a few. *Now:* batches of 64+ instances cull one by one; smaller ones are culled as a whole by a bounding sphere once their objects stand still. three culls before render hooks run, so a batch with a moving or changed instance is always drawn until it's placed.
7. **Sorting instances isn't worth it for opaque batches.** *Now:* `sortObjects = false`.
8. **n8ao (ambient occlusion) walks the whole scene every frame** to look for see-through materials, and four more times to hide and show objects around its transparency passes. *Now:* it visits only what's drawn (`walkOnlyWhatIsDrawn`, `render/Effects`).
9. **Labels:** the label projector stops early when there are no cards.

### Per change: the editor

10. **Every object rendering rebuilt every batch.** A drag renders the dragged object every frame; that deleted and re-added every instance in the world. *Now:* if the objects that rendered still have the same meshes, looks and shapes, only their instances are placed and coloured again. A batch whose members changed keeps its instances and only reshapes them (adding instances one by one sorts the free list every time). Shape keys are cached per geometry.
11. **Every object subscribed to the store a dozen times.** zustand runs every subscriber's selector on every change, and React checks each one. With 2,888 objects that was about 55,000 selector runs per change, even for a change to one object. *Now:* `EntityNode` reads nothing from the store. `Entities` (`render/Viewport`) reads what all objects share once (mode, palette, graphics, selection, roads, data). `EntityById` gets its object through `useEntity` (`editor/useEntity.ts`: one subscription that tells only the objects that changed) and hands the node only what concerns it: its road, its own flags, the data if it follows data. Objects with scheduled lights alone follow the hour (`EntityWithHour`).
12. **The world's list re-rendered on every change.** Mapping 2,888 objects to elements took most of a drag frame. *Now:* the list renders only when objects are added or removed.
13. **An app-wide hook subscribed to the selected object.** `useShortcuts` (in `AppShell`) read the selected object, so every move of it re-rendered the whole UI. *Now:* it subscribes to booleans (selected, locked, follows a route).
14. **The outliner rebuilt every row on every change**, working out every object's swatch colours. *Now:* rows are cached per object (while the object, palette and data are the same). The outliner follows a deferred copy of the world (React draws it when there's time). Rows are drawn in memoised chunks of 100.
15. **Selection lookups searched the selection** (`selectedItems.some(…)`), per object, per change: objects × selection after painting. *Now:* `includesItem` uses a set cached per list.
16. **Components re-rendered with nothing new** (tab rails, tooltips, icons under a parent that rendered). *Now:* the React Compiler memoises components and hooks (ADR-0093).
17. **Part names were worked out over the whole parts list per call.** *Now:* cached.

### Per switch: the camera

18. **Switching projection rebuilt the effects composer.** Going between the diorama and perspective (a viewpoint of each, P) swaps the camera object, and `render/Effects` made its composer again for it: about twenty buffers allocated and a dozen post-processing shaders compiled, which froze the view for about half a second on Nice and Ultra (Lantern Bay's Overview is the one orthographic viewpoint among perspective ones). *Now:* the composer stays and is pointed at the new camera (`aimAt`: `setMainCamera`, and n8ao's own camera). n8ao builds its three shaders for one projection (an ORTHO define) and disposes them when it rebuilds, so the shaders built for each projection are kept and put back on a switch (`keepShadersForBothProjections`): after the first switch each way, a switch compiles and allocates nothing. Measured in headless Chromium by counting `linkProgram`, `createFramebuffer` and `texImage2D` calls per viewpoint switch.
19. **The lights came and went with the dark.** What a light draws (lit windows, a lamp's pool, headlight beams, a lens's glow) was mounted only while the light was on, so a mood with a later hour (a viewpoint wearing one, Lantern Bay's Harbour lanes to The pier) mounted them all again: three compiles a material's shader on its first draw and deletes the program when its last material is disposed, so each night compiled 5–9 shaders, cloned about 50 window textures and uploaded 300–470 geometries again, on Standard too. *Now:* they stay mounted and are hidden with `visible` while off (`parts/lights.tsx`, and the lighthouse's beam); after the first night, a switch compiles nothing (it still clones the window masks of lights whose lit panes changed with the dark, a couple of MB of small textures). A hidden mesh costs the renderer one check a frame.

## Rules

**3D view**
- Don't do per-frame work per object. A `useFrame` in a per-object component runs thousands of times a frame; return early when there's nothing to do, and prefer one `useFrame` that loops over a registry (as traffic does).
- A part whose `useFrame` moves pieces of itself says `movesOnItsOwn: true`; one that changes a material or geometry marks that mesh `notInstanced` (tests check both).
- Code that moves an object's group outside React (not through the store) must make it count as moving, or its matrices stay where they were.
- Don't walk the scene each frame (`scene.traverse`). If you must, `traverseVisible`, and skip groups marked `batchedAway`.
- Draws cost CPU per pass: Ultra draws the scene three times (shadows, reflections, the view). Before adding a mesh per object, ask whether it batches (a shared material, three's own geometry or `shareGeometryAs`, no transparency).
- Keep Standard's cost as it is (ADR-0072); measure new effects with `scripts/shots.mjs`.
- Never key a composer, pass, render target or shader on the camera object: it changes on every switch between the diorama and perspective. Point what exists at the new camera (`aimAt` in `render/Effects`), and remember that three compiles a material's shader on its first draw and deletes the program when its last material is disposed, so a mesh or pass that comes and goes compiles again each time it comes back.

**React and the store**
- A component drawn per object (thousands of times) must not subscribe to the store. Take what it needs as props from one parent that reads it once, and pass each instance only what concerns it, so `memo` can skip the rest. For the object itself, `useEntity(id)`.
- Subscribe to the smallest value that decides the render (a boolean, an id), never to a whole object or list when you only need one fact about it. This matters most high up the tree: `AppShell`, `Viewport` and app-wide hooks re-render everything under them.
- Selectors run on every change to the store: keep them O(1). Look things up in sets or maps cached per list (`includesItem`, `useEntity`), never `find`/`some` over a list inside a selector that runs per object.
- Long lists (outliner, catalogues): cache each row's data per item, memoise rows (or chunks of rows), and let them lag behind fast changes with `useDeferredValue`.
- Lists in the store are replaced, never changed in place: caches keyed by a list (a `WeakMap`) rely on it.
- Use `--react` in the bench to find what re-renders and why before memoising by hand; the compiler already memoises most components.
- **React Compiler trap:** it treats a module's variables as unchanging inside components and hooks, effects and handlers included. Code there that keeps a module variable's value, changes the variable, then uses what it kept can be compiled to use the changed variable instead (the Render a picture dialog waited forever). Change module state in a plain function outside components (`settle` in `render/StillRender`), and check the compiled output (`curl localhost:3000/src/…`) when in doubt.
- **React Compiler trap, values from the store:** it treats what a component works out by calling a function that reads the store itself (`useEditor.getState()`, `pointsStart()`, `groupStart()`) as never changing, and caches what's built from it by the component's other values only: the area and road gizmos stayed where a drag began along the ground (they followed a lift, which changed a prop they also used). Work such values out from what the component subscribes to, through a plain function of them (`pointsStartOf`, `groupStartOf` in `editor/groupTransform`).
