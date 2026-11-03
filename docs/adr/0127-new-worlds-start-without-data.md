---
status: proposed
date: 2026-11-03
---

# 0127. New worlds start without data; the Data tab stays, one click from turning it on

## Context and problem statement

ADR-0115 made data a setting of the world (`data.isOn`), on unless a world says otherwise, and took the Data tabs away while it's off. The owner (2026-11-03): fresh worlds should start with data off, a one-click switch in the Data tab, still there, and in the World tab where it is; the starters that have data come with it on.

## Decision drivers

- A new world is a plain builder until data is wanted.
- Data stays one click away, where people look for it (the Data tab).
- Worlds already saved, shared or written by AIs keep their data: what's read stays as it was (ADR-0106).

## Considered options

1. New worlds start off: a blank world is made with `isOn: false`; the format's fallback for worlds that don't say stays `true`.
2. Change the format's default to off, converting older worlds on load and always writing the field.

## Decision outcome

Chosen option: **1**. It changes what's made, not what's read: shared worlds and AIs' worlds leave defaults out (`compactWorld`), so a default of off would turn their data off.

- `createEmptyScene` makes a world without data, and New world's **Blank** starts with **Uses data** off; a starter starts as it's made (a test checks every starter uses data exactly when it has some: Shape Castle doesn't). The welcome's ways in still say on or off for theirs (ADR-0116).
- **Uses data** is one switch (`ui/UsesDataSwitch.tsx`), the same in the World tab and the Data tab; its Reset goes back to off, what a new world has.
- While data is off the world's **Data** tab stays, holding only that switch ("This world doesn't use data"); on, the switch is at the end of the tab too. A thing's own Data tab is still gone while off. Everything else ADR-0115 hides stays hidden.
- The format's `data.isOn` still defaults to `true` when a world doesn't say: every world saved before, shared or written by an AI opens as it was.

### Consequences

- Good: a new world is a plain builder, and data is one click away in the tab named for it.
- Good: nothing saved changes.
- Bad: the format's fallback (on) and a new world's start (off) differ; the switch's Reset follows what a new world has.

## More information

`templates/empty.ts`, `ui/NewWorldDialog.tsx`, `ui/UsesDataSwitch.tsx`, `ui/DataPanel.tsx`, `ui/Inspector.tsx`, `guide/guide.ts`. Changes those points of [ADR-0115](0115-a-world-without-data.md).
