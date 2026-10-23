---
status: accepted
date: 2026-10-23
---

# 0051. Add to scene remembers favourites, recently used items and folded sections per browser

## Context and problem statement

Add to scene was one long scrolling list: roads, areas, then every part by category. With variants coming (ADR-0050) it will grow a lot, and the parts you use most were as far away as the ones you never use. Clicking a part also dropped it near the world's centre, off screen on a big ground (ADR-0049).

## Decision drivers

- The things you use should be one click away, without searching.
- A long list should fold down to what you care about.
- These are personal habits, not part of a world.

## Considered options

1. Favourites, recently used and folding sections, remembered per browser.
2. The same, stored in the world.
3. Only better search.

## Decision outcome

Chosen option: **1**.

- **Favourites:** a star on each tile (shown on hover, filled once it's a favourite) or the tile's right-click menu. Favourites get a section at the top.
- **Recently used:** the last 8 items used, from the palette, by dragging onto the scene, or from the ground's right-click menu, in a section under Favourites.
- **Folding:** every section heading (`CollapsibleSection`, a new kit component on Base UI's Collapsible) folds it and shows how many items it holds. While searching, every match shows, folded or not, and Favourites and Recently used step aside.
- **Memory:** `editor/paletteMemory` keeps favourites, recents and folded sections under `<app>:palette` in localStorage, read through a Zod schema (anything unreadable becomes an empty list), like the panel sizes. Items are palette keys ("part:house_01", "road:road_01", "area:water_01"); ones that no longer exist are skipped.
- **Right-click a tile:** headed with its name and group; "Add where you're looking" (or "Draw it") and Favourite.
- **Where a clicked part goes:** a free spot near the middle of the view, not the world's centre.

### Consequences

- Good: the parts you use are at the top; the list folds to what matters; a clicked part appears where you're looking.
- Bad: favourites and recents don't follow you to another browser or device.

## More information

`src/ui/PartsPalette.tsx`, `src/editor/paletteMemory.ts`, `src/ui/CollapsibleSection.tsx`. Next: presets per part (a styled variant, maybe with a label card already bound) and a list view once there are many more parts.
