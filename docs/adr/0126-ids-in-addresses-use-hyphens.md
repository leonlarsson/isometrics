---
status: proposed
date: 2026-11-03
---

# 0126. Ids in addresses use hyphens: template ids first

## Context and problem statement

Template ids are part of addresses people see, type and pass on (`/templates/<id>`, `/api/worlds/templates/<id>`), and were written with underscores (`lantern_bay`, `battlefield_territory`), the way ids inside worlds are. Addresses on the web use hyphens, and the owner asked for them (2026-11-02): `/templates/extraction-shooters`, not `extraction_shooters`. Shape Castle came first with one (`shape-castle`), so the starters were mixed.

## Decision drivers

- Ids people see in an address read like the rest of the web: lowercase words joined by hyphens.
- Every link and tool made before keeps working.
- Ids kept inside worlds (part kinds, fence and road kinds, data keys) are a bigger change of their own: every saved world, AI and `/api/worlds/schema` writes them.

## Considered options

1. Template ids with hyphens now; old ids with underscores still open the same template. Ids inside worlds later, if at all.
2. Every id at once, inside worlds too.
3. Keep underscores.

## Decision outcome

Chosen option: **1**.

- Template ids are lowercase words joined by hyphens: `brightwater`, `lantern-bay`, `monaco`, `shape-castle`, `battlefield-territory`, `extraction-shooters`. A test checks every template's.
- `templateById` (`templates/index.ts`) finds a template by its id, or by the id with its underscores turned into hyphens, so `/templates/lantern_bay`, `?template=lantern_bay` and `/api/worlds/templates/lantern_bay` keep opening Lantern Bay. Template links accept both (`openLink.ts`).
- The scripts (`shots.mjs`, `gallery.mjs`, `bench.mjs`), the guide and `PERFORMANCE.md` use the new ids.
- Ids kept inside worlds are unchanged; whether they follow is still open (`TODO.md`, *Hyphens, not underscores*).

### Consequences

- Good: starter links read as addresses do, and old ones still work.
- Bad: two styles live side by side for now, hyphens in addresses and underscores inside worlds (`office_tower_01`).

## More information

`src/templates/index.ts`, `src/editor/openLink.ts`, `src/routes/api/worlds/templates/$id.ts`, `src/templates/templates.test.ts`. Builds on ADR-0083 (templates at /templates) and ADR-0120.
