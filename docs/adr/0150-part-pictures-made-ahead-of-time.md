---
status: proposed
date: 2026-11-07
---

# 0150. Add to scene's part pictures are made ahead of time

## Context and problem statement

ADR-0036 draws every part's picture in the browser, from the part itself, in an offscreen canvas of its own: 115 parts and 7 fence styles, in the theme, each time the editor opens. That's a second WebGL context compiling shaders and drawing for about a minute after the editor opens, on the same GPU and main thread as the world: in Stockholm it showed as freezes of up to 170 ms (ADR-0149), and Add to scene showed colour chips until its pictures arrived. The pictures are the same for everyone, as the starters' were before ADR-0146.

## Decision drivers

- Add to scene shows its pictures at once, and the editor draws nothing for them.
- Pictures never drift from the parts: made by the code that draws them live, and a part changed since its pictures were made is caught.
- Parts are added and changed often: making them again is one command, for one part or all.
- The repository stays small.

## Considered options

1. Keep drawing live (paced and compiled alongside, ADR-0149).
2. Add to scene's pictures made ahead of time as files, by a script using the live renderer; live drawing only for what has no file.
3. The same for the parts catalogue's bigger cards in its four looks too (light and dark, by day and at night).

## Decision outcome

Chosen option: **2**. Option 3 would add about 10 MB for a page people open now and then, which draws its cards live without holding anything else up.

- **The files:** `scripts/part-pictures.mjs` opens the dev server in a browser and calls `renderAddToScenePictures` (`render/thumbnails.tsx`, the code that draws them live) for each theme, then saves `public/part-pictures/<kind>-light.webp` and `<kind>-dark.webp` (224 × 168, the tiles' 112 × 84 at 2×, transparent), a fence style's as `fence-<style>-…`: 244 files, about 1.1 MB, made in seconds on a real GPU (`node.exe` on WSL). `--only` makes some of them again.
- **What they were made from:** `src/render/partPictures.json` lists each picture with its source file (the one defining the part with `definePart`, or the fence style) and that file's hash when the pictures were made.
- **Using them:** `usePartThumbnails` gives a tile its file (`addToScenePictureOf`) and draws live (ADR-0036, unchanged) only the pictures that have none, or whose file doesn't load. Prefabs' pictures, a part's with an object's own settings and the parts catalogue's are drawn live as before.
- **Kept honest:** `render/partPictures.test.ts` fails when a part or fence style has no pictures, its files are missing, or its source file has changed since they were made, naming the command for it. AGENTS.md (*Add a part*) and the `build-a-part` skill say to run it.

### Consequences

- Good: opening the editor draws no part pictures: no second WebGL context, no shader compiles, no freezes, and Add to scene's tiles show at once.
- Good: a part's change can't leave its picture out of date unnoticed: `pnpm test` (and CI) says so.
- Bad: about 1.1 MB of pictures in the repository, made again (on a machine with a browser) whenever a part's file changes, even by a change that doesn't alter its look.
- Bad: a change to a shared kit (`primitives.tsx`, a family's kit) that alters a part's look isn't caught by the hash of the part's own file; make the family's pictures again.

## More information

ADR-0036 (part pictures drawn live), ADR-0146 (the starters' pictures made ahead of time, the same way), ADR-0149 (the hitches that showed it).
