---
status: proposed
date: 2026-10-27
---

# 0084. Render a picture: one still, drawn finer than a live view

## Context and problem statement

Ultra (ADR-0072) is a live preset: it has to keep up with every frame. A picture to share (the README gallery, a slide) can take seconds, so it can be drawn finer. The owner asked for a Render button that "cranks everything" and for rendering from in-scene cameras, as in Blender and Cinema 4D (2026-10-27).

## Considered options

1. **The same renderer, turned up, for one frame:** supersampling, every graphics setting at its best, a bigger shadow map.
2. **Path tracing** (three-gpu-pathtracer): real bounced light, but only standard materials: the water, wakes, painted lights and effects would each need rebuilding for it, and pictures take minutes on weaker machines.

## Decision outcome

Chosen option: **1**; path tracing stays in the TODO.

- **Render a picture…** (File menu, the toolbar's shading group, the phone's More menu) opens a dialog: **Camera** (the view now, or one of the world's viewpoints, its in-scene cameras; a viewpoint is jumped to, with its mood if the viewer lets viewpoints put theirs on), **Size** (the view's, Full HD, QHD, 4K, square, portrait), **Smoothing** (off, 2×, 3×), **Transparent background** and **Show the data cards** (on when the world has cards). Picking a viewpoint glides the view there, so what will be rendered shows; one deleted since is back to the view now. Opening the dialog pauses motion (closing it plays again if it was), and it has its own Play / Pause, so the moment can be picked. Render shows the picture in the dialog, with **Save the picture** (a PNG named after the world and its size).
- `render/StillRender.tsx` draws it on the live canvas: shaped like the picture for a moment (the view's area, so it frames about the same), its pixel ratio raised to the picture's width × smoothing (through the canvas's `dpr` prop, which R3F would otherwise put back), 30 frames to settle (new shaders, the bigger shadow map, the effects), taken right after a frame is drawn, then shrunk to the picture's size, halving at a time, over the backdrop behind the canvas (its colour or CSS gradient, read from the page; left out when transparent) and under the data cards. The cards are DOM over the canvas, laid out for the picture's shape by LabelProjector like any frame; `render/paintCards.ts` takes them as they are then and paints them from their computed styles (boxes, borders, corners, shadows, text in its font, the dashed leaders) at the picture's scale, so their text stays crisp. At most 36 million pixels are drawn: larger pictures are smoothed less, and the dialog says so.
- While it renders (`stillRender` in the store, runtime only) the view draws as in View mode, without gizmos, handles, grid or selection (`drawnModeOf`), without leaving Edit mode, so the selection and panels stay; wireframe is off; and the graphics are `RENDER_GRAPHICS`: Ultra with 64 real lights, foam and waves, and an 8192 shadow map.
- The kit's `Dialog` gets `confirm.keepOpen`, for an action whose result shows in the dialog.
- In perspective the sky is a dome in the scene, not a backdrop: a transparent picture leaves it out, and so does a green-screen backdrop (it's for keying the world out), live too. A colour or gradient backdrop still shows in perspective only with Show the sky in perspective off (ADR-0070).

### Consequences

- Good: pictures cleaner and sharper than any live view, of exactly what's in the world, from its own cameras.
- Bad: the canvas is resized for a moment (hidden behind the dialog); the cards are painted from their styles, so a card style the painter doesn't know (a gradient, a backdrop blur) would come out plainer; a big picture needs a capable graphics card (the pixel cap keeps it in bounds).
- Later: more frames blended for even softer shadows; path tracing.

## More information

Code: `src/render/StillRender.tsx`, `src/render/paintCards.ts`, `src/render/SkyDome.tsx`, `src/ui/RenderDialog.tsx`, `src/ui/LabelLayer.tsx`, `src/editor/graphics.ts` (`RENDER_GRAPHICS`, `TDrawnGraphics`), `src/editor/store.ts` (`stillRender`, `drawnModeOf`, `goToViewpoint`'s `instant`), `src/editor/persistence.ts` (`downloadPicture`), `src/ui/Dialog.tsx`. Related: ADR-0070, ADR-0072, ADR-0073, ADR-0078, ADR-0080.
