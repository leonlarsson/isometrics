---
status: proposed
date: 2026-11-03
---

# 0130. Templates' spreadsheets are example files kept on this site

## Context and problem statement

Everything in a template should be something a person could do in simple steps (the owner, 2026-11-02). Battlefield territory's deliveries per month came from a spreadsheet nobody had, and Extraction shooter territory's from a source named "Example numbers" and a Steam API that can't be read from a browser (it needs a key). The owner (2026-11-03): a template may come with a "fake" spreadsheet, as long as people can see how they'd do the same; and downloading files people uploaded is a security risk.

## Decision drivers

- A template's data can be followed step by step: the file can be seen, and the steps to use one's own are said.
- Nothing anyone uploaded or shared is ever offered as a download: a world can come from anyone, and spreadsheet apps run cells as formulas (CSV injection).

## Considered options

1. Example files kept in this repo and served by this site; a template's file source names one, and its page offers it to download.
2. Any spreadsheet source downloadable, rebuilt from what the world read from it.

## Decision outcome

Chosen option: **1**.

- `public/examples/*.csv`: the templates' spreadsheets, reviewed like code. A test (`templates/exampleFiles.test.ts`) checks each is there and reads back, as **A spreadsheet file…** reads it, exactly as the template holds it.
- A file source's `exampleFileUrl` names one (`/examples/<name>.csv`): the schema accepts only that shape, so a world from anywhere else can't point it at another address. Its page in the Data window says the world's numbers came from it, offers **Download the example file**, and how to do the same with one's own numbers (Add data → A spreadsheet file…).
- Battlefield territory: deliveries per month from `battlefieldstats-sent-monthly.csv`; the rest from the Battlefield Stats API. Each game's past by month stays as the world kept it (a spreadsheet can't give a table a past).
- Extraction shooter territory: its games from `extraction-shooters-games.csv` (Steam's players on 31 Oct 2026 as a snapshot, and example numbers), its audience overlap from `extraction-shooters-overlap.csv`; the total is typed, the games' players added up.

### Consequences

- Good: every number in the data templates comes from a public API or a file anyone can download and read in themselves.
- Bad: the example files and the templates must agree; the test catches it when they don't.

## More information

`scene/schema.ts` (`exampleFileUrl`), `ui/DataSourcePage.tsx`, `public/examples/`, `templates/battlefieldTerritory.ts`, `templates/extractionShooters.ts`. Related: ADR-0107, ADR-0113, ADR-0119.
