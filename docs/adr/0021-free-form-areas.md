---
status: accepted
date: 2026-10-21
---

# 0021. Free-form areas: water, grass, sand, plazas and raised land

## Context and problem statement

Worlds were limited to a single rectangular ground slab, with rectangular or round "zone" parts for anything else. That can't describe real places: a harbour, a coastline, a park or a rocky headland needs an arbitrary outline. Recreating Monaco made this obvious, because Port Hercule, the coast and the Rock looked like stacked boxes.

## Decision drivers

- Non-technical users must be able to draw an outline by clicking, the same way they draw roads (ADR-0017).
- Shapes must stay editable afterwards: move, add and remove corners.
- The scene document stays the single source of truth (ADR-0003), with colours from the theme palette (ADR-0007).
- Low-poly look: flat colours, crisp edges, no textures.

## Considered options

1. **Polygon areas in the scene document** (`areas`), each with a type, outline, optional height and colour.
2. More zone part shapes (polygon zone as an entity).
3. A paintable ground grid (per-cell ground types).

## Decision outcome

Chosen option: **polygon areas**. They are a first-class list next to `roads` because, like roads, they are defined by points rather than by a position, rotation and size, and they need point editing rather than the entity gizmo.

- Schema: `areas: [{ id, name, type, points: [x, z][] (≥ 3), height, color }]`. `type` is `water | grass | sand | plaza | land`. `color: null` uses the palette colour for the type.
- `height > 0` extrudes the outline into raised ground with cliff sides (palette `cliff`). New "Raised land" areas start at 1.5; any type can be raised from the inspector. Entities on raised ground use `elevation`.
- Rendering: flat areas are a `ShapeGeometry` laid on the ground just above the slab and below roads; later areas in the list draw on top where they overlap.
- Editing: Add to scene → Areas starts a drawing (click corners, Enter or click the first corner to finish). A selected area shows corner handles (drag to move, double-click or Delete to remove, minimum three) and edge midpoints (drag to insert a corner). Areas are also listed in the Scene tab, which is how you reach one hidden under another.
- Selection is exclusive across entities, roads and areas (`NOTHING_SELECTED` in the store).

### Consequences

- Good: real coastlines, harbours, parks and plateaus; templates can trace real places.
- Good: reuses the road drawing tool, ground-drag handles and history coalescing.
- Bad: overlapping areas rely on draw order and tiny height offsets; there's no boolean union or holes yet.
- Bad: roads and entities don't follow raised ground automatically. Authors set road heights and entity `elevation` to match.

## More information

- Code: `src/scene/areas.ts`, `src/render/AreaMesh.tsx`, `src/render/AreaHandles.tsx`, `src/ui/AreaInspector.tsx`, area actions in `src/editor/store.ts`.
- Related: ADR-0003 (scene document), ADR-0007 (palettes), ADR-0017 and ADR-0018 (roads and point editing).
- Follow-ups: holes (an island in a lake), smooth outlines, textures or patterns per type, terrain that roads and entities snap to.
