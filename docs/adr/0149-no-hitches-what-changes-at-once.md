---
status: proposed
date: 2026-11-07
---

# 0149. No hitches: what changes everything at once reaches only what it concerns, spread over frames

## Context and problem statement

Big worlds ran at a smooth median but stuttered. Stockholm (1,142 objects, 781 of them rows of houses whose windows light one by one through a two-minute day) froze for 50–130 ms about once a second in a production build, and for up to a second on its tour. The frames that froze weren't drawing much: the darkness, a mood put on by a viewpoint, a click or a drag reached every object, every batch or the whole app, and the work landed in one task. ADR-0092 made a frame cost what moves and a change cost what it touches; these were changes that looked like they touched everything, and the moments that really touch everything (a whole town lighting up) had no way to spread.

## Decision drivers

- A frame over 50 ms is a visible stutter at any refresh rate: measure the worst frames on a production build at the screen's refresh, not the median in development.
- What changes with the time of day must cost what it changes: an object whose lights read the same draws nothing new.
- Nothing in the world format changes, and the world looks the same at every moment it settles on.

## Considered options

1. Keep handing the darkness and the selection to every object, and make each object's render cheaper.
2. **Hand each object only what changes its look, keep what it's drawn with the same while equal, and spread a change that does reach everything over frames.**
3. Drive lights outside React (a registry that sets materials each frame).

## Decision outcome

Chosen: **option 2**. Option 3 would move every part's lights out of the shared light model (ADR-0058) for a cost that option 2 removes.

- **The darkness each object sees.** Objects get the theme's palette and, apart, the darkness their own lights read (`darknessSeenBy` in `parts/lightModel`): the lowest step at which every light reads as it does now. Lights that come on at once see two values a day; windows that light one by one see the steps between their first and last pane; lights switched by hand, a schedule or data see none. Objects on timers see the hour their lights do (`hourSeenBy`). Roads, areas, fences and junctions use the theme's palette (a road's flow keeps the darkness for its vehicles' lights).
- **A wave of darkness.** Objects are drawn in 16 groups, each object always in the one its id hashes to, and a change of darkness reaches one group a frame (`useDarknessWave` in `render/Viewport`). A whole town lights up in a sweep of a sixth of a second at 60 Hz; a still picture settles for longer than a wave (ADR-0084), so it never catches one half done.
- **Looks that don't move batches.** A glowing surface shown only while its light is on keeps its glow either way (`glowWhileShown`), and one dark by day and lit at night is two meshes of the same shape, one shown at a time. Geometry that grows with an amount (lit panes) is built once in order and drawn by its draw range, which batches honour (`drawnCountOf`, `setDrawnCount`).
- **What concerns an object, and nothing else.** Objects learn of the selection through `useEntityFlags` (only those a change concerns are told), read r3f's camera controls only when a drag needs them (they're made afresh on a projection switch), and draw their part through a memoised `PartDrawing` with their colours, transparencies and lights kept the same objects while equal (`sameAsBefore`).
- **Pictures compiled first.** Pictures drawn off screen compile their shaders alongside the page before drawing (`takeWhenCompiled`), shader errors are checked in development only, and pictures drawn live are published every half second. Add to scene's are made ahead of time (ADR-0150).
- **Measuring.** `scripts/bench.mjs` reports hitches, has scenarios for the moments that hitched (`opening`, `tour`, `orbit`, `select`, `fresh`), `--vsync`, `--trace`, `--why` and `--save`; `VITE_BENCH=1 pnpm build` makes a production build it can measure, with source maps (never deployed).

### Consequences

- Good: in Stockholm, frames over 50 ms went from 6–10 per 15 s in every scenario to none or one (PERFORMANCE.md, findings 28–36); the lighter worlds' worst frames halved.
- Good: a change costs what it changes, also for the moments that change the most, and data that switches lights benefits the same way.
- Bad: lights don't all come on in the same frame: a dusk or a mood sweeps over the groups in a few frames.
- Bad: a per-object component must not read `palette.night` or the hour any other way, nor subscribe to r3f state that's replaced on a projection switch; the rules are in PERFORMANCE.md.
- Left: while the darkness sweeps, frames of 9–13 ms remain where lamps that stay visible change batch as their glow switches; a glow per instance inside a batch would remove them.

## More information

PERFORMANCE.md (round three, findings 28–36, and its rules); ADR-0058 (lights), ADR-0086 and ADR-0092 (batching, what doesn't change costs nothing), ADR-0093 (the React Compiler, which doesn't compile `EntityNode`).
