---
status: proposed
date: 2026-11-03
---

# 0133. Fences: gates, joining two fences, and a fence along an area's edge

## Context and problem statement

Fences (ADR-0103) left three things for later: a way through them (a gate, or a gap), joining two fences by dragging one's end onto another's as roads join, and **Fence along the edge** on an area. A paddock, a garden or a yard isn't finished without a gate, a fence drawn in two goes can't become one, and fencing a plateau or a pond by clicking its corners again is slow and never quite on its edge. A gate is also a natural thing to show data with (a car park's barrier open while it has spaces, a site's gate shut out of hours, ADR-0019).

## Decision drivers

- Old worlds open and look as they did (ADR-0026, ADR-0056): no gates is the default.
- A gate stays where a person put it while the fence is reshaped: points dragged, added, taken out, the fence split, joined or opened.
- Open and shut follows data like every other switch (ADR-0058): a `DataBindingSchema` binding in a map, read with `readSwitch`, shown with `DataDrivenField`, covered by data renames and deletes (`fenceBindingMapsOf`).
- Every style gets gates without a gate drawing of its own; still cheap (one mesh per colour, ADR-0103).
- Joining works and reads as it does for roads (the join offer, `JoinOfferBar`).

## Considered options

For where a gate is:

1. **On a stretch of the fence**: which stretch between two points (`spanIndex`) and how far along it (`alongShare`, 0 to 1).
2. A distance from the fence's start, in grid units.
3. A gate on a point (the point is the gate's middle).

For the edge: a fence of its own made from the area's outline (option A), or a setting on the area (option B, turned down in ADR-0103).

## Decision outcome

Chosen: **1** and **A**.

**The format** (`FenceGateSchema`, a fence's `gates`, default empty, so worlds without it draw as before; each field has a `.describe()` for `/api/worlds/schema`):
- `kind` (`FenceGateKindSchema`): `swinging` (a gate in the fence's style, hung on a post at its side) or `gap` (an opening with nothing across it). Default `swinging`.
- `spanIndex` and `alongShare` (default 0 and 0.5): which stretch it's on (0 = first point to second; on a loop the last stretch closes it) and where its middle is along it. A gate on a stretch keeps its place between that stretch's two points whatever happens to the rest of the fence, and moves with them in proportion when they move, as a gate in a real fence stays between its posts. A distance from the start (option 2) would slide every gate whenever an earlier point moved; a point (option 3) puts gates on corners, and inserting a point by the dots would be the only way to place one mid-stretch.
- `width` (default 1, grid units), `isOpen` (default false), `opensToTheLeft` (default false: it swings to the right of the fence's way, looking from its first point), `hasTwoLeaves` (default false), and `data` (`{ "isOpen": binding }`).

Gates are a list inside each fence without ids of their own, like points: a patch's `change` on a fence replaces the list (JSON Merge Patch replaces arrays, ADR-0118), so `PATCH_LISTS` doesn't change. `fenceBindingMapsOf` includes each gate's `data`, so a data value's rename or deletion reaches it, and the data study (`dataUsesOf`) lists "gate N: open and shut".

**The layout** (`fenceLayout`, still pure and tested): each gate is placed round the spot on the (rounded) line nearest its place on its stretch, as wide as it is (never wider than the fence, and kept on it). A post stands at both sides of it, the runs either side are shared out evenly as before, no span or step post is inside it, and a corner inside a gate gets no post (the gate goes straight across). The layout lists the built gates (`gates`: from one side post to the other); a gate past `builtShare` isn't built.

**The looks**: each style says how its gates look (`gate` in `defineFenceStyle`: an infill, `boards`, `bars`, `rails` with a brace, or `mesh`, and which of its colour ids the frame and infill are, and how far from the post's middle a leaf starts). One builder (`fences/gates.ts`) makes the leaves from the builder's beams and blocks: a frame and its infill, shut across the opening following the ground, or swung 80° and level with its hinge. So a picket fence gets a board gate in its pickets' colour, a farm fence a braced five-bar gate, a railing an iron gate, chain-link a mesh gate. The hedge and stone wall get a new colour, **Gate** (wood), since a green or stone leaf would look wrong; an existing colour id never changes. The leaves are in the fence's meshes, so a fence with gates is still one draw call per colour. Data opening or shutting a gate rebuilds the fence once, like data changing how much is built; there is no swinging animation.

**Keeping gates in place**: the store moves each gate onto the stretch nearest where it stood on the ground (`gatesMovedOnto`) whenever a fence's points change in number or its loop opens or closes: a point added or deleted (one or several), the fence split (each gate goes with its half), a loop opened at a point, joined, continued by drawing, or Loop switched (`setFenceLoops`). Moving, turning and resizing points changes no index, so gates follow by themselves.

**Editing**: the Shape tab has a **Gates** panel: **Add a gate** (on the longest stretch, in its middle) and, for each gate, its Kind (**Swinging gate** / **Gap**), the stretch it's on, **Along it**, Width, **Open** (Source: By hand / From data), **Swings to the left**, **Two leaves, meeting in the middle**, and **Remove this gate**. A selected point's panel has **Add a gate after it** (before it, at an open fence's last point). The fence's click band covers its gates, so clicking a gate selects its fence.

**Joining**: dragging a fence's end (on its own, not one of several selected points) within 0.8 of another fence's open end, or its own other end, snaps onto it; letting go offers to join them, as roads do: the join offer now says what it's of (`target: "road" | "fence"`) and `JoinOfferBar` words itself for either ("These fence ends touch"). **Join** (`joinFences`) makes the first fence the joined one (its kind, colours and settings), its points the two lines end to end with a shared point once, both fences' gates where they stood, and how much is built the two built lengths over the joined length (all of it if both were whole). A fence's own two ends make a loop.

**Fence along the edge**: in an area's Area tab (a menu of fence kinds) and its right-click menu (a submenu). It makes a new looped fence of that kind round the area's outline, each corner moved 0.22 inwards along both its sides (outwards for water, onto the bank), so it stands on the area's top when it's raised, its corners' heights and peaks included, rather than on the cliff's rim; very sharp corners move at most three times that. The fence is an ordinary fence: to leave sides open, Open loop here at a point, or delete points.

### Consequences

- Good: ways through fences in every style, open and shut by hand or from data, kept in place through every reshape.
- Good: fences drawn in pieces become one by dragging, as roads do; areas get a fence in two clicks.
- Good: old worlds are unchanged (`gates` defaults to empty; the new hedge and wall colour is drawn only on gates).
- Bad: gates are placed by panel fields, not dragged in the view; a gate handle in the 3D view is left for later.
- Bad: a gate stays on its stretch's straight line; on a fence with rounded corners near the gate, it sits at the nearest place on the curve, which moves a little as the radius changes.
- Bad: every operation that changes a fence's point count has to keep its gates (`keepGatesInPlace`); a new one must too.

## More information

ADR-0103 (fences), ADR-0058 and ADR-0060 (data bindings), ADR-0017 and ADR-0064 (road editing and joining), ADR-0098 (raised land). Code: `scene/fences.ts` (`fenceLayout`, `fenceStretches`, `gatePlaceAt`, `gatesMovedOnto`, `insetOutline`), `fences/gates.ts`, `fences/fenceModel.ts` (`gateIsOpen`), the store's `joinFences`, `addFenceGate`, `removeFenceGate`, `setFenceLoops` and `addFenceAlongEdge`, `ui/FenceInspector.tsx`, `ui/AreaInspector.tsx`, `ui/JoinOfferBar.tsx`, `render/FenceHandles.tsx`.
