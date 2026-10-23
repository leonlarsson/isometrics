---
status: accepted
date: 2026-10-23
---

# 0050. Parts, road styles and area types have numbered ids, so each can have variants

## Context and problem statement

There will be several looks of each thing: five office towers, a cobbled road, a darker water. Ids like `tower`, `asphalt` and `water` leave no room for a second one, and code checked specific ids (`style === "hidden"`, `kind === "zone"`), so a second variant would have silently lost that behaviour.

## Decision drivers

- Adding a variant should be adding one thing, and the compiler should point out anything else it needs.
- Variants can look completely different, so each needs its own geometry, props and picture.
- Ids stay readable for people and AIs writing worlds (`/schema.json`, ADR-0032).

## Considered options

1. Numbered ids: `office_tower_01`, `road_01`, `water_01`; a variant is a new id.
2. Keep ids and add a `variant` field to each part, road and area.

## Decision outcome

Chosen option: **1**. Option 2 would put every variant of a family in one part (one props schema, one inspector, branches per variant), its pictures would need special handling, and variants would be hidden inside a field instead of listed as parts in `/schema.json`.

- **Ids:** every part kind (snake_case, `_01`), road style (`road_01`, `dirt_path_01`, `hidden_route_01`) and area type (`water_01`, `grass_01`, `sand_01`, `plaza_01`, `raised_land_01`). Part files are named after their kind (ADR-0043). Old ids aren't mapped: worlds saved before this show unknown-part placeholders and lose their roads and areas (accepted while the app is a playground).
- **Behaviour comes from catalogues, never from an id:** `ROAD_STYLES` (surface colour, centre line; `isHiddenRoute`) and `AREA_TYPES` (surface colour, start height, roughness); part flags such as `flat` (a zone that other parts may sit on). Records keyed by the id types make the compiler ask for every entry a new style or type needs (look, name, width, palette description and swatch).
- **Names:** `scene/variants` reads the family and number from an id. A family with one variant shows its plain name ("Office tower"); with more, each shows its number ("Office tower 1", "Office tower 2"), via `partName` / `partNameOf` and `ROAD_STYLE_LABELS` / `AREA_TYPE_LABELS`.

### Consequences

- Good: a new part variant is one file and one registry line; a road or area variant is one enum value plus the entries the compiler asks for. Checked with a dry run adding `office_tower_02`, `road_02` and `water_02`.
- Bad: old saves don't carry over.

## More information

`src/scene/variants.ts`, `src/scene/roads.ts`, `src/scene/areas.ts`, `src/parts/registry.ts`, `src/parts/types.ts` (`flat`), `src/ui/PartsPalette.tsx`.
