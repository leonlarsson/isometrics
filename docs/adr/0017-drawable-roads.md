---
status: accepted
date: 2026-10-21
---

# 0017. Drawable roads, which double as vehicle routes

## Context and problem statement

Roads were a straight "road" part that you rotated and lined up by hand, so curves were impossible. Vehicle routes were a separate, invisible `paths` list edited as typed point coordinates, so a van's route had nothing to do with the road it appeared to drive on.

## Decision drivers

- Non-technical users must be able to build curved road networks.
- Vehicles should drive on roads without a second concept to manage.
- Invisible routes (e.g. a forklift across a yard) are still needed.

## Considered options

1. **Drawable roads**: click points on the ground, corners rounded automatically; every road is a route.
2. Road piece kit (straight, curve, junction pieces that snap together like a toy train set).
3. Minimal: add a bend angle to the straight road part.

## Decision outcome

Chosen option: **drawable roads**.

- The scene has `roads` (replacing `paths` and the "road" part), each with `points`, `closed`, `width`, `cornerRadius`, `style` (`asphalt` | `dirt` | `hidden`), `markings` and `color`. The scene also has `driving: "right" | "left"`.
- Geometry lives in `src/scene/roads.ts` (pure, unit-tested). The rounded centre line replaces each corner with a quadratic curve of radius ≤ `cornerRadius`, clamped to half of each adjacent segment. The ribbon mesh, dashed markings and vehicle routes all derive from that centre line. Ribbon triangles are always wound to face up, whatever direction the road was drawn in.
- Vehicles: `follow.roadId`. They sample the rounded centre line and drive offset into a lane (`laneOffset`, right or left from `scene.driving`). On open roads they ping-pong and switch lanes on the way back. Hidden routes have no lanes.
- Rendering (`src/render/RoadMesh.tsx`): each road sits slightly above the previous one so junctions don't z-fight. Hidden roads only appear in Edit mode (dashed line plus an invisible clickable band).
- Editing:
  - **Draw:** Add to scene → Roads → Road / Dirt path / Hidden route, then click points on the ground. Enter or double-click finishes, clicking the first point closes a loop, Backspace removes the last point, and Esc cancels. Drawing state is UI-only (`drawing` in the store), and its hotkeys run in an exclusive TanStack Hotkeys scope (`src/ui/DrawingBar.tsx`).
  - **Reshape:** select a road to get point handles. Drag a handle to move it, drag the small dot between two points to insert one, and double-click a handle to remove it. Each gesture is one undo step.
  - **Inspector:** name, style, width, "Curves" (corner radius), loop, surface colour, centre line, delete.
  - Deleting a road parks the vehicles that drove on it.

**Versioning:** the app is unreleased, so this changed the schema in place without bumping `SCENE_VERSION` or adding a migration. Old browser saves fail validation and fall back to the template. Once scenes exist in the wild, breaking changes must bump the version and migrate (ADR-0003).

### Consequences

- Good: curved networks in a few clicks; roads and routes are one concept; on-canvas point editing replaced the typed point lists.
- Bad: no real junctions. Crossing roads just overlap, and vehicles don't turn from one road onto another. Each vehicle follows one road (a loop or a back-and-forth line).
