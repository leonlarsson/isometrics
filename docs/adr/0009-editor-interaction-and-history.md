---
status: accepted
date: 2026-10-21
---

# 0009. Editor interaction: grid drag + inspector, snapshot undo with coalescing

## Context and problem statement

The main users are non-technical. They need to move, rotate, resize and recolour things without learning 3D tools, and undo has to feel natural.

## Considered options

1. Grid drag on the ground plane + inspector panel
2. 3D transform gizmos (move/rotate/scale arrows)
3. Both

## Decision outcome

Chosen option: **grid drag + inspector**, with Edit and View modes.

- Drag: pointer-down on an entity selects it, captures the pointer and disables OrbitControls; moves raycast the ground plane (y = 0) and snap to `SNAP_STEP` (0.5). Alt drags freely, and the toolbar toggles snapping.
- Keyboard (`src/editor/useShortcuts.ts`): Q/E rotate 15° (Shift: 90°), arrow keys nudge, Ctrl+D duplicates, Del deletes, Ctrl+Z / Ctrl+Shift+Z undo and redo, Esc deselects.
- Locked entities and entities following a route can't be dragged; route followers are placed with "start point" instead.
- The inspector covers every editable field. Part-specific controls are generated from `part.fields` (ADR-0005).
- View mode hides the editing chrome. Clicking an object or card opens a detail sheet with stat tiles.

State and history (`src/editor/store.ts`, Zustand + Immer):

- All scene changes go through `commit(recipe, { coalesce?, record? })`.
- Undo/redo are snapshot stacks (structural sharing keeps them cheap, max 100).
- Commits with the same `coalesce` key within 1 s merge into one undo step, so typing, slider drags and pointer drags each undo in one go.

### Consequences

- Good: approachable; each gesture is one undo step; adding a new editable field needs no history code.
- Bad: no multi-select or vertical dragging yet (use "Lift").
