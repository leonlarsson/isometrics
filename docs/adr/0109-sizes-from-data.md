---
status: proposed
date: 2026-10-31
---

# 0109. An object's size and props can follow data, on a straight or log scale

## Context and problem statement

Colours and lights could follow data (ADR-0058, ADR-0060), but nothing about an object's size could: a tower's floors, a cluster's size (ADR-0111), its overall scale. Data maps need it most ("bigger number, bigger city"), and player counts or populations span orders of magnitude, so a straight scale makes everything but the biggest tiny.

## Decision drivers

- One generic mechanism for every part's number props and the object's scale, no per-part code.
- Saved worlds stay valid: bindings live in a map by setting (AGENTS.md: never a one-off `…Key` field).
- What's stored never changes because of data; only what's drawn does.

## Considered options

1. A `valueAtFull` percentage, as lights' strength uses.
2. A range: two values (`valueAtLowSetting`, `valueAtHighSetting`) mapped to two settings (`lowSetting`, `highSetting`, the field's own min and max by default), on a straight or log scale (`usesLogScale`), clamped.

## Decision outcome

Chosen option: **2**. An object's `data` map holds a binding per prop name, or `scale` for its size. `readSetting` (`parts/dataBinding.ts`) places the value; `entityAsDrawn` (`parts/propData.ts`) gives the object as drawn, number props rounded to their field's step, on/off props switched, choices taken from a value naming an option. It's cached per object and data, so objects that don't follow data cost nothing. The renderer, labels and selection all use the object as drawn.

The object's own **Data** tab shows Size and each number and on/off prop as By hand / From data (the shared `DataDrivenField`, a new `range` kind: Log scale, Low value, Smallest, High value, Largest, and what it is now). Several objects selected share one Data tab.

### Consequences

- Good: any part can grow with data; clusters (ADR-0111) and towers do without code of their own.
- Bad: while a size follows data the gizmo's resize is overridden by the data (the stored size is kept for when it stops).

## More information

`parts/propData.ts`, `parts/dataBinding.ts` (`readSetting`), `ui/DataBindingFields.tsx`, ADR-0058, ADR-0108.
