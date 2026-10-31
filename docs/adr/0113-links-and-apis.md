---
status: proposed
date: 2026-10-31
---

# 0113. Links and APIs are read in the browser, picked by path, and read again into what arrived

## Context and problem statement

Spreadsheets (step 2) are read by hand. The owner's worlds want numbers that keep up by themselves: a registered-users count every minute, messages per day, a leaderboard. Data comes as a CSV link, a published Google Sheet, or a JSON API. There's no server state for now (no accounts, no stored secrets, no webhooks), but everything must be ready for one.

## Decision drivers

- Worlds open offline from their snapshot (ADR-0107); a failed read never empties anything.
- Live reads never make undo steps or autosaves (the arrived layer, ADR-0107).
- Clear errors: a site that blocks browsers (no CORS header) must say so and what would fix it.
- Big responses (a 10,000-row leaderboard) must not make huge worlds by accident.

## Considered options

1. A read-through route on the Worker for every source now.
2. Read in the browser where the source allows it; a JSON source is picked by path once, and read again by the same paths; the server is designed, not built.

## Decision outcome

Chosen option: **2**.

- **Read a link or API…** (Data tab → Sources): an address read by the browser (`editor/readLink.ts`). A Google Sheet's page is read as its CSV export. CSV goes on to the spreadsheet dialog as a `link` source. JSON is described (`scene/jsonSource.ts`: its single numbers, and its lists of entries with their fields, one level deep) and picked: numbers as values; a list as a table (columns chosen, the field naming rows, the first N rows kept, previewed) or as values over time (a date field and number fields, each becoming a value whose past is the list). Each value and table remembers its `path` (and `field`, `dateField`; columns their `field`; tables `maxRowCount`), and the source its `url` and `refreshSeconds`.
- **Reading again** (`editor/sourceRefresh.ts`): every link and API source is read when its world opens and every `refreshSeconds` while it's open, and what it gives goes into the arrived layer (a value's whole past when the source has dates). The Data tab offers **Keep these values** (one undo step) and **Read it again now**; each source says when it was read or why it couldn't be.
- **Errors** say what happened: offline (the snapshot stays), blocked (the site sends no `Access-Control-Allow-Origin`; it would work if the site allowed it or through a server that reads it for the browser, not built yet), a status (401/403: it may need a key, which worlds can't keep yet), not JSON or CSV.

The server, when it comes, is in docs/data-study (a read-through route for sources that block browsers, keys kept on the server, pushed values, reading when nobody has the world open).

### Consequences

- Good: the owner's APIs (CORS open) work live with no server.
- Bad: Steam's current-players API sends no CORS header, so a browser can't read it; worlds use it as a saved snapshot until the read-through route exists.
- Bad: a refresh only happens while someone has the world open.

## More information

`editor/readLink.ts`, `editor/sourceRefresh.ts`, `scene/jsonSource.ts`, `ui/ReadLinkDialog.tsx`, ADR-0107.
