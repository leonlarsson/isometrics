---
status: accepted
date: 2026-10-22
---

# 0030. Narrow layout: the scene keeps the screen, panels live in a bottom sheet

## Context and problem statement

On phones the inspector sat under the scene and grew to 45% of the screen when something was selected. That shrank the canvas, and the camera re-framed on every resize (ADR-0004), so the world jumped and the user's pan and zoom were lost on each tap. The Add to scene panel was hidden entirely, label cards covered most of the world, and the status banner took four lines.

## Decision drivers

- The scene is the product; on a small screen it should never be resized by a panel opening.
- Everything possible on desktop should be reachable on a phone, including adding parts.
- Selecting something must not hide it.

## Considered options

1. Keep the stacked layout and only stop the camera re-framing.
2. A bottom sheet over the scene, with the view shifted to the uncovered part.
3. Full-screen panels that replace the scene while open.

## Decision outcome

Chosen option: **2**, at the existing `max-width: 900px` breakpoint (`useNarrowLayout` mirrors it in JS):

- **Sheet over the scene:** the inspector floats over the bottom of the scene (max 55% of the screen), so the canvas keeps its size. It folds down to its tab bar when nothing is selected, opens when something is selected or a tab is picked, and has a hide/show button.
- **Add tab:** the sheet gets an **Add** tab holding the Add to scene panel. Parts are added by tapping, since dragging from the panel needs a mouse, and the grips are hidden on touch screens.
- **View offset:** the shell reports the sheet's height as `viewInset` (runtime state). The camera renders with a matching view offset (`setViewOffset`), so the uncovered part behaves like a full viewport centred on the camera target. Raycasts and label projection read the same projection.
- **Reveal the selection:** if a newly selected object would sit under the sheet, the camera glides to centre it in the visible part.
- **No re-frame on resize:** `CameraRig` frames the ground once the canvas has a size, when the ground changes and on re-centre, but no longer on every resize. This supersedes the "on resize" part of [ADR-0004](0004-react-three-fiber-orthographic-diorama.md) on every screen size.
- **Smaller extras:** phones get a one-line status banner and label cards at 80% size.

Label cards over the transform gizmo (ADR-0029) fade and let the pointer through on every screen size. The gizmo writes its screen area to the label registry and `LabelProjector` marks the cards that overlap it, so a card never hides a handle.

### Consequences

- Good: the scene never jumps; selection, panning and the gizmo work with one finger; every editor feature is reachable on a phone.
- Bad: with the sheet open, about half the screen shows the scene. The hide button and the reveal glide soften that.
- Bad: dragging parts from the panel and the keyboard transforms are desktop-only.

## More information

`src/ui/AppShell.tsx` and `AppShell.module.css` (sheet), `src/ui/useNarrowLayout.ts`, `src/render/CameraControls.tsx` (`useViewInset`, `useRevealSelection`), `src/render/CameraRig.tsx`, `src/render/labelRegistry.ts` (`gizmoArea`).
