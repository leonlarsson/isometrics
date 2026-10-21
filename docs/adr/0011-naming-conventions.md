---
status: accepted
date: 2026-10-21
---

# 0011. Type aliases prefixed `T`, interfaces prefixed `I` (lint-enforced)

## Context and problem statement

The repo owner wants types to be recognisable at a glance and consistent across human and agent contributions.

## Decision outcome

- Type aliases: `T` + PascalCase (`TScene`, `TEntity`, `TPartCategory`).
- Interfaces: `I` + PascalCase (`IPartDefinition`, `IEditorState`).
- Zod schemas keep the `…Schema` suffix (`SceneSchema`); inferred types use the `T` prefix (`type TScene = z.output<typeof SceneSchema>`).
- Enforced by Biome `style/useNamingConvention` (error) in `biome.json`. `pnpm check` fails on violations. The rest of the lint setup is in ADR-0013.
- Generic type parameters (`P`, `TValue`) are not affected.

### Consequences

- Good: consistent and machine-checked.
- Bad: diverges from some library conventions; third-party types keep their own names.
