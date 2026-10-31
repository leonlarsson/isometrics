---
status: proposed
date: 2026-10-31
---

# 0110. The dashboard: trends, watch lines, no data, a legend, the data as tables, and tiles

## Context and problem statement

Isometrics started as a "3D dashboard" (ADR-0019), but its cards showed a number and nothing else: no change, no warning, nothing for a thing without a value, nothing to say what a size or a road means, and no way to read the world's numbers except by hovering things. The owner is colourblind, so whatever a dashboard says must never be said by colour alone.

## Decision drivers

- Words and symbols first, colour second (ADR-0089).
- A value's past comes from its source (ADR-0107); a trend is what that past says.
- Viewers who can't read a 3D map need the same data another way.
- Nothing per frame: cards and tiles render when data changes.

## Considered options

1. Colour cards by state (red when low), and a separate dashboard page.
2. Words on the cards and tiles (change, flags, "no data"), a legend, and the data as tables over the map behind a Map / Data switch.

## Decision outcome

Chosen option: **2**.

- **Change**: a value with a past shows a sparkline and "▼ 8% on September" / "▲ 12% since 30 Oct" against its point before (`scene/trends.ts`). Rows' columns get a past from their table's `history`.
- **Watch line**: a value or a column has a `threshold` (`line`, `flagsWhen` above or below, a `word`); crossing it shows "⚠ Watch under 30" in an outlined pill on cards, tiles and the data's tables. Set on a value's page.
- **No data**: a card whose values are all missing (an empty cell, a gone key) says "no data", greyed, its dot desaturated; a tile or cell says it too, never a zero.
- **Tag**: a label's `tag` ("home") shows beside the title on the card and the detail sheet.
- **Detail sheet** (View mode): title and tag, where the data comes from and when it was read (the row's table's source, else the first value's: its `about`, "read 20 Oct 2026"), a tile per value (big value, meaning, past, change, flag, the value's own `about` note such as "Example numbers, not from Steam"), the object's description as a note, and "Source:" with the source's `pageUrl` as a link.
- **Legend**: `onScreen.legend` chips under the title ("**Size** 30-day average Steam players, log scale"), suggested from what follows data (`editor/legend.ts`) and edited in the Data tab.
- **Map / Data**: in View mode (`onScreen.showsDataSwitch`), Data shows every table (with what follows each row on the map) and every value (now, change, flag, where from) as tables, the accessible way to read the world. Escape goes back. Runtime only.
- **Tiles**: `onScreen.tileKeys` shows the world's main values as tiles along the bottom edge.

### Consequences

- Good: everything a card says can be read without colour; the world is readable as tables.
- Bad: cards grow taller with a sparkline and a flag; label layout (ADR-0048) has more to place.

## More information

`scene/trends.ts`, `ui/DataReading.tsx`, `ui/LabelLayer.tsx`, `ui/DetailSheet.tsx`, `ui/Dashboard.tsx`, `editor/legend.ts`, ADR-0063, ADR-0089, ADR-0107.
