---
status: proposed
date: 2026-11-04
---

# 0142. Parts of many pieces are built as one geometry

## Context and problem statement

Drawing alike objects together (ADR-0086) made draw calls cheap, but every piece of a part is still a mesh of its own: an object, a material and a geometry in memory, a React element, a matrix to place and a batch instance to keep. A part like the old-town houses (`terraced_row_02`) is a dozen pieces a house: walls, a cornice, a roof, a gable, steps, a chimney, a door and a pane row per floor. The Stockholm template's 640 houses, plus its blocks of flats with their balconies, made 26,600 meshes: Chrome's page took about a gigabyte on SwiftShader and its JavaScript heap 760 MB, and pages were killed on a busy machine. Draw calls weren't the problem (538 a frame); the number of meshes was.

## Decision drivers

- A world of hundreds of buildings should cost what its draws cost, not a mesh per piece (PERFORMANCE.md).
- Look the same: the same shapes, colours and flat shading, by day and lit at night.
- Keep lights working as the model says (ADR-0058, ADR-0061): windows lit one by one as it gets dark, a light's settings and data (lit panes, colour, strength) still followed.
- Still batched (ADR-0086), and placed once while they stand still (ADR-0092).

## Considered options

1. **One geometry per object, built from its props, with a colour per vertex**, and a mesh for each light whose surfaces glow (the lit windows, the shop windows).
2. Instancing each piece across objects (one `InstancedMesh` per piece shape): what ADR-0086's batches already do for draws; it doesn't reduce the objects in memory.
3. A custom shader that lights windows by a per-vertex order: one mesh for everything, but a shader of its own isn't batched, and it would be a second way of drawing lights beside `lights.tsx`.

## Decision outcome

Chosen option: **1**, for parts made of many pieces that never move relative to each other.

- `parts/buildings/mergedKit.ts` (`createPieces`): boxes, roof prisms and flat panes, each placed, turned about the vertical, sized and coloured, collected into one geometry with `position`, `normal` and `color`, without faces nobody sees (box bottoms). The part draws it in a `meshStandardMaterial` with `vertexColors` and `flatShading`, its colour white, so a batch still multiplies in an instance colour and every row shares one material.
- A part builds it once per look (`useMemo` on its props, colours and the theme's glass) and disposes the old one when its look changes. A colour following data rebuilds it, as a prop does.
- **Lights stay separate meshes**, drawn with `lightEmission` as before: the windows lit now (built from the light's `litPaneShare`, so they light one by one and follow data), and the shop windows. All the dark glass is in the body; the lit panes are drawn just in front of it. A row is three meshes however many houses it has.
- Windows still light a floor of a house (a flat) at a time, as they did.

`terraced_row_02` (the Terraced houses' old-town variant) is built this way. The Stockholm template's blocks of flats are now rows of it round a courtyard too, instead of `apartment_block_01` with its balconies.

### Measured

The Stockholm template's opening view in View mode, Standard, development build, headless Chromium on SwiftShader (`e2e/debug` measurement: meshes in the scene, draw calls per frame from `__editorView.drawCalls`, the page's JavaScript heap, and the largest renderer process's memory):

| | Before | Rows merged | And blocks as rows |
|---|---|---|---|
| Meshes | 26,568 | 20,215 | 6,994 |
| Draw calls a frame | 538 | 531 | 488 |
| JavaScript heap | 759 MB | 604 MB | 378 MB |
| Renderer's memory | 1,065 MB | 924 MB | 648 MB |

On a real GPU: `node.exe scripts/bench.mjs stockholm view,view-ultra,edit`.

### Consequences

- Good: a big old town fits in memory, and loads faster (fewer elements to create and place).
- Good: the same pattern serves any part of many fixed pieces (a palace's facades, a block of flats).
- Bad: changing a setting rebuilds the row's whole geometry (small, but each row's is its own, so the batch reshapes).
- Bad: a part built this way can't use the shared pieces' geometries (`clusterPieces`); its geometry is its own, keyed by its object.
- Bad: a lit window flips by rebuilding the lit mesh (a few panes), at most once per window per dusk.

## More information

ADR-0086 (alike objects drawn together), ADR-0092 (what doesn't change costs nothing), ADR-0058 and ADR-0061 (lights, one by one). Code: `src/parts/buildings/mergedKit.ts`, `src/parts/buildings/terraced_row_02.tsx`, `cityBlock` in `src/templates/stockholm.ts`.
