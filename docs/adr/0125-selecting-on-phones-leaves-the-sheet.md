---
status: proposed
date: 2026-11-03
---

# 0125. On phones, selecting leaves the sheet as it is

## Context and problem statement

On phones the properties are a bottom sheet over the scene (ADR-0030), which opened whenever something was selected. Tapping objects to look at them, to move them or to pick the next one then covered about half the scene each time, and the sheet had to be folded again by hand (the owner, 2026-11-03: "annoying").

## Decision drivers

- A tap on the scene keeps the scene in view.
- The selection's settings stay one tap away.

## Considered options

1. Selecting leaves the sheet as it is; its tab bar, which already shows the selection's tabs, opens it.
2. Keep opening it, folded to a short preview of the selection.

## Decision outcome

Chosen option: **1**. This changes one point of ADR-0030's *Sheet over the scene*; the rest stands:

- Selecting no longer opens the sheet. A folded sheet shows its tab bar, with the selection's tabs (ADR-0054), so the object's settings are one tap away; an open sheet stays open and shows the selection.
- Picking a tab, or the show button, opens it, as before.
- Clearing the selection still folds it down to its tab bar.
- The camera's reveal (ADR-0030) still keeps a new selection clear of the sheet, at its height now.

### Consequences

- Good: tapping around the world keeps it in view.
- Bad: one more tap to reach a newly selected object's settings when the sheet is folded.

## More information

`src/ui/AppShell.tsx`; `e2e/layout.spec.ts` (phones). Changes [ADR-0030](0030-narrow-layout-bottom-sheet.md).
