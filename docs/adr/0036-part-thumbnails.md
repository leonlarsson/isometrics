---
status: accepted
date: 2026-10-23
---

# 0036. Part thumbnails are rendered in the browser from the parts themselves

## Context and problem statement

The Add to scene panel showed each part as a name and a two-colour chip, so you couldn't see what you were about to add. Parts are procedural React Three Fiber components (ADR-0005), with no images anywhere.

## Decision drivers

- Pictures must never drift from the parts: a new or changed part should show up correctly without anyone making an image.
- Theme-aware: parts take colours from the theme palette, so light and dark look different.
- No cost to the app's start-up or the scene's frame rate.

## Considered options

1. Render thumbnails in the browser: one offscreen canvas renders every part once per theme.
2. Pre-render PNGs at build time (headless WebGL in the build) and ship them.
3. A live mini `<Canvas>` per tile.

## Decision outcome

Chosen option: **1**. `usePartThumbnails(theme)` (`src/render/thumbnails.tsx`) creates an offscreen canvas with R3F's `createRoot` (frame loop off), mounts each part in its default props and colours with the scene's lights, frames its bounding box from the scene's viewing angle, renders one frame and keeps `toDataURL()`. Parts render one at a time in idle moments and appear as they're done; then the canvas is unmounted, freeing its WebGL context. Pictures are cached in memory per theme and redone the first time the other theme is shown. Tiles show the colour chip until their picture arrives, or for good if WebGL fails. Roads and areas keep a colour sample in the same tile layout.

### Consequences

- Good: always matches the parts, in both themes, with nothing to maintain.
- Good: a few hundred milliseconds on a normal GPU, off the main path; nothing is stored.
- Bad: rendered on every page load (in memory only), and briefly uses a second WebGL context.
- Bad: very light parts (the grandstand, the yacht) have little contrast on the light tile; a soft ground shadow could help later.

## More information

ADR-0005 (procedural parts), ADR-0004 (R3F, orthographic view). Code: `src/render/thumbnails.tsx`, `src/ui/PartsPalette.tsx`.
