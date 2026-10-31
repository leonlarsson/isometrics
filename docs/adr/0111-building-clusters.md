---
status: proposed
date: 2026-10-31
---

# 0111. Building clusters: one object of many buildings that grows with a number

## Context and problem statement

Data maps want "bigger number, bigger place": a game with ten times the players should read as a much bigger town at a glance. Single buildings only grow taller or wider, which reads poorly and needs many objects placed by hand. TODO.md had "Building clusters" as an idea; the data study needed it for its example worlds.

## Decision drivers

- One object per row of data (ADR-0108), sized by one number prop that can follow data on a log scale (ADR-0109).
- Growth must be stable: a building there at 40% stays exactly where it is at 80%, so a story (ADR-0114) or a live value doesn't reshuffle the town.
- Cheap in numbers: 10–20 clusters of 20–40 buildings each in a world (ADR-0086, ADR-0092).
- Every colour named; lit windows at night (ADR-0058, ADR-0089).

## Considered options

1. Place many separate buildings per data row and show or hide them.
2. Parts of their own whose `builtShare` (0–1) decides how much of a seeded layout is built.

## Decision outcome

Chosen option: **2**. Four parts, `house_cluster_01` (a village), `tower_cluster_01` (a downtown), `shed_cluster_01` (an industrial estate) and `tent_cluster_01` (a camp with a campfire), share the props `builtShare`, `width` (the diameter) and `seed` (another arrangement). `parts/buildings/clusterKit.ts` makes the layout from the style, width and seed alone: slots from the middle outwards on a spiral or a street grid, with no overlaps; `builtShare` builds the first `1 + share × (N − 1)` of them (at least one), the newest rising in smoothly, and every building a little taller with the share. The pieces are shapes of size 1 scaled per building (`clusterPieces.tsx`), so every cluster in a world shares about seven geometries and batches. Windows are a `windows` light that comes on one by one, drawn as glowing boxes rather than `LitWindows` (whose see-through planes don't batch).

The main colour (first, and the card's dot) is what reads from above: roofs for houses and sheds, facades for towers, canvas for tents.

In View mode the object opened gets a wide ring on the ground and one under the pointer a thin one, told apart by shape (`ViewRing` in `render/EntityNode.tsx`).

### Consequences

- Good: "Place one for each row" with a cluster and a log-scale size makes a data map in one step.
- Bad: a full tower cluster is about 500 meshes (batched, but many instances); 40 buildings is the most a cluster has.

## More information

`src/parts/buildings/*_cluster_01.tsx`, `clusterKit.ts` (+ tests), ADR-0086, ADR-0092, ADR-0109.
