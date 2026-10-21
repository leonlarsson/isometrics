---
status: accepted
date: 2026-10-21
---

# 0005. Procedural, parametric parts in a registry

## Context and problem statement

Users build scenes out of objects (warehouses, vans, trees …) and need to resize, recolour and configure them. We need a consistent visual style and a simple way to add more objects.

## Considered options

1. Procedural parts built from primitives in code
2. Imported GLTF models
3. Both, with procedural first

## Decision outcome

Chosen option: **procedural first**. GLTF can be added later as just another part kind.

Each part is an `IPartDefinition` created with `definePart()` (`src/parts/types.ts`) and listed in `PARTS` (`src/parts/registry.ts`):

- `schema`: a Zod object **with defaults for every prop** (`schema.parse({})` must succeed).
- `fields`: drives the inspector's "Shape" controls automatically.
- `defaultColor` / `defaultAccent`: a hex value, or a function of the theme palette (theme-aware defaults).
- `footprint` and `height`: used for selection frames, placement and label anchors.
- `canFollowPath`: lets the part drive along routes.
- `Component`: R3F component. Conventions: origin at the footprint centre on the ground, front faces +Z, vehicles drive towards +X.

### Consequences

- Good: tiny bundle, consistent style, every part is customisable through generic UI with no per-part UI code.
- Bad: detailed or organic shapes are hard to make procedurally.
