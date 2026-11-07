---
status: proposed
date: 2026-11-07
---

# 0153. Tables over time: a dated sheet read as a table with a past, and the past shown

## Context and problem statement

A table could have a past (`history`, its rows on past dates), and the story's time slider played it, but nothing in the app could give it one: a spreadsheet with a date on each line was read either as values over time (each column of numbers one value, mixing every thing's lines) or as a table of every line. Only a template's code could write a table's past, and once written it was invisible outside View mode's slider: a table's page in the Data window showed its rows now and nothing else. The owner wants data maps with real pasts, from real sources, that people and AIs can read in, look at and write (2026-11-07).

## Decision drivers

- A real spreadsheet (a borough per month, a shop per week) gives a table its past with no work: the shape is guessed.
- What a table's past holds can be seen and checked where its rows are.
- People and AIs alike know how to give a table a past, and are told when it's wrong.
- Reading a source again brings its new past, as values' do.

## Considered options

1. **A table over time:** a new reading of a sheet, a date and a name on each line; the latest date's lines its rows, every date's its past.
2. A wide sheet (a date per line, a column per thing) read into a table: it can only hold one number per thing.
3. Keep tables' pasts for code and AIs only.

## Decision outcome

Chosen option: **1**.

- **Reading** (`scene/sheets.ts`): `{ readsAs: "tableOverTime", dateColumn, keyColumn }`. Each date's lines (in the sheet's order) are the table's rows then, oldest date first, the latest date's its rows now (the latest also in the past, as a value's latest point is). The date column isn't a column of the table; the column naming things is its `keyColumn`. It's the guess for a sheet with a column of dates, a column naming the same things on two or more dates (none twice on one date) and at least one more column; a plain dated series stays values over time. Greyed out with its reason otherwise: no column of dates, only one date, no column names the same things on each date, nothing but a date and a name.
- **The spreadsheet dialog:** **A table over time**, with **Dates in** and **Rows are named by** (a column that isn't the same things on each date is greyed out, saying so), and the summary says its past ("with its past on 6 dates from 2026-05 to 2026-10"). Reading a table that has a past again starts as a table over time, its rows named as before.
- **Reading again** (`editor/sourceRefresh`, `editor/worldData`): what arrives from a source carries a table's past with its rows, so a dated sheet behind a link brings its new dates; arrived data differs from what's kept when its past does.
- **The table's page** (Data window): a **Past** panel: how many dates, from when to when, what the time slider and things following its rows do with it, and **Rows on** a date with that date's rows. Without a past, it says how a table gets one.
- **For people and AIs:** the guide (the pieces of a world; For AIs, with a table's `history` written out), the world format's overview and `history`'s description. Validate warns of a value's or table's past that isn't oldest first, a date that isn't one (2026, 2026-09, 2026-09-30 or with a time), and a past row without its name.

### Consequences

- Good: a real dated spreadsheet makes a data map with a story, read in a click; its past can be looked at and checked, and AIs write it the same way.
- Bad: a table over time's columns are the same on every date; a column that comes and goes is empty where it's missing.
- Later: JSON from an API read as a table over time (an array with a date in each item); watch lines and notes on a table's columns; a trend per column on the Past panel.

## More information

ADR-0107 to ADR-0114 (data study), ADR-0108 (things follow a table row), ADR-0113 (links and APIs), ADR-0114 (stories), ADR-0123 (the Data window), ADR-0152 (areas follow a table row).
