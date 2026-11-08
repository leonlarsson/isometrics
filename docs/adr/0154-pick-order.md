---
status: proposed
date: 2026-11-07
---

# 0154. Pick order: what a click under the pointer goes to

## Context and problem statement

A click in the view went to whatever was nearest the camera there. A hidden area drawn after a park lay a hair over it and took every click on the park (the owner, editing Central Park in NYC 311, 2026-11-07), and the selected road's, area's or fence's handles inside a building or under raised land could never be grabbed. Only the move gizmo was put first (`GizmoFirst`), and nothing offered a way to reach what's under something else.

## Decision drivers

- What shows is picked before what doesn't; a handle of the selected thing is always reachable.
- Nothing new to learn for the common cases; a way to reach anything under the pointer that can be found.
- One rule for the whole view, not fixes in each part.

## Considered options

1. **A pick order** for the view's hits, a right-click list of what's under the pointer, and handles drawn on top.
2. Click again to go deeper (each click on the same spot selects the next thing under it).
3. Moving hidden areas' fills below other areas in height, and nothing else.

## Decision outcome

Chosen option: **1** (2 can come later, for speed).

- **Pick order** (`render/pickOrder.ts`): the view's event filter sorts what's under the pointer by `userData.pickOrder` (on a thing or a group it's in), nearest first among equals: the move gizmo (3), the selected thing's handles (2), everything else (0), hidden areas' fills (−1), the ground (−2). It replaces `GizmoFirst`.
- **Handles drawn on top** (`render/handleLook.tsx`): road, area and fence points, the handles that add one, peaks and gates are drawn without the depth test, just under the gizmo (`HANDLE_ORDER` 900, the gizmo's 1000), so one inside a building shows where it can be grabbed.
- **Select what's here**: a right-click in the view lets everything under the pointer add itself (in pick order) before the menu opens (`render/contextMenu.ts`); the nearest owns the menu, and when there was more than one, its first item is a submenu listing them all, each with what it is, to select one. The ground's and a viewpoint's menus stay theirs when nothing else is there.
- The guide says how.

### Consequences

- Good: a park inside a hidden district is clicked like any park; a covered handle can be seen and dragged; anything stacked can be reached from its right-click menu.
- Bad: the selected road's handles win over a small thing standing on one of its points (a car on a road point): select it from the outliner or Select what's here.
- Later: clicking again on the same spot to go deeper.

## More information

ADR-0028 (clicks select), ADR-0064 (several selected), ADR-0151 (hidden areas).
