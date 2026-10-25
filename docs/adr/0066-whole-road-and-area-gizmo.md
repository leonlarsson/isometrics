---
status: accepted
date: 2026-10-25
---

# 0066. A selected road or area moves, turns and resizes as a whole

## Context and problem statement

A road or area could be moved as a whole only as part of a group (ADR-0064): selected on its own, it showed its point handles and nothing else, so moving a whole route meant moving every point. That was inconsistent, and hidden routes for aircraft (TODO) need to be moved and lifted in one go.

## Decision drivers

- One selection behaves the same whether it holds one thing or several.
- Editing points stays as it is (ADR-0065).

## Considered options

1. Treat a selected road or area, with none of its points selected, like a group of one: the group gizmo and keys.
2. A separate "move whole road" mode or button.

## Decision outcome

Chosen: **a group of one** (1). With a road or area selected and none of its points (`selectMovesAsGroup` in the store), the group gizmo sits at its middle, and G / R / S, the arrow keys and Q / E move, turn and resize all of it, around its middle, as one undo step (the group transforms of ADR-0064: every point moves, road widths stay). Roads also get the lift arrow; areas don't, since how high an area is, is its Raised by setting. Selecting a point (or corner) switches to editing points; Esc goes back to the whole road.

### Consequences

- Good: whole routes and areas move like objects; no new mode.
- Bad: the arrow keys now nudge a selected road instead of panning the camera (as they do for a selected object).

## More information

- Related: ADR-0018 (road heights), ADR-0064 (several things at once), ADR-0065 (several points).
