---
status: accepted
date: 2026-10-25
---

# 0067. Duplicating while moving: Ctrl+drag and Shift+D

## Context and problem statement

Ctrl+D copied the selection a step over, so placing a copy meant copying, then moving it. Many tools copy while dragging with Alt+drag, but here Alt means "place freely, without snapping", and Ctrl/Shift+drag orbited the camera everywhere, even over a selected object.

## Decision drivers

- Don't take Alt from free placement.
- Keep Ctrl/Shift-click for adding to the selection (ADR-0064) and the orbit off the selection.
- A copy and its move are one undo step; cancelling leaves nothing behind.

## Considered options

1. Ctrl+drag on a selected object drags a copy (like copying in Windows Explorer).
2. Shift+D copies and picks the copy up to move with the mouse (Blender).
3. Both.

## Decision outcome

Chosen: **both** (3).

- **Ctrl+drag** (Cmd on a Mac) starting on a selected object copies the selection in place (all of it when several things are selected) and drags the copies, leaving the originals; the copy and the move are one undo step. A Ctrl-click without moving still adds to the selection or takes out, and Ctrl+drag anywhere else still orbits the camera; Shift+drag always orbits.
- **Ctrl+drag on a gizmo handle** copies too, whether it moves, lifts, turns or resizes: the group gizmo (several things, or a whole road or area) copies them in place and transforms the copies. A single object's gizmo belongs to that object, so there the dragged object moves and an identical copy stays where it was; their names are swapped so the one that moved is the one called "… copy". The result is the same. Point gizmos have nothing to copy.
- **Shift+D** copies the selection in place and starts a keyboard move (G) of the copies, with its axis locks and typed distances. Enter or a click places them, as one undo step with the copy; Esc or a right click takes the copies away again and selects the originals (the transform session carries what to go back to).
- Ctrl+D still copies a step over. The right-click menus offer Duplicate and Duplicate and move.

### Consequences

- Good: copies land where they're wanted in one gesture, by mouse or keyboard.
- Good: Ctrl means the same over the object and over its gizmo.
- Bad: Ctrl+drag over a selected object no longer orbits; orbit from elsewhere, with Shift, or with the right button.

## More information

- Related: ADR-0029 (gizmo and keyboard transforms), ADR-0064 (several things at once).
- Code: `src/editor/store.ts` (`duplicateSelected` options, `duplicateAndGrab`, `ITransformSession.undo`), `src/render/EntityNode.tsx`, `src/render/KeyboardTransform.tsx`, `src/render/TransformGizmo.tsx` (`IGizmoStartKeys`), `src/render/EntityGizmo.tsx`, `src/render/GroupGizmo.tsx`.
