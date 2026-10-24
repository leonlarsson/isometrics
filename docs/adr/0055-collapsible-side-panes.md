---
status: accepted
date: 2026-10-24
---

# 0055. The side panes fold to thin strips, one at a time or both at once

## Context and problem statement

In the wide layout, Add to scene (left) and the outliner with the properties (right) always took about 600px between them. When looking at a world, presenting it while still in Edit mode, or working on a small screen, there was no way to give the scene the room.

## Decision drivers

- More room for the scene in one click or one key, and the panes back just as quickly.
- Familiar: like Blender's maximise (Ctrl+Space) and the folding side bars of code editors.
- Phones already have their own sheet that hides (ADR-0030, ADR-0046).

## Considered options

1. One toggle that hides both panes completely.
2. Each pane folds to a thin strip on its own, plus a toggle for both.

## Decision outcome

Chosen option: **2**.

- **One pane:** each pane's header has a fold button at the pane's outer edge (« in Add to scene, » in the outliner; `PaneHeader`'s `fold`). Folded, it's a 36px strip (`PaneStrip`) whose open button is in exactly the same spot, so folding and opening is one place to click; it opens at the width it had.
- **Dragging, like VS Code's side bars:** dragging a pane's edge in past half its minimum width folds it, and dragging back out past that line opens it again, in the same drag without letting go; once open, the edge follows the pointer. A folded pane's edge drags it open the same way. So the drag survives the pane folding, the two side handles aren't inside the panes but sit in the shell at the panes' inner edges (`.paneEdge`), and `ResizeHandle` takes a `collapse` option.
- **Shortcuts on the folded right pane:** its strip shows the properties' rail icons (the world's tabs, then the selection's, the open one highlighted; `RailShortcuts`). Clicking one opens the pane at that tab.
- **Both:** a toolbar button (next to snapping) and **Ctrl+Space** hide both panes, or show both once both are hidden. Ctrl on every system, since Cmd+Space is the Mac's Spotlight.
- **The world stays still:** opening, folding or resizing a pane doesn't move the world on screen; that side just shows more or less of it. The diorama camera slides sideways by as much as the canvas's centre moved. The perspective camera stays put and shifts its projection sideways instead (`render/viewShift`, applied with the phone sheet's offset by `useViewOffset`), since sliding it would change what it sees; the shift goes back to 0 wherever the camera moves anyway (re-centre, framing, switching cameras, viewpoint glides, following). Resizing the window keeps the view centred, as before.
- **No jump for a frame:** React Three Fiber learns a new canvas size a frame or two late, which would leave the old picture and the label cards at the old place for those frames. `InstantResize` measures the canvas's container in a ResizeObserver (after layout, before paint), moves the camera, resizes the canvas and draws the frame right there. Per-frame code reads the canvas size from the frame (`useFrame(({ size }) => …)`), not from its last render, so a frame drawn early is right.
- **Label cards** aren't affected by the panes: they keep to the canvas and step aside only for UI floating over it (ADR-0048), so with the world still they stay where they are.
- **Memory:** per browser, with the panels' folds (`editor/panelMemory`, ids `pane:left` and `pane:right`; ADR-0054), via `editor/sidePanes`.
- **Phones:** unchanged; the sheet has its own hide button, and the panes' hide buttons don't show there.
- The resize handle's hint is now a `Tooltip` instead of a `title` attribute (ADR-0025).

### Consequences

- Good: the scene can take the whole width in Edit mode, and each pane folds on its own.
- Bad: a folded pane's tools are a click away; the strips keep them findable.

## More information

`src/editor/sidePanes.ts`, `src/ui/PaneStrip.tsx`, `src/ui/AppShell.tsx`, `src/ui/ResizeHandle.tsx`. Related: ADR-0030 (narrow layout), ADR-0054 (properties editor).
