---
status: proposed
date: 2026-10-28
---

# 0098. Objects stand on the ground under them

## Context and problem statement

Raised land and slopes (ADR-0096) are ground, but objects didn't know it: one dropped or dragged onto a plateau stayed at height 0, inside the hill, and had to be lifted by hand. Only painting stood things on raised land (ADR-0091). Objects can also be lifted or sunk on purpose (a floating sign, a cellar, ADR-0097), which moving them shouldn't undo.

## Decision drivers

- Dropping and dragging onto raised land or a slope just works.
- An exact move (along one axis, a typed distance) doesn't suddenly go up or down (the owner, 2026-10-28).
- A height set on purpose survives a move.
- A house moved together with the plateau it stands on stays on it.

## Considered options

1. **Snap to the ground's height on every move:** simple, but drops a lifted sign and pulls up a sunk cellar.
2. **Keep the height above the ground:** an object keeps how far above (or below) the ground it stood, wherever it goes.
3. **Store heights above the ground** in the world: would change what `elevation` means in every saved world, and areas edited later would move what stands on them, wanted or not.

## Decision outcome

Chosen option: **2**.

- The ground's height at a point is the highest top of the areas there, else 0 (`groundHeightAt` in `scene/areas`, from the same triangles the slopes are drawn with).
- An object put down without a height of its own (Add to scene, a drop on the ground, the ground's menu) stands on the ground there.
- **Placed freely, it follows the ground:** dragging it, the gizmo's square, G with no axis and nothing typed (its height step counts from the ground where it is now), Ctrl+drag and Shift+D's copies, and paste at a spot keep its height above the ground (`elevationMovedTo`, `moveEntity`'s `followGround`, `IGroupChange.followGround`).
- **Moved exactly, it keeps its height:** the gizmo's X and Z arrows, G then X or Z, a typed distance, the arrow keys, the Location field, Ctrl+D's copy a step over, and plain paste. Following the ground there felt like a side effect: dragging along one axis and suddenly going up or down.
- **Under the pointer:** dragging an object, its gizmo's square, G with no axis, dropping a part from Add to scene and painting follow the pointer on the ground as it stands (`surfaceHitOnRay` in `render/useGroundDrag`: walked down the pointer's ray from the highest the ground goes, then narrowed in where it crosses), at the height above it the object had, so it stays under the pointer over raised land instead of drifting by the height difference. Road points and area corners keep their flat planes, at their own heights.
- A group move works out each object's height above the ground when it starts, and the ground where it lands with the areas that move with it, so a house on a plateau moved with it stays on top, and a group lift raises both once.
- `elevation` keeps its meaning: height above the base ground. Editing an area doesn't move what stands on it.
- Driving and parked vehicles keep what roads give them (ADR-0018, ADR-0040).

### Consequences

- Good: objects go onto plateaus and slopes and stay on them as they move.
- Bad: reshaping or raising an area leaves what stands on it where it was (inside or floating); move the area and its objects together, or lift them, for now.
- Later: tipping an object onto its lowest corner (ADR-0097), and an object leaning with the slope it stands on.
