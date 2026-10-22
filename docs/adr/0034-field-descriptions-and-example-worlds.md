---
status: accepted
date: 2026-10-22
---

# 0034. Field descriptions in the scene schema, and example worlds at /examples

## Context and problem statement

ADR-0032 put the part catalogue and a format guide into `/schema.json`, but the scene's own fields still had no descriptions there: their meanings lived in code comments, which JSON Schema never sees. An AI writing a world had names and types, not meaning (which way `rotation` turns, what `offset` measures from). It also had no complete world to learn from.

## Decision drivers

- `/schema.json` alone should be enough to write a correct world.
- One place for each field's meaning, next to the field.

## Decision outcome

- **Descriptions live in the schema.** Every user-facing field and type in `src/scene/schema.ts` carries its meaning in `.describe()` text, which `z.toJSONSchema` puts into `/schema.json`. Comments there are for implementation notes only. New fields get a `.describe()` too.
- **Example worlds.** `/examples.json` lists the templates (id, name, description, url), and `/examples/<id>.json` returns one as a complete world file, the same JSON File → Save writes. The schema's guide points to them.

### Consequences

- Good: an AI (or a person) sees each field's meaning wherever the schema is shown, and has real worlds to copy patterns from.
- Good: templates are examples automatically; adding one adds an example.
- Bad: descriptions are prose next to code and must be kept true when a field's meaning changes.

## More information

ADR-0032 (part catalogue in /schema.json), ADR-0003 (scene document). Code: `src/scene/schema.ts`, `src/routes/examples[.]json.ts`, `src/routes/examples.$file.ts`.
