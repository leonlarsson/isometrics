---
status: accepted
date: 2026-10-21
---

# 0001. Record architecture decisions

## Context and problem statement

Humans and AI coding agents both work on this repo. Agents start every session cold, so decisions that only live in someone's head or in chat history get re-litigated or quietly broken.

## Decision outcome

We keep Architecture Decision Records in `docs/adr/`, using a light [MADR](https://adr.github.io/madr/) format (`template.md`).

- Files are numbered `NNNN-kebab-title.md` and never renumbered.
- The index lives in `docs/adr/README.md` and must be updated with every new ADR.
- An ADR is written **before or together with** the change it describes, for anything that affects structure, dependencies, data formats, conventions or user-facing behaviour at a system level.
- ADRs are immutable once accepted. To change a decision, write a new ADR and mark the old one `superseded by [ADR-NNNN](…)`.
- Small, local, easily reversed choices don't need an ADR.

### Consequences

- Good: agents can read `docs/adr/README.md` to learn the "why" quickly; `AGENTS.md` points them there.
- Bad: a small amount of writing overhead per significant change.
