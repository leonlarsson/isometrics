---
status: proposed
date: 2026-11-01
---

# 0123. The Data tab and the Data window: lists by kind, and every path ends in the world

## Context and problem statement

The Data tab had four panels (Values, Tables, Legend and tiles, Sources) that had to be understood together: a value said "From …" in one panel, its source lived in another, and nothing on the tab said what data was for or how it reached the world (that happened on each object's Data tab). Even the owner found it confusing. A side panel is also too narrow for a table's rows or a value's chart.

## Decision drivers

- Someone who has never used data should understand what it's for from the empty tab.
- One idea per screen: where data came from and what it gave belong together.
- Adding data should end with it showing in the world, not in a list.
- Keep every safety from ADR-0119: nothing is read from an address before this browser allows it.

## Considered options

1. Keep the panels, explain them better.
2. Only the side panel, grouped by source.
3. Both: the side panel as a glance list, and a Data window (like Preferences) for the work.

## Decision outcome

Chosen option: **3**.

- **Lists by kind** (`editor/dataList.ts`, `ui/DataList.tsx`), shared by the tab and the window: chips (**All**, **Values**, **Tables**, **Sources**, with counts), then a card for each kind. A value's row has its name, its past values as a line and its value, with where it comes from under it (its source's name, "· waiting for your yes" while that waits, or "typed by hand"); a table's, its name and rows; a source's, an icon for its kind (a tooltip says it in words: a link or API, a spreadsheet file, a snapshot), its name, how it's doing in words, and **Allow** while it waits. Every row opens its page in the Data window, and nothing else does. One search finds values and tables by name or key or by their source's name, site or file, and sources by theirs. (A first try grouped the list by source, a card each; it read as a list of sources when people look for their values, so it's by kind.)
- **The Data tab** (`ui/DataPanel.tsx`) is that list with a search, **Add data** and a button for the window, under what needs an answer (values that arrived, sources waiting for a yes, sources that couldn't be read, explained once per way of failing). An empty world's tab says what data is for.
- **The Data window** (`ui/DataWindow.tsx`, the store's `dataWindow`: where it's open, runtime only): the list on the left, what's picked on the right: a value (its number, **Show it in the world**, then its page as before), a table (what it is in a sentence, **Show it in the world**, its rows and who follows each), a source (what it is, Allow, reading it again, what it gives, its name, removing it), or **Add data**. On phones it fills the screen, one column at a time.
- **Add data** (`ui/AddDataPage.tsx`): three cards, a spreadsheet file, a link or API, or a number typed by hand; for an empty world, first what data is for, three examples and **Open an example world…**. The reading dialogs are the same as before; when one closes, the window opens at what it added, with **Next: show it in the world**.
- **Show it in the world** (`ui/ShowInWorld.tsx`): for a table, **Place one for each row…**, give objects named like its rows their row, or **Draw a road for each row…**; for a value, put it on the selected object's card, make a setting of the selected object follow it (its Data tab), or add it as a tile in View mode. What can't be done yet is greyed with its reason ("select one first"), not hidden.
- **Legend and tiles** moved to the World tab, under **Shown in View mode**: they're about the screen, not the data. **Suggest chips** adds only the chips that are missing, keeping those edited by hand.
- **Kit:** `ActionCards`, a few things to do as cards with a line each (for picking one option, `ChoiceCards` stays).

### Consequences

- Good: "where does this come from" is answered on every row; "what is this for" by the empty tab and by every value's and table's next step.
- Good: a table's rows and a value's chart have room.
- Bad: editing a value now opens a window over the view, where the tab used to show its page in place.
- Bad: the window repeats the list the tab shows (one component, so they can't drift apart).

## More information

- ADR-0108 (rows become things), ADR-0110 (legend and tiles), ADR-0112 (roads for rows), ADR-0119 (addresses wait for a yes), ADR-0072's Preferences for the window's shape.
- `editor/dataList.ts`, `ui/DataList.tsx`, `ui/DataPanel.tsx`, `ui/DataWindow.tsx`, `ui/AddDataPage.tsx`, `ui/ShowInWorld.tsx`, `ui/DataTablePage.tsx`, `ui/DataSourcePage.tsx`, `ui/useSourceStatuses.ts`, `ui/LegendSection.tsx`, `ui/ActionCards.tsx`.
