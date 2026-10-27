---
status: proposed
date: 2026-10-27
---

# 0088. Add to scene for many parts: category chips, families and a list

## Context and problem statement

Add to scene shows every road, area and part in one scrolling list of folding sections (ADR-0051). That works for 19 parts; a library of hundreds is planned (TODO), with families of numbered variants (ADR-0050). One long list of hundreds of tiles, each variant a tile of its own, would bury what you're looking for.

## Decision drivers

- Finding a part among hundreds, by looking as well as by searching.
- A family's variants together, without each taking a tile.
- The things you use stay one click away (ADR-0051).
- The narrow panel, and phones (ADR-0030).

## Considered options

1. **Category chips:** a row of chips under the search, showing one category at a time.
2. **Folding sections only** (as now), starting folded.
3. **A category list on the side,** like a file browser.

## Decision outcome

Chosen option: **1, category chips** (the owner's choice, 2026-10-27), because one category at a time keeps the panel short and the chips show at a glance what there is; side navigation doesn't fit the narrow panel.

- **Chips** (`ChipGroup`, in its new small size, without icons so they take few rows): Roads, Areas, then the parts' categories. The chosen one is remembered per browser (`editor/paletteMemory`'s `category`), Buildings at first. Under them, Favourites and Recently used stay on top as before, then the chosen category.
- **Searching** looks through every category, its matches grouped by category; the chips step aside meanwhile.
- **Families:** in a category, a family's variants share one tile (`groupByFamily` in `scene/variants`), named for the family and saying how many variants it has. Clicking it adds its first variant, as a single part's tile does; its variants button opens the family underneath, across the row, with a tile per variant (each one draggable, with its preview and star like any tile). Favourites, Recently used and search results show single variants, the ones picked.
- **Grid or list:** two buttons in the panel's header. The list shows a row per item, a small picture, its name and what it is, for scanning many parts by their description. Remembered per browser (`layout`).

### Consequences

- Good: the panel stays short however many parts there are, and a family takes one tile.
- Good: nothing about the parts changes; a new category or a new variant shows up by itself.
- Bad: seeing everything at once needs a search (or the parts catalogue, ADR-0087); browsing is one category at a time.
- Bad: a family's variants are one more click away than a single part.

## More information

Changes the layout of ADR-0051 (favourites, recently used and folding sections stay). `src/ui/PartsPalette.tsx`, `src/editor/paletteMemory.ts`, `src/scene/variants.ts`. Follows the *A big library of parts* item of the TODO. The parts catalogue is to group a family's variants the same way once there are some.
