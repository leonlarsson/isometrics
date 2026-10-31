---
status: proposed
date: 2026-10-31
---

# 0108. Objects and roads follow a table row, read as `row.<column>`

## Context and problem statement

Data that drives a world is usually per thing: a row per game, club or warehouse. As separate values that's a hundred keys bound one by one, and nothing says they belong together. With tables in the world (ADR-0107), each thing should take a row and show and follow its columns, and setting that up for many things must be quick.

## Decision drivers

- Bindings stay generic and by key (ADR-0058): nothing that follows data should need to know about tables.
- Many things share the same settings (a card with Players, a size from Players) and differ only in their row.
- Reading a table again must keep everything following it.

## Considered options

1. Bindings that name a table, a row and a column each (`clubs/APES/players`).
2. A thing names its row once (`dataRow: { tableKey, rowKey }`), and its keys name columns of its own row as `row.<column>`.

## Decision outcome

Chosen option: **2**. `scene/rowData.ts` turns a thing's row into values keyed `row.<column>` (named and with units as the columns, their past from the table's `history`, watched against the column's threshold) and adds them to the world's values for that thing (`valuesWithRow`, cached per data and row). Cards, tiles, colours, lights, sizes (ADR-0109) and roads' traffic (ADR-0112) read through it unchanged. Empty cells are left out, so they read as **no data**.

Rows are named by the table's key column (or their number without one). Making many things follow rows:

- **Give each the row matching its name**: select objects, pick a table; names are matched loosely (case, spaces, punctuation don't matter), and a toast says which matched none.
- **Place one for each row…** (the table's viewer): a part, a layout (grid, line, circle), a spacing, a column that sizes each (straight or log), the columns on each card; one undo step, each named by its row and already following it.
- The table's viewer has an **On the map** column naming what follows each row.

### Consequences

- Good: one set of settings for a hundred things; copy and paste of settings carries `row.` keys to other rows' things.
- Good: reading a table again (same keys) updates every follower.
- Bad: renaming a row's key in the source orphans its follower (the inspector shows "(not in the table)"); a column renamed in the source leaves `row.<old>` keys showing no data.

## More information

`scene/rowData.ts`, `editor/dataRows.ts`, `ui/EntityDataTab.tsx`, `ui/PlaceRowsDialog.tsx`, ADR-0107.
