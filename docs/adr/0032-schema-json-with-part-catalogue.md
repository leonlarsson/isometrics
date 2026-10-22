---
status: accepted
date: 2026-10-22
---

# 0032. /schema.json includes the part catalogue and a format guide

## Context and problem statement

`/schema.json` is generated from `SceneSchema`, so it never drifts, but an entity's `kind` was just "a string" and its `props` "any object": the part kinds and their parameters live in the part registry, which `scene/` may not import. Someone with their own data and their own AI (the "bring your own Claude" flow: read the schema, write a world, open it with File → Open) couldn't know that `raceCar` exists or that a tower takes `floors`. Wrong kinds open as unknown parts and wrong props silently fall back to defaults.

## Decision drivers

- An outside AI or person should be able to write a good world from `/schema.json` alone.
- It must stay generated from the code, never hand-maintained.
- `scene/` stays free of the parts (and of React and three.js).

## Considered options

1. Compose the full schema outside `scene/`: the scene schema plus the part registry, served by the route.
2. Move part metadata (kind, name, description, props schema) into `scene/` and keep components in `parts/`.
3. A separate hand-written guide (e.g. `/llms.txt`) next to the schema.

## Decision outcome

Chosen option: **1**. `worldJsonSchema()` (`src/parts/jsonSchema.ts`) takes `sceneJsonSchema()` and adds:

- `kind` as a `oneOf` of every registered part (`const` + name + a one-line description: what it is, its default size, what `color` and `accent` paint, whether it can drive along a road).
- Each kind's `props` schema (from its `definePart` Zod schema, with inspector labels as descriptions), as `allOf` `if kind = … then props: …` rules.
- A top-level `description`: a short guide to coordinates, rotation, roads and routes, areas and data binding.

`/schema.json` serves it; `scene/jsonSchema.ts` stays the base and stays part-free. A test checks that every part is listed.

### Consequences

- Good: new parts and new props show up in `/schema.json` automatically; an AI can target the real vocabulary.
- Good: no restructuring of the part files.
- Bad: the worker bundle imports the part components (three.js was already there), and the guide text is hand-written, so it must be kept true when the format's meaning changes (it's next to the code it describes).
- Follow-up: field-level descriptions (`.describe()`/`.meta()` on `SceneSchema`) would make the base schema self-explanatory too; an example world per template could be served alongside.

## More information

ADR-0003 (scene document), ADR-0005 (part registry), ADR-0012 (AI generation), ADR-0026 (repair on open).
