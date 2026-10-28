---
status: accepted
date: 2026-10-27
---

# 0091. Painting objects with a brush

## Context and problem statement

Worlds need woods, orchards, undergrowth and rocks: dozens of objects scattered naturally. Placing them one at a time is slow, and Brightwater's woods were placed by a helper in the template code (a grid, nudged and sized from a seed). People should be able to do the same in the editor.

## Decision drivers

- Fast: drag over the ground and a wood appears; drag again to thin it out.
- Natural: varied sizes and turns, never inside each other, off the roads, out of buildings, standing on raised land.
- Nothing new in the world format: painted objects are ordinary objects.
- Undo as you'd expect: one stroke, one step.

## Considered options

1. **A paint bar over the view**, opened from the toolbar (N).
2. Brush settings in a side panel.
3. Painting only from Add to scene (right-click a part → Paint with it).

And for what a stroke leaves: plain objects, or a group per stroke (groups don't exist yet).

## Decision outcome

Chosen: **a paint bar, mixes and single parts, plain objects** (the owner's choices, 2026-10-27).

- **The paint bar** (`ui/PaintBar`), along the bottom of the view, opened by the toolbar's brush button or N: Paint / Erase, the brush (a ready mix, or any part that stands still), its size (radius) and density (about how many objects per 10 square units), and how to use it. Its keys are its own while it's open: Esc, N or Done close it, X switches paint and erase, [ and ] change the size, and undo and redo still work.
- **The tool** (`render/PaintTool`) takes the left drag before the camera and the objects see it (like box select, ADR-0064); the other buttons and the wheel still move the camera. It stamps as it goes, every half a radius. Shift erases while held (paints while erasing). The brush shows as a ring on the ground: solid to paint, dashed to erase, so the two differ by shape, not colour (ADR-0089).
- **The brush** (`editor/paint`): a stamp adds as many objects as the density asks for in its circle, less those of its parts already there, so going over a spot again doesn't pile them up. Each at a free spot: inside the ground, off roads (not hidden routes), out of other objects' footprints and each other's. Parts with a size (trees, bushes) vary ±20%; every object is turned any way; on raised land it stands on top. Mixes: Mixed wood, Pine forest, Park trees, Orchard, Palms and cypresses, Bushes and grass, Rocks. The eraser takes away only what the brush paints (never a building), and nothing locked.
- **Plain objects:** each painted object is an ordinary object. A stroke is one undo step (a gesture's coalesced commit, ADR-0009). Closing the paint bar selects everything painted while it was open, so it moves or deletes as one.
- The brush's settings are remembered per browser.

### Consequences

- Good: a wood in a few strokes, in any world, with nothing new to save or repair.
- Good: the brush logic is plain functions, tested on their own.
- Bad: hundreds of painted trees are hundreds of objects in the outliner; groups (and maybe painted "fields" stored as one object) would tidy that up later.
- Bad: water isn't kept clear (the owner's choice), so painting over the bay puts trees in it.

## More information

`src/editor/paint.ts`, `src/render/PaintTool.tsx`, `src/ui/PaintBar.tsx`, the store's `painting`, `paintBrush`, `setPainting`, `paintAt`. From the TODO's *Painting objects*. Later: groups per stroke, brushes for any part with presets, painting from data (a wood's density from a value).
