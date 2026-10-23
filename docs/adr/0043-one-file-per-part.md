---
status: accepted
date: 2026-10-23
---

# 0043. One file per part, in a folder per palette category

## Context and problem statement

Parts (ADR-0005) lived in a handful of files grouped loosely by theme (`buildings.tsx`, `infrastructure.tsx`, `racing.tsx`, `water.tsx` …). The grouping didn't match the palette (the race car sat in `racing.tsx` with the grandstand, the yacht in `water.tsx`, the beacon among the infrastructure), files grew to several parts each, and finding a part meant knowing which file it had landed in.

## Decision drivers

- Finding a part from its kind or its place in the palette should be obvious.
- Adding a part shouldn't mean growing an existing file.
- No change to how parts are defined or registered.

## Considered options

1. Keep the themed multi-part files.
2. One file per part, in a folder per palette category.
3. One flat folder of part files.

## Decision outcome

Chosen option: **2**. Each part is `src/parts/<category>/<kind>.tsx`, where the folder is the part's `category` (the palette section it's listed under: `buildings`, `vehicles`, `nature`, `infrastructure`, `markers`) and the file is named after its kind and export. Shared building blocks stay at the root: `primitives.tsx` (now also `jitter`), `types.ts`, `registry.ts`, `jsonSchema.ts`. Helpers shared within a category get their own file in its folder (e.g. `nature/treeSize.ts`).

At the same time, `TFieldSpec` is keyed by the part's prop names, so `definePart` rejects a field whose `key` isn't one of the schema's props.

### Consequences

- Good: a part is where its kind and palette section say; each file holds one part.
- Good: misspelled field keys are caught by the type checker.
- Bad: moving a part to another palette section means moving its file too.
- Note: ADR-0041 refers to `src/parts/text.tsx`; the text part is now `src/parts/markers/text.tsx`.

## More information

ADR-0005 (procedural part registry). Code: `src/parts/`.
