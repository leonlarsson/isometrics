---
status: proposed
date: 2026-11-08
---

# 0155. Grounds: several of them, any shape, at any height, moved with what stands on them

## Context and problem statement

A world had one ground: a rectangle, width × depth, centred on the origin, set by typing two numbers. It couldn't be dragged, made round, raised, or joined by another. The owner wants the ground as editable as an area (handles, the gizmo, shapes like a circle, rounded corners), a height and a thickness, and several grounds: floating islands joined by bridges, and later several towns in one world ("multiple cities"). It should be easy: what happens to things on a ground when it moves, and how a thing goes to another ground, must just work (2026-11-08). Every world saved must look exactly as it did, and terrain shaped later (a deformation tool for grounds and areas) must fit.

## Decision drivers

- Old worlds open and look exactly as before, drawn by the same code.
- The many places that measure the world by its size (the camera, the grid, shadows, weather, the editor's limits) keep working without each learning about grounds.
- Easy: a ground moves with what's on it; a thing goes to another ground by being dragged there.
- One place answers how high a ground is at a point, for terrain later.

## Considered options

1. **A list of grounds** (`grounds`), things keeping their world positions and standing on whichever ground is under them.
2. Floating islands as a new area kind, the one ground as it was.
3. Things belonging to a ground (a `groundId`, positions in its frame).

## Decision outcome

Chosen option: **1**. The island area kind (2) would have been a dead end for several towns. Membership (3) would have touched everything that reads a position (traffic, labels, picking, cards, the camera following).

- **The format** (`scene/schema.ts`): `grounds`, at least one, each with an `id`, a `name`, a `position` (its middle), an `altitude` (its top above the base level, 0), `width` × `depth`, `points` (its corners from its middle; null = the rectangle), `cornerRadius`, `thickness` (1 by default), its `colors` and `surface`, `isHidden` and `isLocked`. Width and depth stay the size round it. A world's `keepsThingsOnGround` (true by default) says whether the editor keeps objects, roads and fences on a ground. A world saved with `ground` has it as its first ground, `id` "ground", as it was (`scene/legacy.ts`); patches change grounds by id, and a patch's `ground` changes the first.
- **The world's size** (`worldExtentOf`): the rectangle centred on 0, 0 round every ground, hidden ones too. Everything that measured the world by the ground's width and depth now measures it by this; for one ground at the middle it's that ground's size, so nothing changes for old worlds.
- **What's under a point** (`scene/grounds.ts`): `groundAt` (of the shown grounds over it, the highest at or below a height), `groundTopAt` (its altitude today: the one place to change for terrain), grounds above the base level as tops things stand on (`groundTopsOf`, with the areas' and shapes' in `topsToStandOn`), `groundHeightAt` (what fences and roads stand on), and an area's base: the top of the ground under its middle (`areaBaseOf`), which lifts its drawing, handles, outline and clouds.
- **Drawing** (`render/Ground.tsx`, `render/groundGeometry.ts`, pictures too): each ground at its position and altitude; the plain rectangle the rounded box as always (its thickness 1 by default); a shape, or rounded corners, its outline extruded with a softened top edge; the grid clipped to it; a hidden ground nothing but a dashed outline while editing.
- **Keeping things on land** (`keepOnLand`, `isOnLand`): an object, road or fence point dropped, dragged, drawn or painted past a ground's edge comes in to the nearest spot on a shown ground; areas, which draw their own ground, may lie anywhere within the world; with `keepsThingsOnGround` off, things go anywhere in the world. Roads cross the gaps between grounds, as bridges. A road point drawn on a ground starts at its height, as high above it as the previous point was.
- **Editing** (`editor/groundEditing.ts`, `render/GroundHandles.tsx`, `ui/GroundsSection.tsx`): the World tab's Ground panel (Grounds with several) lists them; one is picked (clicking a ground in the view picks it too) and its settings shown: Name, Width, Depth, Shape (Rectangle, Rounded, Circle, Half circle, Hexagon, Octagon, L shape, Island), Corner rounding, Altitude, Thickness, colour, texture, Show it, Locked, Move and shape it, Remove this ground…, with Add a ground (beside the others, picked) and Keep things on a ground. **Move and shape it** (also on a ground's right-click menu, with Its settings and Add a ground) puts handles in the view: the move gizmo in its middle (along the ground, and up with the green arrow), a handle on each corner (drag; select, Shift- or Ctrl-click for several, for the gizmo; double-click or Delete removes; it keeps three), dots between corners to add one, and size handles like an object's on each side (ADR-0124). A bar says what they do, with Done; Esc, leaving Edit mode or selecting something else ends it. The camera doesn't re-frame for a size changed meanwhile.
- **Moving a ground carries what stands on it** (`thingsOnGround`, `moveGround`): its objects (not ones driving on a road), the areas whose middle is on it, its road and fence points, and the viewpoints looking at it move by as much, and up or down with it; a road with one end on it stretches, so a bridge stays a bridge. Each thing is on whichever ground is under it at its height, so what stands on a lower ground under an island stays. One undo step per drag. **Going to another ground** is a drag: a thing stands on the ground where it's dropped, at its height, as on raised land.
- **Removing a ground** (Remove this ground…, asked first with how many things go): it goes with what stands wholly on it (a bridge to it stays), in one undo step; a world keeps one ground.
- **For people and AIs:** the guide, the world format's overview and every field's description; validation warns of an object off every ground.

### Consequences

- Good: round, shaped, raised and several grounds, floating islands with bridges, towns side by side; old worlds unchanged.
- Good: terrain later changes `groundTopAt` and a ground's slab geometry; standing, roads, fences, areas and dropping follow by themselves.
- Bad: what measures the world by its size (the camera's reach, weather, several things moved together) covers the rectangle round all the grounds, empty space included. An area spanning two grounds at different heights stands on the one under its middle. A road's pillars between grounds reach down to the base level. A shape can be dragged to cross itself.
- Later: terrain (heights over a ground's top, the deformation tool for grounds and areas); per-town names, data and navigation for multiple cities; duplicating a ground with what's on it; keeping a group move on the grounds.

## More information

ADR-0021 (areas), ADR-0049 (larger grounds), ADR-0098 (things stand on what's under them), ADR-0124 (size handles), ADR-0137 (surfaces), ADR-0154 (pick order, handles on top).
