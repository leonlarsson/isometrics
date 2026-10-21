---
status: accepted
date: 2026-10-21
---

# 0015. Arrow functions everywhere; named exports only

## Context and problem statement

The repo owner prefers one way to define functions and one way to export them, so code reads the same everywhere and grep-by-name always works.

## Decision outcome

1. **Functions are arrow functions bound to `const`.** That covers components, hooks, helpers and callbacks:

   ```ts
   export const resolveTheme = (preference: TThemePreference, dark: boolean): TResolvedTheme => {
   	…
   };
   export const EntityNode = memo(({ entity }: IEntityNodeProps) => { … });
   ```

   - In `.tsx`, an unconstrained generic needs a trailing comma: `<T,>(x: T) => …`.
   - Arrow functions aren't hoisted, so define helpers before the top-level code that uses them.
   - **Exception: TanStack route files (`src/routes/**`).** By convention `export const Route = createFileRoute(...)({ component: X })` comes first, and `X` follows as a hoisted `function` declaration.

2. **No default exports.** Use named exports only. Exception: tool config files (`*.config.ts`, `*.config.mjs`) whose tools require a default export.

Enforcement (`pnpm check`):

- `function` declarations: **not lint-enforced**. Biome has no built-in rule for them; follow the convention in review. (A custom lint plugin was tried and removed on 2026-10-21 to keep the tooling simple.)
- `complexity/useArrowFunction` (error, safe fix): function *expressions*.
- `style/noDefaultExport` (error), turned off for `*.config.*` via `overrides`.

### Consequences

- Good: uniform code; named exports keep imports and renames consistent.
- Bad: no hoisting outside routes; `memo(() => …)` components get no automatic display name (add `displayName` if DevTools naming matters).
