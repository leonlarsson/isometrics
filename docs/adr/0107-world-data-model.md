---
status: proposed
date: 2026-10-31
---

# 0107. A world's data is values, tables and sources, and what arrives while it's open is kept apart

## Context and problem statement

Worlds exist to show data (ADR-0019), but until the data study a world's data was a flat list of values typed by hand (ADR-0010). The owner asked for data from spreadsheets, links, JSON APIs and, later, pushed values; for single values, tables (a row per warehouse, player, game) and history; and for live screens as well as stories, with every part ready for a server later without one now (docs/data-study).

## Decision drivers

- A world opens and draws the same offline, from a file or a share: it keeps a snapshot of its data.
- Live values must not make an undo step, an autosave or a change nobody made on every tick.
- Bindings stay by key (ADR-0058, ADR-0060), so where data comes from is invisible to what follows it.
- A value's past comes only from its source; nothing is logged behind the scenes (decided 2026-10-31).
- No server state for now; a server must slot in later without changing worlds.

## Considered options

1. Keep the flat list and add fields to values (a URL, a history).
2. `data` as `{ values, tables, sources }`, the document holding the last snapshot, and a separate runtime layer for what arrives while the world is open.
3. Live values written into the document like any edit.

## Decision outcome

Chosen option: **2**.

- **Values** (`data.values`): a key, a name, a value, a unit, optionally where it's read from (`source`: a source id and a path in it; for a value over time read from a list, the `field` and `dateField` of each entry), its `history` of `{ at, value }` points as its source gives them, and a `threshold` it's watched against (ADR-0110).
- **Tables** (`data.tables`): a key, a name, a `keyColumn` that names each row, `columns` (a key, name, unit, the `field` it's read from in a JSON list, a `threshold`), `rows`, and a `history` of past rows (`{ at, rows }`) when the source has dates. A source may keep only the first `maxRowCount` rows.
- **Sources** (`data.sources`): `file`, `link`, `api` or `push`, with a URL or file name, `refreshSeconds` while open, `lastReadAt`, a `pageUrl` for people and an `about` note on the data's quality ("Example numbers, not from Steam"). Secrets never live in a world.
- **What arrived** (`editor/worldData.ts`): values and rows that come in while a world is open (a link read again on its timer, later a push) go into a separate store, merged on top of the snapshot by `useWorldData()` / `worldDataNow()`, which every reader uses. *Keep these values* puts them in the document as one undo step. What arrived belongs to the world it arrived for.

Worlds saved with the flat list are brought up to date on load (`scene/legacy.ts`), so every world keeps opening with nothing lost (ADR-0106).

### Consequences

- Good: offline snapshots, live-ready without a server, one seam (`valueArrived` / `tableArrived`) for a server to push into later.
- Good: tables let one setting serve a hundred things (ADR-0108).
- Bad: a big table is kept whole in the world (a 10,000-row leaderboard makes a big save); `maxRowCount` limits it.
- Bad: two layers to think about when debugging what a card shows.

## More information

`scene/schema.ts` (`WorldDataSchema`), `editor/worldData.ts`, `scene/sheets.ts`, `scene/jsonSource.ts`, docs/data-study/README.md. Builds on ADR-0010, ADR-0019, ADR-0058, ADR-0060.
