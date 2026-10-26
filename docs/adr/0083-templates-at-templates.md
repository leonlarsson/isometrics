---
status: accepted
date: 2026-10-27
---

# 0083. The templates are served at /templates

## Context and problem statement

ADR-0034 serves the templates as example worlds at `/examples.json` and `/examples/<id>.json`. Everywhere else they're called templates (File → New world…, `src/templates/`, `scripts/shots.mjs --template`), and the owner asked for the address to say so (2026-10-27). One idea, one name.

## Decision outcome

- `/templates.json` lists them (`{ templates: [{ id, name, description, url }] }`) and `/templates/<id>.json` serves each as a complete world, as before. `/schema.json`'s guide, the README and the shots script say so.
- The old addresses are gone, with no redirect (the owner's call: nothing published relies on them yet). The list's key changed from `examples` to `templates`.
- Supersedes ADR-0034's addresses; its field descriptions stand.

### Consequences

- Good: one name for templates everywhere.
- Bad: links to `/examples…` from before stop working.

## More information

Code: `src/routes/templates[.]json.ts`, `src/routes/templates.$file.ts`, `src/parts/jsonSchema.ts`. Related: ADR-0032, ADR-0034, ADR-0047.
