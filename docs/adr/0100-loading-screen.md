---
status: proposed
date: 2026-10-28
---

# 0100. A loading screen while a world opens

## Context and problem statement

A world showed half-built while it opened: the view drew as soon as it mounted, then objects, water and effects popped in as their shaders compiled on first draw, and the effects composer's code arrived. The owner asked for a nice loading screen with the world's name instead (2026-10-28).

## Decision drivers

- Show the world only once it's ready to look at, not a moment of half a world.
- On brand, and about the world being opened: its name, its subtitle, what's being built.
- Never in the way: no blocked pointer, no lingering element, quick worlds barely show it.

## Considered options

1. **A spinner over the view until the canvas has mounted:** the popping-in comes after that.
2. **Until the world is ready to draw**: its objects mounted, the effects composer loaded when used, every shader compiled, a few frames drawn.
3. **A progress bar per step:** steps of very different and unknown lengths would make the bar lie.

## Decision outcome

Chosen option: **2**.

- **When:** the store's `openingWorld` (runtime only) is set when the app starts and whenever a world is loaded (`loadScene`: opening one, a template, a file). `render/WorldReady`, after the world's objects in the view, waits for the effects composer's code when the graphics settings use it, then for `compileAsync` (every shader of the scene, in parallel where the browser can), then three frames, and clears it with `worldShown`. However long that takes, the world shows after 8 seconds.
- **What:** `ui/LoadingScreen` covers the view (the panels stay usable) in the world's own sky or backdrop: a card with the world's title and subtitle, three blocks in the logo's colours stacking up in turn, "Building 319 objects, 8 roads and 12 areas…" and a thin running bar (busy, not a fake percentage). Without motion (reduced motion), the stack stands still and the bar breathes.
- **Leaving:** it stays at least a second, long enough for the blocks to stack up once, so a quick world doesn't just flash it (the owner, 2026-10-28). Then a short finish: the stack stands complete with a little settle, the bar fills and the line reads "Ready" (the two lines share a place, so the card keeps its size), and it fades into the world (450 ms) and leaves the page. With reduced motion it fades as soon as the world is ready, without the wait or the finish; the end-to-end tests run that way. It never takes the pointer, and says it's loading to screen readers (`role="status"`).
- End-to-end tests wait for it to go (`worldShown` in `e2e/editor.ts`) after opening the editor and loading a world.
- The logo's blue is a token now (`--brand-blue`), shared by the toolbar's mark and the blocks.

### Consequences

- Good: a world appears whole, with its name first.
- Bad: every opening shows the screen for at least about a second and a half, even when the world is quicker.
- Later: the parts catalogue's pictures could wait the same way.
