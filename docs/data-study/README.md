# Data study: worlds that show real data

A study of how worlds get their data: where it comes from, what shape it has, how it reaches what's drawn, and how it can update live later without changing worlds or bindings. Isometrics started as a "3D dashboard"; worlds exist to show data (ADR-0019). Until now that data was a flat list of values typed by hand (ADR-0010).

**Status:** in progress on the `data-study` branch. Step 1 (the foundation) is built; the rest is planned below. Decisions become ADRs once each step has been tried and kept.

## What the owner asked for (2026-10-30)

- **Sources:** all four, in time: a spreadsheet file (CSV, Excel), a link to a sheet or CSV that's read again, a JSON API, and values pushed to the app (a webhook).
- **Shape:** single values, tables (one row per warehouse, player, line…) and history (trends, sparklines).
- **Use:** both live screens (a wall display, an office TV) and stories (a world that explains a year), live first.
- **Server:** undecided. "Maybe no live support for now, but all systems must be ready to enable live later." The app is a Cloudflare Worker, so the server side, when it comes, is Workers, Durable Objects and KV or D1.

## What a world could already do with data

Bindings by key (ADR-0010, ADR-0058, ADR-0060) are the strong part, and they stay as they are:

- floating cards (`label.dataKeys`) and View-mode detail tiles (`details.dataKeys`);
- a light switched or dimmed by a value (`lights.<id>.data`), a colour set or blended by one (`colors.<id>.data`);
- the time of day, the weather, the mood, and the ground's, roads', areas' and fences' colours following a value.

Every binding names a key and reads through `parts/dataBinding.ts` (`readSwitch`, `readScale`, `readColor`), so where a value comes from is invisible to it. That's what makes the rest possible without touching parts.

What was missing: any way in except typing, more than one number per key, rows, and history.

## The design: five layers

```
 Sources ──read──▶ Data ──now──▶ Bindings ──▶ What's drawn
 (file, link,      (values,       (by key;      (cards, lights,
  api, push)        tables,        rows of a     colours, time,
                    history)       table, later) dashboard)
                      ▲
                      │ arrived while open (never saved, never an undo step)
                 the runtime
```

1. **Sources** say where data comes from: `scene.data.sources[]`, each with an `id`, a `name`, a `kind` (`file`, `link`, `api`, `push`), a `url` or `fileName`, how often to read it again (`refreshSeconds`, null = only when asked) and when it was last read. Secrets (API keys) are never in the world: they'll live on the server, with the source pointing at them.
2. **Data** is what the world keeps: `scene.data.values[]` (a key, a name, a value, a unit, optionally the `source` and `path` it's read from, and its `history` of `{ at, value }` points) and `scene.data.tables[]` (a key, a name, a `keyColumn` that names each row, `columns` and `rows`). The world keeps a snapshot, so it opens and draws the same offline, in a file, or shared.
3. **The runtime** (`editor/worldData.ts`) is what makes it live-ready. Values that arrive while a world is open (a source read again, a live feed later) go into a separate *arrived* store, never into the document: no undo step per tick, no autosave per tick, no change the user didn't make. Everything that shows or follows data reads `useWorldData()` or `worldDataNow()`, which is the kept data with what arrived on top, a value's history growing as points arrive. Keeping what arrived (a *Keep these values* action, to come) will be an ordinary edit, one undo step. What arrived belongs to the world it arrived for and is forgotten when another opens.
4. **Bindings** stay by key. Next: an object bound to a table row (its `keyColumn` value), so a warehouse follows its row's columns, and a column picked wherever a key is picked today.
5. **Presentation** is the dashboard half: sparklines and trend arrows on cards, thresholds that colour a value, and a View-mode layer of tiles for the world's main values.

### Why not put live values in the document?

It's the simplest, but every tick would be an undo step and an autosave, a world shared while live would carry a moment's numbers as if typed, and two viewers of a live world would fight over the document. Keeping kept and arrived apart is cheap now and is exactly the seam a server needs later: a Durable Object per world pushes points into `valueArrived` / `tableArrived`, and nothing else changes.

### Why tables, not more values?

Data that drives a world is usually per thing: a row per warehouse, line, player or sensor. As separate values (`warehouse_3_stock`, `warehouse_3_orders`…) it's a hundred keys to bind one by one and nothing to say they belong together. A table says it once, and an object takes a row.

## Step 1, built: the foundation

- `scene/schema.ts`: `WorldDataSchema` (values, tables, sources), each field described for `/schema.json`. The world's `data` was a list of values; it's now `{ values, tables, sources }`.
- `scene/legacy.ts`: a world whose `data` is a list (every world saved before this) is brought up to date on load, its values under `values`, so it opens with nothing repaired or lost (ADR-0106; the old-world fixtures and the every-field world check it).
- `scene/repair.ts`: the safety net reaches into nested lists (`data.values`, `data.tables`, `data.sources`), so one unreadable table is left out, not the whole world's data.
- `editor/worldData.ts`: the runtime above; every reader of data goes through it (cards, the outliner, objects, fences, roads, areas, the ground, the time of day, the weather).
- `ui/DataPanel.tsx`: the Data tab in three panels, Values (as before, plus where each comes from and how many past values it has), Tables and Sources.

## Next steps

2. **A spreadsheet in.** Drop a CSV or Excel file on the Data tab: a sheet with one row of numbers becomes values; one with a name column becomes a table; one with a date column becomes history. Read in the browser (no server), the file name kept as the source.
3. **A table on the map.** Bind an object to a row (Brightwater's warehouses to a stock table) and let its card, colours and lights follow that row's columns.
4. **A dashboard.** Sparklines and trends on cards, thresholds, and a View-mode layer of the world's main values.
5. **Links and APIs.** A link to a published sheet or CSV, or a JSON API, read in the browser when it allows it (CORS) and through the Worker otherwise, picking values and a table out of the response by path. Then pushed values and live updates: the server side, once decided.

## Test sources

The owner's own public APIs, both readable from the browser (`access-control-allow-origin: *`):

| Source | What it gives | Fits |
|---|---|---|
| `https://api.battlefieldstats.com/users/count` | `{ "totalUsers": 41738 }` | a value (path `totalUsers`) |
| `https://api.battlefieldstats.com/outputs/daily` | `[{ day, sent }]` | a value with history |
| `https://api.battlefieldstats.com/outputs/counts` | `[{ category, item, sent }]` | a table |
| `https://api.the-finals-leaderboard.com/v1/leaderboard/s8/crossplay` | `{ meta, count, data: [{ rank, name, league, … }] }` (10,000 rows; `count` limits it) | a big table |

## Open questions

- **Where a source's secret lives** (API keys): on the server, per world, which needs worlds on the server (accounts or share links, ADR-0006).
- **How much history a world keeps**: every point, or a window (the runtime keeps the last 500 while open).
- **Tables of tables**: whether an API's nested lists become several tables or one picked by path (start with one by path).
- **Who refreshes a link** when nobody has the world open: nobody, until there's a server; then a Cron Trigger or the world's Durable Object.
